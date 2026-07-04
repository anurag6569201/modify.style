from django.conf import settings
from django.db import models


class UserProfile(models.Model):
    """
    Per-user account metadata. Currently just the subscription plan.

    `plan` is the entitlement flag the frontend reads to gate paid features.
    Real payment/checkout (Stripe) is a follow-up — for now the plan is flipped
    by the /api/auth/upgrade/ stub so paid features can be exercised end-to-end.
    """

    class Plan(models.TextChoices):
        FREE = 'free', 'Free'
        PRO = 'pro', 'Pro'

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='profile',
    )
    plan = models.CharField(
        max_length=16, choices=Plan.choices, default=Plan.FREE
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f'{self.user.username} ({self.plan})'
