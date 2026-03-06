"""
WSGI config for django_backend project.
"""

import os
from django.core.wsgi import get_wsgi_application
from django.core.management import call_command

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_backend.settings')

# Run migrations automatically (important for serverless deployment)
try:
    call_command("migrate", interactive=False)
except Exception as e:
    print("Migration error:", e)

application = get_wsgi_application()

# Vercel entrypoint
app = application