import logging
import os
import uuid

from django.conf import settings
from django.core.signing import BadSignature, TimestampSigner
from django.urls import reverse

from modify_style_backend.media_storage import (
    media_content_type,
    media_exists,
    open_media,
    project_media_path,
    save_upload,
    use_azure_blob,
)

logger = logging.getLogger(__name__)

MIME_EXT = {
    "video/webm": ".webm",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "image/gif": ".gif",
    "image/png": ".png",
    "image/apng": ".apng",
}

VIDEO_SIGNER = TimestampSigner(salt="demoforge-project-video")
VIDEO_URL_MAX_AGE = 86400  # 24 hours


def _extension(filename: str, content_type: str) -> str:
    _, ext = os.path.splitext(filename or "")
    if ext:
        return ext.lower()
    return MIME_EXT.get(content_type, ".webm")


def save_project_media(project_id: uuid.UUID, uploaded_file, kind: str) -> str:
    ext = _extension(uploaded_file.name, getattr(uploaded_file, "content_type", ""))
    path = project_media_path(project_id, kind, ext)
    return save_upload(path, uploaded_file)


def video_storage_path_for_project(project) -> str | None:
    data = project.recording_data or {}
    if path := data.get("video_storage_path"):
        return path
    if project.video_url and "/media/" in project.video_url:
        return project.video_url.split("/media/", 1)[1].split("?", 1)[0]
    if project.duration and project.duration > 0:
        return project_media_path(project.id, "source", ".webm")
    return None


def build_video_access_token(project_id: uuid.UUID) -> str:
    return VIDEO_SIGNER.sign(str(project_id))


def verify_video_access_token(project_id: uuid.UUID, token: str) -> bool:
    try:
        return VIDEO_SIGNER.unsign(token, max_age=VIDEO_URL_MAX_AGE) == str(project_id)
    except BadSignature:
        return False


def build_project_video_stream_url(project, request=None) -> str:
    if request is None:
        return ""
    path = video_storage_path_for_project(project)
    if not path or not media_exists(path):
        return ""
    token = build_video_access_token(project.id)
    stream_path = reverse("project-stream-video", kwargs={"pk": project.id})
    return request.build_absolute_uri(f"{stream_path}?token={token}")


def resolve_project_video_url(project, request=None) -> str:
    """Always prefer signed API stream URLs — never return /media/ in production."""
    stream_url = build_project_video_stream_url(project, request)
    if stream_url:
        return stream_url

    # Local dev fallback only
    if not settings.IS_PRODUCTION:
        path = video_storage_path_for_project(project)
        if path and media_exists(path) and not use_azure_blob() and request:
            from django.core.files.storage import default_storage
            url = default_storage.url(path)
            if url.startswith("/"):
                url = request.build_absolute_uri(url)
            return url

    return ""
