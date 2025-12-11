from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'examples', views.ExampleModelViewSet, basename='example')

urlpatterns = [
    path('health/', views.health_check, name='health-check'),
    path('info/', views.api_info, name='api-info'),
    path('proxy/', views.proxy_website, name='proxy-website'),
    path('', include(router.urls)),
]

