from django.conf import settings
from django.db import connection
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .media_storage import use_azure_blob


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(_request):
    """Lightweight prod sanity check — confirms DB + storage mode."""
    storage_mode = "azure_blob" if use_azure_blob() else "local_filesystem"
    if settings.IS_PRODUCTION and storage_mode != "azure_blob":
        storage_mode = "misconfigured"

    db_engine = connection.settings_dict.get("ENGINE", "")
    if settings.IS_PRODUCTION and "sqlite" in db_engine:
        db_mode = "misconfigured_sqlite"
    elif "postgresql" in db_engine:
        db_mode = "postgresql"
    elif "sqlite" in db_engine:
        db_mode = "sqlite"
    else:
        db_mode = db_engine.rsplit(".", 1)[-1]

    ok = (
        (not settings.IS_PRODUCTION)
        or (db_mode == "postgresql" and storage_mode == "azure_blob")
    )

    return Response(
        {
            "status": "ok" if ok else "degraded",
            "debug": settings.DEBUG,
            "database": db_mode,
            "storage": storage_mode,
            "storage_container": settings.AZURE_STORAGE_CONTAINER if use_azure_blob() else None,
        }
    )
