import os
import uuid

from django.conf import settings
from django.core.files.storage import default_storage


MIME_EXT = {
    "video/webm": ".webm",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "image/gif": ".gif",
    "image/png": ".png",
    "image/apng": ".apng",
}


def _extension(filename: str, content_type: str) -> str:
    _, ext = os.path.splitext(filename or "")
    if ext:
        return ext.lower()
    return MIME_EXT.get(content_type, ".webm")


def save_project_media(project_id: uuid.UUID, uploaded_file, kind: str) -> str:
    """
    Persist an uploaded blob under media/projects/<id>/<kind>.<ext>.
    Returns the storage-relative path (e.g. projects/<uuid>/source.webm).
    """
    ext = _extension(uploaded_file.name, getattr(uploaded_file, "content_type", ""))
    path = f"projects/{project_id}/{kind}{ext}"
    if default_storage.exists(path):
        default_storage.delete(path)
    return default_storage.save(path, uploaded_file)


def video_storage_path_for_project(project) -> str | None:
    """Storage-relative path for a project's source/render video, if known."""
    data = project.recording_data or {}
    if path := data.get("video_storage_path"):
        return path
    if project.video_url and "/media/" in project.video_url:
        return project.video_url.split("/media/", 1)[1].split("?", 1)[0]
    return None


def resolve_project_video_url(project, request=None) -> str:
    """
    Return a browser-playable URL for the project video.
    Azure Blob uses time-limited SAS URLs; local dev uses /media/ URLs.
    """
    path = video_storage_path_for_project(project)
    if not path:
        return project.video_url or ""

    try:
        if not default_storage.exists(path):
            return project.video_url or ""
    except Exception:
        return project.video_url or ""

    url = default_storage.url(path)
    if request and url.startswith("/"):
        url = request.build_absolute_uri(url)
    return url
