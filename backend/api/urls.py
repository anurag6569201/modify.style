"""
URL routing for the API application.
Defines all API endpoints and their corresponding views.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Router for ViewSet endpoints
router = DefaultRouter()
router.register(r'examples', views.ExampleModelViewSet, basename='example')

urlpatterns = [
    # Health and info endpoints
    path('health/', views.health_check, name='health-check'),
    path('info/', views.api_info, name='api-info'),
    
    # Proxy endpoints for website rendering
    path('proxy/', views.proxy_website, name='proxy-website'),
    path('proxy-resource/', views.proxy_resource, name='proxy-resource'),
    path('proxy-path/<path:url>', views.proxy_path_view, name='proxy-path'),
    
    # ViewSet endpoints (examples)
    path('', include(router.urls)),
]

