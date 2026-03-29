# GenAI Customer Support Quality Auditor

Full-stack AI quality monitoring platform for customer support teams. The app audits uploaded calls and typed conversations, scores agent performance, tracks compliance risk, streams live audit feedback, and gives supervisors a dashboard for alerts and coaching.

## Stack

- Backend: Django, Django REST Framework, Django Channels
- Frontend: React, Vite, Recharts
- Database: PostgreSQL via `DATABASE_URL` with local SQLite fallback
- Speech-to-text: Deepgram
- LLM providers: OpenRouter, Groq, Together
- RAG / policy search: Milvus Lite or external Milvus

## Main Features

- Batch audit for text and audio conversations
- Live audit stream with WebSocket or HTTP fallback
- Compliance alerts and recent alert history
- Supervisor dashboard with agent performance analytics
- User-scoped data so each signed-in user sees only their own history
- Email OTP signup flow for new users
- Policy ingestion and semantic search for RAG-backed auditing
- Export-ready analytics endpoints

## Demo Video
https://github.com/user-attachments/assets/cec23a93-c9b0-4224-859a-825f680a2b82

## Project Structure

- `Milestone_2/backend`
  Django backend, APIs, auth, audit engine, alerts, live streaming
- `Milestone_2/frontend`
  React frontend for login, dashboard, live audit, alerts, history

## Local Development

### 1. Backend

From the repository root:

```powershell
cd c:\Users\kpriy\Desktop\Milestone2
.\.venv\Scripts\Activate.ps1
cd .\Milestone_2\backend
python manage.py migrate
python manage.py runserver 127.0.0.1:8001
```

Backend URL:

```text
http://127.0.0.1:8001/
```

### 2. Frontend

In a second terminal:

```powershell
cd c:\Users\kpriy\Desktop\Milestone2\Milestone_2\frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

Frontend URL:

```text
http://127.0.0.1:5173/login
```

## Environment Variables

Backend settings live in:

- `Milestone_2/backend/.env`
- `Milestone_2/backend/.env.example`

Frontend settings live in:

- `Milestone_2/frontend/.env`

Minimum backend values:

```env
DJANGO_SECRET_KEY=change-me
DEBUG=True
ALLOWED_HOSTS=127.0.0.1,localhost,.onrender.com
DATABASE_URL=postgresql://...
ACTIVE_LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=your-real-key
DEEPGRAM_API_KEY=your-real-key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
DEFAULT_FROM_EMAIL=your_email@gmail.com
MILVUS_URI=./milvus_local.db
REDIS_URL=redis://localhost:6379
```

Frontend API configuration:

```env
VITE_API_URL=http://127.0.0.1:8001/api/
```

## Authentication

- Existing users sign in with email and password
- New users can register with email, password, and role
- Signup sends an OTP to the user email
- OTP email requires valid `SMTP_USER` and `SMTP_PASSWORD` in `backend/.env`

If SMTP is missing or invalid, OTP signup will fail.

## Common Commands

Backend checks:

```powershell
cd c:\Users\kpriy\Desktop\Milestone2\Milestone_2\backend
python manage.py check
python manage.py migrate
```

Frontend production build:

```powershell
cd c:\Users\kpriy\Desktop\Milestone2\Milestone_2\frontend
npm run build
```

## Key Pages

- `/login`
  Login and OTP-based new user registration
- `/`
  Supervisor dashboard
- `/batch`
  Upload audio or text for full audit
- `/live`
  Live audit stream console
- `/alerts`
  Compliance violations and alert history

## Data Storage

Main application data is stored in the database configured by `DATABASE_URL`.

Typical stored records:

- user profiles
- OTP verification records
- audit results
- alert records
- analytics source data

Milvus vectors are stored through `MILVUS_URI`.

## Render Deployment Notes

The project is close to Render-ready, but production deployment should confirm:

- Render backend service points to `Milestone_2/backend`
- Render build installs Python dependencies and runs migrations
- Render start command runs Daphne or Gunicorn-compatible ASGI startup
- `ALLOWED_HOSTS` includes the Render domain
- frontend `VITE_API_URL` points to the deployed backend API
- production SMTP credentials are configured
- production Postgres is configured in `DATABASE_URL`
- if using Channels in production, use Redis instead of in-memory layers

Recommended backend start command for ASGI deployment:

```powershell
daphne -b 0.0.0.0 -p 10000 django_backend.asgi:application
```

## Troubleshooting

- `Only one usage of each socket address`
  Port is already in use. Run the backend on a different port or stop the old process.
- `SMTP is not configured`
  Add real `SMTP_USER` and `SMTP_PASSWORD` to `backend/.env`.
- `All LLM providers failed`
  Add at least one real provider key in `backend/.env`.
- Dashboard shows no user data
  Make sure you are signed in and the frontend is calling the correct backend API.
- Live audit socket not connected
  Confirm backend is running and frontend `VITE_API_URL` points to the right host and port.

## License

MIT License. See `license.txt`.
