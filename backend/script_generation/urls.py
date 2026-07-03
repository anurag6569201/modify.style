from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ScriptGenerationViewSet

router = DefaultRouter()
router.register('generate', ScriptGenerationViewSet, basename='script-generation')

urlpatterns = [
    path('', include(router.urls)),
]
