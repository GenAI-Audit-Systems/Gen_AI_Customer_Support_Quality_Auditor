from django.conf import settings
from django.db import models
from django.utils import timezone


class UserProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    role = models.CharField(max_length=32, default="Supervisor")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} ({self.role})"


class EmailOTP(models.Model):
    email = models.EmailField(db_index=True)
    otp_code = models.CharField(max_length=6)
    password = models.CharField(max_length=128)
    role = models.CharField(max_length=32, default="Supervisor")
    is_used = models.BooleanField(default=False)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def is_expired(self):
        return timezone.now() >= self.expires_at

