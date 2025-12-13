"""
Database models for the modify.style application.
"""

from django.db import models


class BaseModel(models.Model):
    """
    Abstract base model providing common timestamp fields.
    All models should inherit from this for consistent timestamps.
    """
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class ExampleModel(BaseModel):
    """
    Example model for demonstration purposes.
    Can be modified or removed based on application needs.
    """
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Example'
        verbose_name_plural = 'Examples'

    def __str__(self):
        return self.name

