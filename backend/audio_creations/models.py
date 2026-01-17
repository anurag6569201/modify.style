import uuid
from django.db import models
from django.conf import settings
from .voices import VOICE_CHOICES


class AbstractBaseCreation(models.Model):
    """
    An abstract model that provides common fields for any AI-generated content.
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
        related_name='%(class)s_creations'
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    credit_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, blank=True, null=True)
    error_message = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
        ordering = ['-created_at']


class AudioCreation(AbstractBaseCreation):
    class ResponseFormat(models.TextChoices):
        MP3 = 'mp3', 'MP3'
        OPUS = 'opus', 'Opus'
        AAC = 'aac', 'AAC'
        FLAC = 'flac', 'FLAC'
        WAV = 'wav', 'WAV'

    title = models.CharField(max_length=255, blank=True)
    text_input = models.TextField()

    voice = models.CharField(max_length=100, choices=VOICE_CHOICES, default='en-US-JennyNeural')
    response_format = models.CharField(max_length=10, choices=ResponseFormat.choices, default=ResponseFormat.MP3)
    speed = models.FloatField(default=1.0, help_text="From 0.25 to 4.0")

    result_file = models.FileField(upload_to='audio_creations/', blank=True, null=True)

    def save(self, *args, **kwargs):
        if not self.title and self.text_input:
            self.title = self.text_input[:60] + '...' if len(self.text_input) > 60 else self.text_input
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Audio '{self.title}' for {self.user.email} ({self.status})"
