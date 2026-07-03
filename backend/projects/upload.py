import os
import uuid

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
