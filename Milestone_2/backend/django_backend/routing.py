# ══════════════════════════════════════════════════════════════════════
# ASGI Routing — Django Channels protocol router
# Handles both HTTP (existing DRF API) and WebSocket (Milestone 3 realtime)
# ══════════════════════════════════════════════════════════════════════
import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_backend.settings')

from realtime.routing import websocket_urlpatterns  # noqa: E402

application = ProtocolTypeRouter({
    # Existing HTTP API — completely unchanged
    "http": get_asgi_application(),
    # New: WebSocket for real-time audit streaming
    "websocket": AuthMiddlewareStack(
        URLRouter(websocket_urlpatterns)
    ),
})
