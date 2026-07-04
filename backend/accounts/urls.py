from django.urls import path
from .views import GoogleLoginView, UserProfileView, UpgradeView
from rest_framework_simplejwt.views import (
    TokenRefreshView,
)

urlpatterns = [
    path('google/', GoogleLoginView.as_view(), name='google_login'),
    path('profile/', UserProfileView.as_view(), name='user_profile'),
    path('upgrade/', UpgradeView.as_view(), name='upgrade'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]
