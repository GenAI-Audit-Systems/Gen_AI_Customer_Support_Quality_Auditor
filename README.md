# 🚀 GenAI-Powered Customer Support Quality Auditor

![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)
![React](https://img.shields.io/badge/React-18.x-61DAFB.svg?logo=react&logoColor=black)
![LangChain](https://img.shields.io/badge/LangChain-Enabled-green.svg)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o-black.svg)
![Status](https://img.shields.io/badge/Status-Milestone_2_Completed-success.svg)

## 📖 Project Statement
This project aims to build a **GenAI-powered quality auditing platform** that reviews customer support chats and calls, assigns quality scores, detects compliance violations, and suggests improvements in real time. 

By combining NLP, RAG pipelines, and speech-to-text transcription, the platform leverages LLMs to evaluate tone, empathy, compliance with scripts, and resolution effectiveness. Designed for enterprises, BPOs, and SaaS companies, the solution enhances customer experience, ensures compliance, and reduces manual QA workload.

---

## 🎯 Key Outcomes
- **Automated analysis** of chat and call transcripts.
- **LLM-based scoring** of quality metrics (empathy, resolution, compliance).
- **Real-time detection** of compliance breaches.
- **RAG-powered contextual feedback** and improvement suggestions.
- **Dashboards for supervisors** with agent-wise analytics.

---

## 🧩 Modules & Technology Rationale (Why we use what we use)

To achieve a fully automated QA system, the architecture is broken down into five core modules. Here is an explanation of what they do and **why** specific technologies were chosen:

### 1. Data Ingestion & Transcription Layer
*   **What it does:** Processes raw chat logs and transcribes audio calls into structured text.
*   **Tech Used:** **OpenAI Whisper STT**.
*   **Why it's used:** Traditional transcription tools struggle with accents, background noise, and industry jargon. Whisper is a state-of-the-art neural net that provides highly accurate speech-to-text transcription, ensuring the LLM gets clean data to analyze.

### 2. Quality Scoring & Compliance Engine
*   **What it does:** Scores empathy, professionalism, and flags violations.
*   **Tech Used:** **LLMs (GPT-4 / Llama)**.
*   **Why it's used:** Rule-based NLP (like searching for specific keywords) cannot understand human emotion, tone, or sarcasm. LLMs can dynamically "understand" the context of a conversation to accurately judge if an agent was truly empathetic or successfully resolved an issue.

### 3. RAG Pipeline for Contextual Audits
*   **What it does:** Checks agent responses against internal company policy documents.
*   **Tech Used:** **LangChain + Pinecone/FAISS**.
*   **Why it's used:** LLMs are prone to "hallucinations" (making things up). By using Retrieval-Augmented Generation (RAG) and Vector Databases (Pinecone/FAISS), we force the LLM to read the *actual company rulebook* before judging the agent's compliance, ensuring 100% accurate auditing.

### 4. Dashboard & Visualization Hub
*   **What it does:** Displays real-time analytics and agent-wise performance.
*   **Tech Used:** **React (Frontend) / FastAPI (Backend)**.
*   **Why it's used:** React provides a highly responsive, component-based UI perfect for building live data dashboards (using charts and tables). It allows supervisors to instantly see trends without refreshing the page.

### 5. Alerting & Reporting Module
*   **What it does:** Sends alerts for critical compliance issues and exports reports.
*   **Tech Used:** PDF/Excel generation libraries + automated email triggers.
*   **Why it's used:** Supervisors don't have time to stare at a dashboard all day. Automated alerts push critical issues (e.g., an agent swearing or breaking legal compliance) to management instantly.

---

## 📍 Current Focus: Milestone 2 & React Frontend

We are currently at the end of **Week 4**, having successfully completed Data Ingestion (Milestone 1) and the LLM Scoring Engine (Milestone 2). The current repository focus is connecting this backend logic to our React Supervisor Dashboard using a rapid "Vibe Coding" approach (leveraging AI coding assistants).

### 📂 Project Structure

```text
Gen_AI_Customer_Support_Quality_Auditor/
│
├── backend/                       # Python / FastAPI Backend
│   ├── sample_data/               # Chat and Call transcripts
│   ├── prompts/                   # System prompts for scoring
│   ├── scoring_engine.py          # LLM pipeline (GPT/Llama integration)
│   ├── app.py                     # API endpoints to serve data to React
│   └── requirements.txt           
│
├── frontend/                      # React Supervisor Dashboard
│   ├── public/
│   ├── src/
│   │   ├── components/            # UI Components (Charts, Cards, Tables)
│   │   │   ├── ScoreCard.jsx      # Displays Empathy, Compliance scores
│   │   │   ├── TranscriptView.jsx # Highlights compliance breaches in text
│   │   │   └── AgentTable.jsx     # Lists agents and their average scores
│   │   ├── pages/                 # Main Dashboard View
│   │   ├── services/              # API calls to Python backend
│   │   └── App.jsx
│   ├── package.json
│   └── tailwind.config.js
│
└── README.md
