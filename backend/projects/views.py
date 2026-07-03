from django.db.models import F
from django.utils import timezone
from rest_framework import viewsets, generics, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from .models import Project
from .serializers import (
    ProjectListSerializer,
    ProjectDetailSerializer,
    ProjectPublicSerializer,
)


class ProjectViewSet(viewsets.ModelViewSet):
    """
    Owner-scoped CRUD for demo projects.

    list      GET    /api/projects/
    create    POST   /api/projects/
    retrieve  GET    /api/projects/<id>/
    update    PUT    /api/projects/<id>/
    partial   PATCH  /api/projects/<id>/
    destroy   DELETE /api/projects/<id>/
    """

    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # A user can only ever see their own projects.
        return Project.objects.filter(owner=self.request.user)

    def get_serializer_class(self):
        if self.action == 'list':
            return ProjectListSerializer
        return ProjectDetailSerializer

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        """Clone an existing project (handy for template-style reuse)."""
        original = self.get_object()
        clone = Project.objects.create(
            owner=request.user,
            title=f'{original.title} (copy)',
            description=original.description,
            aspect_ratio=original.aspect_ratio,
            language=original.language,
            recording_data=original.recording_data,
            edit_data=original.edit_data,
            script_segments=original.script_segments,
        )
        return Response(
            ProjectDetailSerializer(clone).data, status=status.HTTP_201_CREATED
        )


class PublicProjectView(generics.RetrieveAPIView):
    """
    Public, no-auth read of a shared demo, resolved by share_slug.
    Backs the /v/<slug> player. Increments the view counter on each fetch.
    Private projects are never exposed here.
    """

    permission_classes = [AllowAny]
    serializer_class = ProjectPublicSerializer
    lookup_field = 'share_slug'
    lookup_url_kwarg = 'share_slug'

    def get_queryset(self):
        return Project.objects.exclude(visibility=Project.Visibility.PRIVATE)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        # Atomic increment; avoid bumping updated_at.
        Project.objects.filter(pk=instance.pk).update(
            view_count=F('view_count') + 1,
            last_viewed_at=timezone.now(),
        )
        instance.refresh_from_db(fields=['view_count', 'last_viewed_at'])
        serializer = self.get_serializer(instance)
        return Response(serializer.data)
