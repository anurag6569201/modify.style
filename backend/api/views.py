from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.http import JsonResponse
from .models import ExampleModel
from .serializers import ExampleModelSerializer


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """Health check endpoint."""
    return JsonResponse({
        'status': 'healthy',
        'message': 'Django backend is running successfully!'
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def api_info(request):
    """API information endpoint."""
    return JsonResponse({
        'name': 'Modify.Style API',
        'version': '1.0.0',
        'endpoints': {
            'health': '/api/health/',
            'info': '/api/info/',
            'examples': '/api/examples/',
        }
    })


class ExampleModelViewSet(viewsets.ModelViewSet):
    """
    ViewSet for viewing and editing ExampleModel instances.
    """
    queryset = ExampleModel.objects.all()
    serializer_class = ExampleModelSerializer
    permission_classes = [AllowAny]

