import io
import logging
import mimetypes
import os
import uuid

from django.conf import settings
from django.core.files.storage import default_storage
from django.core.signing import BadSignature, TimestampSigner
from django.urls import reverse

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


def _use_azure_blob() -> bool:
    return bool(getattr(settings, "AZURE_STORAGE_CONNECTION_STRING", "").strip())


def _blob_service():
    from azure.storage.blob import BlobServiceClient

    return BlobServiceClient.from_connection_string(settings.AZURE_STORAGE_CONNECTION_STRING)


def _blob_client(path: str):
    return _blob_service().get_blob_client(
        container=settings.AZURE_STORAGE_CONTAINER,
        blob=path,
    )


def save_project_media(project_id: uuid.UUID, uploaded_file, kind: str) -> str:
    """
    Persist an uploaded blob under projects/<id>/<kind>.<ext>.
    Uses Azure Blob in production, local media/ in dev.
    """
    ext = _extension(uploaded_file.name, getattr(uploaded_file, "content_type", ""))
    path = f"projects/{project_id}/{kind}{ext}"

    if _use_azure_blob():
        from azure.storage.blob import ContentSettings

        client = _blob_client(path)
        if client.exists():
            client.delete_blob()
        uploaded_file.seek(0)
        content_type = getattr(uploaded_file, "content_type", None) or mimetypes.guess_type(path)[0]
        client.upload_blob(
            uploaded_file.read(),
            overwrite=True,
            content_settings=ContentSettings(content_type=content_type) if content_type else None,
        )
        logger.info("Uploaded project media to Azure Blob: %s", path)
        return path

    if default_storage.exists(path):
        default_storage.delete(path)
    return default_storage.save(path, uploaded_file)


def media_exists(path: str) -> bool:
    try:
        if _use_azure_blob():
            return _blob_client(path).exists()
        return default_storage.exists(path)
    except Exception:
        logger.exception("Failed to check media existence for %s", path)
        return False


def open_media(path: str):
    """Return a readable binary stream for a stored media object."""
    if _use_azure_blob():
        data = _blob_client(path).download_blob().readall()
        return io.BytesIO(data)
    return default_storage.open(path, "rb")


def media_content_type(path: str) -> str:
    guessed, _ = mimetypes.guess_type(path)
    return guessed or "application/octet-stream"


def video_storage_path_for_project(project) -> str | None:
    """Storage-relative path for a project's source/render video, if known."""
    data = project.recording_data or {}
    if path := data.get("video_storage_path"):
        return path
    if project.video_url and "/media/" in project.video_url:
        return project.video_url.split("/media/", 1)[1].split("?", 1)[0]
    # Convention-based fallback for legacy rows.
    if project.duration and project.duration > 0:
        return f"projects/{project.id}/source.webm"
    return None


def build_video_access_token(project_id: uuid.UUID) -> str:
    return VIDEO_SIGNER.sign(str(project_id))


def verify_video_access_token(project_id: uuid.UUID, token: str) -> bool:
    try:
        return VIDEO_SIGNER.unsign(token, max_age=VIDEO_URL_MAX_AGE) == str(project_id)
    except BadSignature:
        return False


def build_project_video_stream_url(project, request=None) -> str:
    """Signed API URL that the browser <video> tag can load without JWT headers."""
    if request is None:
        return ""
    path = video_storage_path_for_project(project)
    if not path or not media_exists(path):
        return ""
    token = build_video_access_token(project.id)
    stream_path = reverse("project-stream-video", kwargs={"pk": project.id})
    return request.build_absolute_uri(f"{stream_path}?token={token}")


def resolve_project_video_url(project, request=None) -> str:
    """Return a browser-playable URL, or empty string if no video is stored."""
    stream_url = build_project_video_stream_url(project, request)
    if stream_url:
        return stream_url

    path = video_storage_path_for_project(project)
    if path and media_exists(path) and not _use_azure_blob():
        url = default_storage.url(path)
        if request and url.startswith("/"):
            url = request.build_absolute_uri(url)
        return url

    # Never return stale /media/ URLs from App Service — they 404 in production.
    if project.video_url and "/media/" in project.video_url:
        return ""
    return project.video_url or ""
