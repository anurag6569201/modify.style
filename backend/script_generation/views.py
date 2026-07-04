from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.conf import settings
from django.contrib.auth.models import User
import logging

from .models import ScriptGeneration
from .serializers import (
    ScriptGenerationRequestSerializer,
    ScriptGenerationResponseSerializer
)
from .services import gemini_script_service

logger = logging.getLogger(__name__)


class ScriptGenerationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for generating scripts with timestamps
    """
    # Allow unauthenticated access in DEBUG mode for development
    permission_classes = [AllowAny if settings.DEBUG else IsAuthenticated]
    http_method_names = ['post', 'get', 'head', 'options']
    
    def get_queryset(self):
        if self.request.user.is_authenticated:
            return ScriptGeneration.objects.filter(user=self.request.user)
        return ScriptGeneration.objects.none()
    
    def get_serializer_class(self):
        if self.action == 'create':
            return ScriptGenerationRequestSerializer
        return ScriptGenerationResponseSerializer
    
    def get_or_create_user(self):
        """Get authenticated user or create/get anonymous user for development"""
        if self.request.user.is_authenticated:
            return self.request.user
        
        # In DEBUG mode, create or get a default anonymous user
        if settings.DEBUG:
            user, created = User.objects.get_or_create(
                username='anonymous',
                defaults={'email': 'anonymous@example.com'}
            )
            return user
        
        return None
    
    def create(self, request, *args, **kwargs):
        """
        Generate script with timestamps
        POST /api/scripts/generate/
        """
        serializer = ScriptGenerationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        validated_data = serializer.validated_data
        video_url = validated_data.get('video_url')
        video_duration = validated_data.get('video_duration')
        events = validated_data.get('events', {})
        screenshots = validated_data.get('screenshots', [])
        style = validated_data.get('style', {}) or {}
        
        # Get or create user (handles both authenticated and anonymous in DEBUG)
        user = self.get_or_create_user()
        if not user:
            return Response(
                {'error': 'Authentication required'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Create script generation record
        script_gen = ScriptGeneration.objects.create(
            user=user,
            status=ScriptGeneration.Status.PROCESSING,
            video_url=video_url,
            video_duration=video_duration,
            events_data=events
        )
        
        try:
            # Generate script segments using Gemini (with screenshots if available)
            script_segments = gemini_script_service.generate_script_with_timestamps(
                video_duration=video_duration,
                events=events,
                screenshots=screenshots,
                style=style
            )
            
            # Update script generation with results
            script_gen.script_segments = script_segments
            script_gen.status = ScriptGeneration.Status.COMPLETED
            script_gen.save()
            
            response_serializer = ScriptGenerationResponseSerializer(
                script_gen,
                context={'request': request}
            )
            
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error generating script: {e}", exc_info=True)
            script_gen.status = ScriptGeneration.Status.FAILED
            script_gen.error_message = str(e)
            script_gen.save()
            
            return Response(
                {
                    'error': 'Failed to generate script',
                    'detail': str(e)
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
