"""
Django app configuration for the API application.
"""

from django.apps import AppConfig


class ApiConfig(AppConfig):
    """Configuration for the API application."""
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'

