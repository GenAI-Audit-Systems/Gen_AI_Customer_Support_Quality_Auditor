from django.urls import path

from .views import LoginView, RequestOTPView, VerifyOTPRegisterView


urlpatterns = [
    path("login/", LoginView.as_view(), name="auth-login"),
    path("request-otp/", RequestOTPView.as_view(), name="auth-request-otp"),
    path("verify-register/", VerifyOTPRegisterView.as_view(), name="auth-verify-register"),
]

