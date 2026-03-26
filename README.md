# 🚀 GenAI-Powered Customer Support Quality Auditor

Welcome to the **GenAI-Powered Customer Support Quality Auditor**, a comprehensive, full-stack intelligence platform for customer support teams. This project leverages state-of-the-art Generative AI to provide real-time transcription, deep contextual scoring, and automated compliance auditing.

## 🏗️ Project Architecture

This project is built with a modern, high-performance stack:
- **Backend**: Django REST Framework (Python)
- **Frontend**: Vite + React (JavaScript)
- **Transcription**: Deepgram Nova-2 (Speech-to-Text)
- **AI Engine**: OpenRouter (GPT-4o, Claude 3.5 Sonnet)
- **Vector Database**: Milvus (RAG over Policy Documents)
- **Database**: PostgreSQL (Neon) with SQLite fallback

---

## 🌟 Key Features

### 1. Advanced Transcription & Diarization
- High-speed transcription via Deepgram's **Nova-2** model.
- **Speaker Diarization**: Automatically separates Agent and Customer dialogue.
- Multi-language support and smart formatting.

### 2. Multi-Metric AI Scoring
- **Automated Quality Assurance (AQA)**: Scores interactions on Empathy, Resolution, Professionalism, and Compliance.
- **Metric Justification**: Detailed rationale for every score given.
- **Executive Summary**: 2-3 sentence overview of the interaction quality.

### 3. RAG-Powered Policy Compliance (Milestone 3)
- **Retrieval-Augmented Generation (RAG)**: Automatically cross-references transcripts with internal policy documents.
- **Semantic Search**: Find specific clauses or guidelines within the knowledge base.
- **Policy Ingestion**: Upload `.txt` or `.md` files to update the auditor's knowledge on-the-fly.

### 4. Real-time Monitoring & Alerts (Milestone 4)
- **Live Audit Streaming**: WebSocket-based (Django Channels) turn-by-turn audit feedback.
- **Smart Alerts**: Multi-channel notifications via Slack/Teams or Email for critical compliance breaches.
- **Compliance Radar**: Real-time risk prediction based on early call signals.

---

## 📂 Modules & Component Structure

- **/Milestone_2/backend**: Core Django project.
    - `processor/`: Handles the main transcription and LLM scoring pipeline.
    - `rag/`: Implements Vector DB (Milvus) logic and retrieval.
    - `realtime/`: WebSocket consumers for live audit streams.
    - `alerts/`: Notification dispatch and monitoring logic.
- **/Milestone_2/frontend**: React + Vite application.
    - `src/App.jsx`: Main dashboard interface.
    - `src/styles/theme.css`: Cyberpunk/Glassmorphism design system.

---

## 🛠️ Setup & Installation

### Backend
1. Navigate to `Milestone_2/backend`.
2. Create and activate a virtual environment: `python -m venv .venv`.
3. Install dependencies: `pip install -r requirements.txt`.
4. Configure `.env` (use `.env.example` as a template).
5. Run migrations: `python manage.py migrate`.
6. Start server: `python manage.py runserver`.

### Frontend
1. Navigate to `Milestone_2/frontend`.
2. Install dependencies: `npm install`.
3. Start development server: `npm run dev`.

---

## 📎 License
Copyright (c) 2026 Vidzai Digital. Licensed under the MIT License.
Refer to `license.txt` for details.
