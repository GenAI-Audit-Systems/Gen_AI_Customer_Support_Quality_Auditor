FROM python:3.11-slim AS base

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY backend/ .

# Collect static files
RUN python manage.py collectstatic --noinput || true

EXPOSE 8000

# Use Daphne (ASGI) to support both HTTP and WebSocket
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "django_backend.routing:application"]
