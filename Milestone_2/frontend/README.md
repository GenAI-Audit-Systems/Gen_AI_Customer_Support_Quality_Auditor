# GenAI Customer Support Quality Auditor

This project is a full-stack AI-powered customer support quality monitoring platform. It helps teams audit support conversations, detect compliance issues, measure agent performance, monitor live conversations, and review alerts through a dashboard built for supervisors and team leads.

## What This Project Does

The platform analyzes customer support interactions from text or audio and produces:

- overall quality scores
- empathy and compliance scores
- compliance issue detection with severity
- supervisor alerts
- live audit feedback
- agent-level dashboard analytics
- user-specific history and reporting

It is designed for QA teams, team leads, and compliance reviewers who need both automation and visibility into support quality.

## Core Modules

### Frontend

Location:

`Milestone_2/frontend`

Tech:

- React
- Vite
- Recharts
- Framer Motion
- Lucide React

Main frontend responsibilities:

- login and OTP signup flow
- batch audit upload flow
- live audit simulation console
- supervisor dashboard
- alerts and compliance reporting
- user-scoped history views

### Backend

Location:

`Milestone_2/backend`

Tech:

- Django
- Django REST Framework
- Django Channels

Main backend responsibilities:

- authentication and OTP verification
- transcript and audit processing
- LLM provider routing
- policy-aware RAG auditing
- alert generation and alert history
- analytics aggregation
- live streaming endpoints

## Major Features

### 1. Batch Audit

Users can submit:

- audio files
- direct text conversations

The system processes the content and returns:

- transcript
- overall score
- sentiment
- compliance issues
- dimension scores
- recommendations

### 2. Live Audit Stream

The Live Audit page lets a user type a running conversation turn by turn. The backend analyzes the conversation in near real time and updates the audit output continuously.

This is useful for:

- demoing live QA support
- testing policy risk
- showing supervisors real-time audit behavior

### 3. Compliance Alerts

The alerts system tracks risky or low-quality interactions and classifies them by severity such as:

- critical
- warning
- info

Examples of triggers:

- asking for sensitive information
- misleading refund guidance
- poor empathy
- low quality score

### 4. Supervisor Dashboard

The dashboard shows:

- recent compliance alerts
- agent performance grid
- average quality scores
- compliance score trends
- sentiment volume plots
- risk levels by agent

Each signed-in user sees only their own relevant data.

### 5. Authentication and New User Signup

The app supports:

- existing user login with email and password
- new user registration
- email OTP verification

The username is the user email. The password is chosen by the user during signup.

### 6. RAG and Policy Search

The backend can ingest policy documents and use them during audits. This lets the system compare agent conversations against policy and produce evidence-based compliance feedback.

## Folder Structure

### Frontend

- `src/pages/LoginPage.jsx`
  Login and registration UI
- `src/pages/BatchAuditPage.jsx`
  Batch upload and audit history
- `src/pages/LiveAuditPage.jsx`
  Live conversation testing page
- `src/pages/SupervisorDashboard.jsx`
  Dashboard with charts and agent performance
- `src/pages/AlertsPage.jsx`
  Compliance alert reporting page
- `src/MainLayout.jsx`
  Shared layout, sidebar, signed-in user card
- `src/main.jsx`
  Routing and app bootstrap

### Backend

- `backend/auth_api`
  User signup, OTP flow, login APIs
- `backend/processor`
  Main audit record models and processing APIs
- `backend/rag`
  RAG auditing, analytics, semantic policy search
- `backend/alerts`
  Alert engine and alert history APIs
- `backend/realtime`
  Live audit streaming logic

## How the App Works

### User Flow

1. User opens the login page.
2. Existing users sign in with email and password.
3. New users register and verify OTP from email.
4. User accesses dashboard, live audit, batch audit, and alerts pages.
5. Data shown is scoped to the signed-in user.

### Audit Flow

1. User uploads text or audio, or enters conversation text in live mode.
2. Backend processes transcript content.
3. LLM provider performs scoring and issue detection.
4. Audit result is saved in the database.
5. Alert engine generates alerts if risk thresholds are met.
6. Dashboard and alerts page reflect the latest saved results.

## Environment Configuration

### Backend `.env`

The backend reads:

`Milestone_2/backend/.env`

Example important settings:

```env
DJANGO_SECRET_KEY=change-me
DEBUG=True
ALLOWED_HOSTS=127.0.0.1,localhost,.onrender.com
DATABASE_URL=postgresql://user:password@host:port/dbname

ACTIVE_LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=your-real-openrouter-key
GROQ_API_KEY=your-real-groq-key
TOGETHER_API_KEY=your-real-together-key
DEEPGRAM_API_KEY=your-real-deepgram-key

MILVUS_URI=./milvus_local.db
REDIS_URL=redis://localhost:6379

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
DEFAULT_FROM_EMAIL=your_email@gmail.com
```

Notes:

- use real API keys, not placeholders
- OTP signup needs working SMTP credentials
- at least one LLM provider key must be valid

### Frontend `.env`

The frontend reads:

`Milestone_2/frontend/.env`

Example:

```env
VITE_API_URL=http://127.0.0.1:8001/api/
```

## Local Run Commands

### Backend

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

### Frontend

In another terminal:

```powershell
cd c:\Users\kpriy\Desktop\Milestone2\Milestone_2\frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

Frontend URL:

```text
http://127.0.0.1:5173/login
```

## Common Test Scenarios

### Safe Conversation Example

```text
Agent: Hello, thank you for calling support. How can I help you today?
Customer: I was charged twice for my subscription.
Agent: I’m sorry about that. I’ll review the account and help you with the refund process.
```

### Risky Conversation Example

```text
Agent: Give me your full card number and CVV.
Customer: It is 4485221190874421 and 327.
Agent: I will not transfer you to a supervisor.
```

### Live Audit Short Sample

```text
C: I canceled last week, but I was still charged today.
```

## Data Storage

Application data is stored primarily in the backend database configured by `DATABASE_URL`.

Examples of stored data:

- users
- OTP verification records
- audit results
- alert records
- user-scoped history

Vector search data is stored via `MILVUS_URI`.

## Deployment Readiness

The app is close to deployment-ready, but production deployment should verify:

- backend start command for ASGI deployment
- correct production database URL
- valid SMTP setup
- production-safe API keys
- Redis for Channels in production
- Render domain added to `ALLOWED_HOSTS`
- frontend API URL pointing to the deployed backend

Suggested ASGI start command:

```powershell
daphne -b 0.0.0.0 -p 10000 django_backend.asgi:application
```

## Known Operational Notes

- if port `8000` is already in use, the backend can run on `8001`
- the frontend must point to the same backend port via `VITE_API_URL`
- if SMTP is misconfigured, OTP signup will fail
- if no LLM key is valid, audit processing will fail
- if the backend is down, dashboard and alerts pages will appear empty

## Commands for Verification

Backend:

```powershell
cd c:\Users\kpriy\Desktop\Milestone2\Milestone_2\backend
python manage.py check
python manage.py migrate
```

Frontend:

```powershell
cd c:\Users\kpriy\Desktop\Milestone2\Milestone_2\frontend
npm run build
```

## License

MIT License. See `license.txt` for details.
