from django.contrib import admin
from django.http import HttpResponse
from django.urls import include, path


def home(request):
    return HttpResponse("Backend is running successfully")


urlpatterns = [
    path("", home),
    path("admin/", admin.site.urls),
    path("api/auth/", include("auth_api.urls")),
    path("api/", include("processor.urls")),
    path("api/rag/", include("rag.urls")),
    path("api/alerts/", include("alerts.urls")),
]
