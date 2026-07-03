from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import ProjectViewSet, PublicProjectView

router = DefaultRouter()
router.register('', ProjectViewSet, basename='project')

urlpatterns = [
    # Public share endpoint must come before the router catch-all.
    path('public/<slug:share_slug>/', PublicProjectView.as_view(), name='project-public'),
    path('', include(router.urls)),
]
