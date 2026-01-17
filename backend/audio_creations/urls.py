from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AudioCreationViewSet, FailedAudioCreationViewSet

router = DefaultRouter()
router.register('', AudioCreationViewSet, basename='audio')

urlpatterns = [
    path('failed/', FailedAudioCreationViewSet.as_view({'get': 'list'}), name='failed-audio-list'),
    path('', include(router.urls)),
]
