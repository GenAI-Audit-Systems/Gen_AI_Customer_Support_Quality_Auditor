from django.contrib import admin
from django.urls import path, include
from django.http import HttpResponse

def home(request):
    return HttpResponse("Backend is running successfully")

urlpatterns = [
    path('', home),  # root route
    path('admin/', admin.site.urls),
    path('api/', include('processor.urls')),           # existing — untouched
    path('api/rag/',    include('rag.urls')),
    path('api/alerts/', include('alerts.urls')),
]