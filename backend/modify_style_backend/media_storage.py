"""
Media persistence — Azure Blob in production, local filesystem in dev only.
"""
from __future__ import annotations

import io
import logging
import mimetypes
import uuid

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.core.files.storage import default_storage

logger = logging.getLogger(__name__)


def use_azure_blob() -> bool:
    return bool(getattr(settings, "USE_AZURE_BLOB", False))


def require_azure_blob() -> None:
    if not use_azure_blob():
        raise ImproperlyConfigured(
            "AZURE_STORAGE_CONNECTION_STRING is required in production. "
            "Local filesystem storage is only allowed for local development."
        )


def _blob_service():
    from azure.storage.blob import BlobServiceClient

    return BlobServiceClient.from_connection_string(settings.AZURE_STORAGE_CONNECTION_STRING)


def _blob_client(path: str):
    return _blob_service().get_blob_client(
        container=settings.AZURE_STORAGE_CONTAINER,
        blob=path,
    )


def save_bytes(path: str, data: bytes, content_type: str | None = None) -> str:
    """Write raw bytes to Azure Blob (prod) or local media/ (dev)."""
    if settings.IS_PRODUCTION:
        require_azure_blob()

    if use_azure_blob():
        from azure.storage.blob import ContentSettings

        client = _blob_client(path)
        if client.exists():
            client.delete_blob()
        guessed = content_type or mimetypes.guess_type(path)[0]
        client.upload_blob(
            data,
            overwrite=True,
            content_settings=ContentSettings(content_type=guessed) if guessed else None,
        )
        logger.info("Saved media to Azure Blob: %s", path)
        return path

    if default_storage.exists(path):
        default_storage.delete(path)
    default_storage.save(path, io.BytesIO(data))
    return path


def save_upload(path: str, uploaded_file) -> str:
    uploaded_file.seek(0)
    content_type = getattr(uploaded_file, "content_type", None)
    return save_bytes(path, uploaded_file.read(), content_type=content_type)


def media_exists(path: str) -> bool:
    try:
        if use_azure_blob():
            return _blob_client(path).exists()
        return default_storage.exists(path)
    except Exception:
        logger.exception("Failed to check media existence for %s", path)
        return False


def open_media(path: str):
    if use_azure_blob():
        data = _blob_client(path).download_blob().readall()
        return io.BytesIO(data)
    return default_storage.open(path, "rb")


def media_content_type(path: str) -> str:
    guessed, _ = mimetypes.guess_type(path)
    return guessed or "application/octet-stream"


def project_media_path(project_id: uuid.UUID, kind: str, ext: str) -> str:
    return f"projects/{project_id}/{kind}{ext}"
