import uuid
import secrets

from django.conf import settings
from django.db import models


def generate_share_slug() -> str:
    """Short, URL-safe, unguessable slug for public share links (/v/<slug>)."""
    return secrets.token_urlsafe(8).replace('_', '').replace('-', '')[:11]


class Project(models.Model):
    """
    A DemoForge project: the durable, server-side home for a recording,
    its editor state, generated script, and rendered output. This is what
    lets work persist across devices/sessions and power the share view.
    """

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        RENDERING = 'rendering', 'Rendering'
        READY = 'ready', 'Ready'

    class Visibility(models.TextChoices):
        PRIVATE = 'private', 'Private'      # only the owner
        UNLISTED = 'unlisted', 'Unlisted'   # anyone with the link
        PUBLIC = 'public', 'Public'         # discoverable / embeddable

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='projects',
    )

    title = models.CharField(max_length=200, default='Untitled demo')
    description = models.TextField(blank=True, default='')

    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.DRAFT
    )
    visibility = models.CharField(
        max_length=20, choices=Visibility.choices, default=Visibility.PRIVATE
    )

    # Public share link identifier (used by /v/<share_slug>)
    share_slug = models.SlugField(
        max_length=16, unique=True, default=generate_share_slug, editable=False
    )

    # Media (typically Azure Blob URLs once cloud storage lands)
    thumbnail_url = models.URLField(blank=True, default='')
    video_url = models.URLField(blank=True, default='')

    duration = models.FloatField(default=0, help_text='Rendered duration (seconds)')
    aspect_ratio = models.CharField(max_length=12, default='16:9')
    language = models.CharField(max_length=12, default='en')

    # Structured working data
    recording_data = models.JSONField(
        default=dict, blank=True,
        help_text='Captured events (clicks, moves), viewport, cursor data',
    )
    edit_data = models.JSONField(
        default=dict, blank=True,
        help_text='Editor state: color grading, text overlays, camera, effects',
    )
    script_segments = models.JSONField(
        default=list, blank=True,
        help_text='Array of {text, timestamp} narration segments',
    )

    # Lightweight analytics (full per-viewer analytics is a later phase)
    view_count = models.PositiveIntegerField(default=0)
    last_viewed_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['owner', '-updated_at']),
            models.Index(fields=['share_slug']),
        ]

    def __str__(self) -> str:
        return f'{self.title} ({self.get_status_display()})'

    @property
    def is_shareable(self) -> bool:
        return self.visibility in {self.Visibility.UNLISTED, self.Visibility.PUBLIC}
