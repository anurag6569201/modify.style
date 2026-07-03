from django.db.models import F, Q
from django.utils import timezone
from django.conf import settings
from rest_framework import viewsets, generics, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser

from .models import Project
from .serializers import (
    ProjectListSerializer,
    ProjectDetailSerializer,
    ProjectPublicSerializer,
)
from .upload import save_project_media


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
        qs = Project.objects.filter(owner=self.request.user)
        # Dashboard list: only demos with a capture or export in progress.
        if self.action == 'list':
            qs = qs.filter(
                Q(video_url__gt='')
                | Q(status=Project.Status.RENDERING)
                | Q(status=Project.Status.READY)
            )
        return qs

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

    @action(
        detail=True,
        methods=['post'],
        url_path='upload-video',
        parser_classes=[MultiPartParser, FormParser],
    )
    def upload_video(self, request, pk=None):
        """
        Upload source recording or rendered export for a project.
        Multipart fields: file (required), kind ('source' | 'render'), duration (optional).
        """
        project = self.get_object()
        uploaded = request.FILES.get('file')
        if not uploaded:
            return Response({'error': 'No file provided.'}, status=status.HTTP_400_BAD_REQUEST)

        kind = request.data.get('kind', 'source')
        if kind not in {'source', 'render'}:
            return Response({'error': "kind must be 'source' or 'render'."}, status=status.HTTP_400_BAD_REQUEST)

        saved_path = save_project_media(project.id, uploaded, kind)
        media_url = settings.MEDIA_URL.rstrip('/') + '/' + saved_path
        video_url = request.build_absolute_uri(media_url)

        project.video_url = video_url
        duration = request.data.get('duration')
        if duration is not None:
            try:
                project.duration = float(duration)
            except (TypeError, ValueError):
                pass

        if kind == 'render':
            project.status = Project.Status.READY
        elif project.status == Project.Status.DRAFT:
            project.status = Project.Status.DRAFT

        project.save(update_fields=['video_url', 'duration', 'status', 'updated_at'])

        return Response(
            {
                'video_url': video_url,
                'duration': project.duration,
                'status': project.status,
            },
            status=status.HTTP_200_OK,
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
