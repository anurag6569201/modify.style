"""
API views for the modify.style application.
Handles HTTP requests and delegates business logic to services.
"""

import logging
from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from django.http import JsonResponse, HttpResponse, StreamingHttpResponse
from django.views.decorators.clickjacking import xframe_options_exempt
from .models import ExampleModel
from .serializers import ExampleModelSerializer
from .services import ProxyService, ResourceProxyService

logger = logging.getLogger(__name__)


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
    ViewSet for CRUD operations on ExampleModel instances.
    Provides standard REST endpoints: list, create, retrieve, update, destroy.
    """
    queryset = ExampleModel.objects.all()
    serializer_class = ExampleModelSerializer
    permission_classes = [AllowAny]


@xframe_options_exempt
@api_view(['GET', 'OPTIONS'])
@permission_classes([AllowAny])
def proxy_resource(request):
    """
    Proxy endpoint for fetching resources (CSS, JS, images, etc.) from websites.
    Bypasses CORS restrictions by fetching resources server-side.
    """
    if request.method == 'OPTIONS':
        response = HttpResponse()
        response['Access-Control-Allow-Origin'] = '*'
        response['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
        response['Access-Control-Allow-Headers'] = '*'
        response['Access-Control-Max-Age'] = '86400'
        return response
    
    resource_url = request.GET.get('url')
    
    if not resource_url:
        return JsonResponse({'error': 'URL parameter is required'}, status=400)
    
    return proxy_resource_logic(resource_url)


@xframe_options_exempt
@api_view(['GET', 'OPTIONS'])
@permission_classes([AllowAny])
def proxy_path_view(request, url):
    """
    Proxy endpoint using path-based routing for better relative URL resolution.
    Captures requests like /api/proxy-path/https://example.com/script.js
    """
    if request.method == 'OPTIONS':
        response = HttpResponse()
        response['Access-Control-Allow-Origin'] = '*'
        response['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
        response['Access-Control-Allow-Headers'] = '*'
        response['Access-Control-Max-Age'] = '86400'
        return response
    
    # Reconstruct protocol if malformed by path converter
    if url.startswith('http:/') and not url.startswith('http://'):
        url = url.replace('http:/', 'http://', 1)
    elif url.startswith('https:/') and not url.startswith('https://'):
        url = url.replace('https:/', 'https://', 1)
    
    # Append query parameters if present (e.g. ?v=123)
    if request.GET:
        url += '?' + request.GET.urlencode()
        
    return proxy_resource_logic(url)

def proxy_resource_logic(resource_url):
    """Shared logic for proxying resources."""
    content, content_type, headers_dict = ResourceProxyService.proxy_resource(resource_url)
    
    if content is None:
        return JsonResponse(headers_dict, status=500)
    
    response = HttpResponse(content, content_type=content_type)
    
    for key, value in headers_dict.items():
        if key.lower() not in ['content-encoding', 'transfer-encoding']:
            response[key] = value
    
    return response

@xframe_options_exempt
@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def proxy_website(request):
    """
    Proxy endpoint for website rendering using Playwright.
    Returns fully rendered HTML with all resources proxied for iframe embedding.
    """
    url = request.GET.get('url') or (request.data.get('url') if request.method == 'POST' else None)
    
    if not url:
        return JsonResponse({'error': 'URL parameter is required'}, status=400)
    
    result = ProxyService.render_website(url)
    
    if 'error' in result:
        status_code = 500
        return JsonResponse(result, status=status_code)
    
    response = JsonResponse(result)
    response['X-Frame-Options'] = 'ALLOWALL'
    return response

@api_view(['POST'])
@permission_classes([AllowAny])
def ai_analyze(request):
    """
    Endpoint to analyze HTML content using Gemini.
    Expects JSON body: { "html": "<html string...>" }
    """
    html_content = request.data.get('html')
    if not html_content:
        return JsonResponse({'error': 'HTML content is required'}, status=400)

    from .services.ai_service import GeminiService
    service = GeminiService()
    result = service.analyze_page(html_content)
    return JsonResponse(result)


@api_view(['POST'])
@permission_classes([AllowAny])
def ai_chat(request):
    """
    Endpoint to chat with the AI about the website.
    Expects JSON body: { "message": "user msg", "context": "<html string...>" }
    """
    message = request.data.get('message')
    context = request.data.get('context')
    
    if not message:
        return JsonResponse({'error': 'Message is required'}, status=400)

    from .services.ai_service import GeminiService
    service = GeminiService()
    result = service.chat(message, context)
    return JsonResponse(result)
