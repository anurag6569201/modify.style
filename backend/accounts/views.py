from rest_framework import views, status
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.models import User
from rest_framework.permissions import AllowAny, IsAuthenticated
import requests

from .models import UserProfile


def _plan_for(user) -> str:
    """Return the user's plan, creating a default (free) profile if missing."""
    profile, _ = UserProfile.objects.get_or_create(user=user)
    return profile.plan


class GoogleLoginView(views.APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        token = request.data.get('token')
        if not token:
            return Response({'error': 'No token provided'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Verify token with Google
            google_response = requests.get(
                f'https://www.googleapis.com/oauth2/v3/userinfo?access_token={token}'
            )

            if not google_response.ok:
                 return Response({'error': 'Invalid token'}, status=status.HTTP_400_BAD_REQUEST)

            user_data = google_response.json()
            email = user_data.get('email')
            name = user_data.get('name', '')

            if not email:
                return Response({'error': 'Email not found in token'}, status=status.HTTP_400_BAD_REQUEST)

            # Get or create user
            user, created = User.objects.get_or_create(username=email, defaults={'email': email})

            # Ensure a profile (and thus a plan) exists for this user.
            UserProfile.objects.get_or_create(user=user)

            # Generate JWT tokens
            refresh = RefreshToken.for_user(user)

            return Response({
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            })

        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class UserProfileView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response({
            'username': user.username,
            'email': user.email,
            'plan': _plan_for(user),
        })


class UpgradeView(views.APIView):
    """
    Placeholder upgrade endpoint. Flips the caller's plan so paid features can
    be exercised end-to-end before real payment/checkout (Stripe) is wired up.

    POST body: {"plan": "pro" | "free"}  (defaults to "pro")
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        requested = request.data.get('plan', UserProfile.Plan.PRO)
        if requested not in UserProfile.Plan.values:
            return Response(
                {'error': f'Unknown plan: {requested}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        profile.plan = requested
        profile.save(update_fields=['plan', 'updated_at'])

        return Response({'plan': profile.plan})
