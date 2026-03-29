import random
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from rest_framework.parsers import JSONParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import EmailOTP, UserProfile

User = get_user_model()


def _smtp_ready():
    user = getattr(settings, "EMAIL_HOST_USER", "")
    password = getattr(settings, "EMAIL_HOST_PASSWORD", "")
    return bool(user and password and "your@" not in user and "your-app-password" not in password)


def _generate_otp():
    return f"{random.randint(0, 999999):06d}"


class LoginView(APIView):
    parser_classes = (JSONParser,)

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        password = request.data.get("password") or ""
        if not email or not password:
            return Response({"error": "Email and password are required."}, status=400)

        user = authenticate(username=email, password=password)
        if not user:
            return Response({"error": "Invalid email or password."}, status=400)

        profile, _ = UserProfile.objects.get_or_create(user=user)
        return Response({
            "user": {
                "email": user.email,
                "username": user.username,
                "role": profile.role,
            }
        })


class RequestOTPView(APIView):
    parser_classes = (JSONParser,)

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        password = request.data.get("password") or ""
        role = (request.data.get("role") or "Supervisor").strip() or "Supervisor"

        if not email or not password:
            return Response({"error": "Email and password are required."}, status=400)
        if User.objects.filter(username=email).exists():
            return Response({"error": "A user with this email already exists. Please log in."}, status=400)
        if not _smtp_ready():
            return Response({"error": "SMTP is not configured. Update SMTP_USER and SMTP_PASSWORD in backend/.env first."}, status=400)

        EmailOTP.objects.filter(email=email, is_used=False).update(is_used=True)
        otp = _generate_otp()
        expiry = timezone.now() + timedelta(minutes=10)
        EmailOTP.objects.create(email=email, otp_code=otp, password=password, role=role, expires_at=expiry)

        send_mail(
            subject="Your AI Auditor verification code",
            message=f"Your OTP is {otp}. It expires in 10 minutes.",
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", getattr(settings, "EMAIL_HOST_USER", None)),
            recipient_list=[email],
            fail_silently=False,
        )

        return Response({"message": "OTP sent to your email.", "email": email})


class VerifyOTPRegisterView(APIView):
    parser_classes = (JSONParser,)

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        otp = (request.data.get("otp") or "").strip()
        if not email or not otp:
            return Response({"error": "Email and OTP are required."}, status=400)

        record = EmailOTP.objects.filter(email=email, is_used=False).order_by("-created_at").first()
        if not record:
            return Response({"error": "No pending OTP found for this email."}, status=400)
        if record.is_expired():
            record.is_used = True
            record.save(update_fields=["is_used"])
            return Response({"error": "OTP expired. Request a new one."}, status=400)
        if record.otp_code != otp:
            return Response({"error": "Invalid OTP."}, status=400)
        if User.objects.filter(username=email).exists():
            record.is_used = True
            record.save(update_fields=["is_used"])
            return Response({"error": "User already exists. Please log in."}, status=400)

        with transaction.atomic():
            user = User.objects.create_user(username=email, email=email, password=record.password)
            UserProfile.objects.create(user=user, role=record.role)
            record.is_used = True
            record.save(update_fields=["is_used"])

        return Response({
            "message": "Account created successfully.",
            "user": {
                "email": user.email,
                "username": user.username,
                "role": record.role,
            }
        })

