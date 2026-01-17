from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ReadOnlyModelViewSet
from django.contrib.auth.models import User

from .models import AudioCreation
from .serializers import (
    AudioCreationRequestSerializer, 
    AudioCreationResponseSerializer,
    AudioCreationUpdateSerializer
)
from .services import calculate_audio_cost
from .voices import VOICE_CHOICES
from .costs import VOICE_MULTIPLIERS, DEFAULT_VOICE_MULTIPLIER
import logging

logger = logging.getLogger(__name__)

class AudioCreationViewSet(viewsets.ModelViewSet):
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']
    
    def get_queryset(self):
        base_queryset = AudioCreation.objects.filter(user=self.request.user).select_related('user')
        if self.action == 'list':
            return base_queryset.exclude(status=AudioCreation.Status.FAILED).order_by('-created_at')
        return base_queryset

    def get_serializer_class(self):
        if self.action == 'create':
            return AudioCreationRequestSerializer
        if self.action in ['update', 'partial_update']:
            return AudioCreationUpdateSerializer
        return AudioCreationResponseSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = serializer.validated_data
        
        cost = calculate_audio_cost(
            text_input=validated_data['text_input'],
            response_format=validated_data['response_format'],
            voice=validated_data['voice']
        )
        
        try:
            with transaction.atomic():
                # For now, we'll skip credit check since modify.style might not have credit_balance
                # If you want to add credit system, uncomment below and add credit_balance to User model
                # user = User.objects.select_for_update().get(id=request.user.id)
                # if hasattr(user, 'credit_balance') and user.credit_balance < cost:
                #     return Response(
                #         {"detail": f"Insufficient credits. This action costs {cost}, but you only have {user.credit_balance}."},
                #         status=status.HTTP_402_PAYMENT_REQUIRED
                #     )
                # user.credit_balance -= cost
                # user.save(update_fields=['credit_balance'])
                
                creation = AudioCreation.objects.create(
                    user=request.user,
                    credit_cost=cost,
                    **validated_data
                )

        except Exception as e:
            logger.error(f"Error in audio creation: {e}", exc_info=True)
            return Response({"detail": "An unexpected error occurred. Please try again."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # For now, we'll process synchronously. If you have Celery, uncomment below
        # from .tasks import generate_audio_from_text
        # generate_audio_from_text.delay(str(creation.id))
        
        # Synchronous processing for now
        try:
            from .tasks import generate_audio_from_text_sync
            generate_audio_from_text_sync(str(creation.id))
        except ImportError:
            # If tasks don't exist yet, just return the creation
            pass
        
        response_serializer = AudioCreationResponseSerializer(creation, context={'request': request})
        return Response(response_serializer.data, status=status.HTTP_202_ACCEPTED)

    def perform_destroy(self, instance):
        if instance.result_file:
            instance.result_file.delete(save=False)
        super().perform_destroy(instance)

    @action(detail=False, methods=['get'], url_path='voice-options')
    def voice_options(self, request, *args, **kwargs):
        data = []
        for voice_id, display_name in VOICE_CHOICES:
            multiplier = VOICE_MULTIPLIERS.get(voice_id, DEFAULT_VOICE_MULTIPLIER)
            data.append({ 'id': voice_id, 'name': display_name, 'multiplier': float(multiplier) })
        return Response(data)

class FailedAudioCreationViewSet(ReadOnlyModelViewSet):
    serializer_class = AudioCreationResponseSerializer

    def get_queryset(self):
        return AudioCreation.objects.filter(
            user=self.request.user, 
            status=AudioCreation.Status.FAILED
        ).order_by('-created_at')
