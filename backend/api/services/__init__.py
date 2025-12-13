"""
Services layer for business logic.
Separates business logic from views for better maintainability.
"""

from .proxy_service import ProxyService, ResourceProxyService

__all__ = ['ProxyService', 'ResourceProxyService']

