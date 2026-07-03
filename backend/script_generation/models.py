import uuid
import json
from django.db import models
from django.conf import settings


class ScriptGeneration(models.Model):
    """
    Model to store generated scripts with timestamps
    """
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        PROCESSING = 'processing', 'Processing'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='script_generations'
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    
    # Input data
    video_url = models.URLField(blank=True, null=True)
    video_duration = models.FloatField(help_text="Video duration in seconds", default=0)
    events_data = models.JSONField(
        default=dict,
        help_text="JSON containing clicks, moves, and other events"
    )
    
    # Output data
    script_segments = models.JSONField(
        default=list,
        help_text="Array of {text: string, timestamp: number} objects"
    )
    
    error_message = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Script for {self.user.email} ({self.status})"
