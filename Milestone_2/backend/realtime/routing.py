from django.urls import re_path
from .consumers import AuditStreamConsumer, SupervisorConsumer

websocket_urlpatterns = [
    re_path(r"ws/audit/(?P<session_id>[^/]+)/$",      AuditStreamConsumer.as_view()),
    re_path(r"ws/supervisor/(?P<room_id>[^/]+)/$",    SupervisorConsumer.as_view()),
]
