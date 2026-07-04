from django.db.models import F, Q
from django.http import FileResponse, Http404
from django.utils import timezone
from rest_framework import viewsets, generics, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
import logging

from .models import Project
from .serializers import (
    ProjectListSerializer,
    ProjectDetailSerializer,
    ProjectPublicSerializer,
)
from modify_style_backend.media_storage import media_content_type, media_exists, open_media
from .upload import (
    save_project_media,
    resolve_project_video_url,
    video_storage_path_for_project,
    verify_video_access_token,
)

logger = logging.getLogger(__name__)


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

        try:
            saved_path = save_project_media(project.id, uploaded, kind)
        except Exception as exc:
            logger.exception("Video upload failed for project %s", project.id)
            return Response(
                {'error': f'Upload failed: {exc}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        recording_data = dict(project.recording_data or {})
        recording_data['video_storage_path'] = saved_path
        project.recording_data = recording_data

        video_url = resolve_project_video_url(project, request)
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

        project.save(update_fields=['video_url', 'duration', 'status', 'updated_at', 'recording_data'])

        return Response(
            {
                'video_url': video_url,
                'duration': project.duration,
                'status': project.status,
            },
            status=status.HTTP_200_OK,
        )

    @action(
        detail=True,
        methods=['get'],
        url_path='video',
        url_name='stream-video',
        permission_classes=[AllowAny],
    )
    def stream_video(self, request, pk=None):
        """
        Stream project video for browser playback.
        Accepts a signed ?token= query param (no JWT required for <video src>).
        """
        token = request.query_params.get('token', '')
        if not verify_video_access_token(pk, token):
            if not request.user.is_authenticated:
                raise Http404('Invalid or expired video link')
            project = Project.objects.filter(pk=pk, owner=request.user).first()
            if not project:
                raise Http404('Video not found')
        else:
            project = Project.objects.filter(pk=pk).first()
            if not project:
                raise Http404('Video not found')

        path = video_storage_path_for_project(project)
        if not path or not media_exists(path):
            raise Http404('Video file not found')

        handle = open_media(path)
        response = FileResponse(
            handle,
            content_type=media_content_type(path),
            as_attachment=False,
            filename=path.rsplit('/', 1)[-1],
        )
        response['Accept-Ranges'] = 'bytes'
        response['Cache-Control'] = 'private, max-age=3600'
        return response


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
