# 🚀 GenAI-Powered Customer Support Quality Auditor
## 📍 Milestone 2: Advanced Scoring Engine & Premium UI

![Django](https://img.shields.io/badge/Django-092E20?style=for-the-badge&logo=django&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)
![Deepgram](https://img.shields.io/badge/Deepgram-STT-101C26?style=for-the-badge)
![OpenRouter](https://img.shields.io/badge/OpenRouter-LLM-blue?style=for-the-badge)
![Framer Motion](https://img.shields.io/badge/Framer_Motion-black?style=for-the-badge&logo=framer)

## 📖 Milestone 2 Overview
Welcome to **Milestone 2** of the GenAI-Powered Customer Support Quality Auditor. 

While Milestone 1 laid the groundwork for basic transcription, Milestone 2 transforms the project into a highly interactive, full-stack application. We have implemented a powerful **Django API backend** integrated with **Deepgram** for high-speed, multi-language transcription and **OpenRouter** (GPT-4o / Claude 3.5 Sonnet) for deep contextual scoring. 

On the frontend, we have adopted a lightning-fast **Vite + React architecture**, styled with a premium **Cyberpunk/Minimalist** design system featuring glassmorphism, dark mode, and smooth Framer Motion animations.

---

## ✨ Key Features Implemented in Milestone 2

### 🎨 Premium Frontend (Vite + React)
- **Modern UI/UX:** A sleek "Cyberpunk/Minimalist" aesthetic utilizing CSS variables, smooth gradients, dark mode, and glassmorphism.
- **Drag-and-Drop Upload:** Intuitive audio file upload zone supporting `.m4a`, `.mp3`, and `.wav` formats.
- **Real-Time Display:** Live transcript rendering paired with interactive charts visualizing sentiment and quality scores.
- **Fluid Animations:** Powered by **Framer Motion** for elegant entrance/exit animations of results cards and dashboard elements.

### 🧠 Advanced Backend (Django REST API)
- **Deepgram Diarization:** Enhanced Speech-to-Text (STT) that automatically separates speakers (e.g., distinguishing the Agent from the Customer).
- **Multi-Language Support:** The transcription layer now supports multiple languages natively via Deepgram.
- **OpenRouter LLM Integration:** Routes transcripts through top-tier models (GPT-4o or Claude 3.5 Sonnet) to generate strict JSON evaluations.
- **Audit Scoring:** AI accurately scores metrics including **Empathy, Resolution, Professionalism, and Compliance**.
- **History Management API:** Endpoints to store and fetch previous audit results.
- **Export Capabilities:** Instantly export generated audit reports into **PDF format** for supervisors.

---

## ⚙️ Architecture & Data Flow

1. **Upload:** User drops an audio file into the React (Vite) frontend.
2. **Transcription:** The file is sent to the Django backend, which proxies it to the **Deepgram API**. Deepgram returns a highly accurate, multi-language transcript with speaker diarization.
3. **Analysis:** Django sends the diarized transcript to **OpenRouter** with a strict system prompt. The LLM (Claude 3.5 / GPT-4o) acts as the QA Auditor and returns a structured JSON evaluation.
4. **Visualization:** The React frontend receives the JSON, triggering Framer Motion animations to reveal Score Cards, Sentiment Charts, and the flagged transcript.

---

## 📂 Project Structure

```text
Milestone_2/
│
├── backend/                       # Django REST API
│   ├── manage.py
│   ├── core/                      # Main Django project settings
│   ├── auditor/                   # App handling transcription & LLM logic
│   │   ├── views.py               # API endpoints (Upload, History, Export)
│   │   ├── services/
│   │   │   ├── deepgram_service.py # Diarization & STT logic
│   │   │   └── openrouter_service.py# LLM scoring prompts & routing
│   │   └── models.py              # Database models for Audit History
│   └── requirements.txt
│
├── frontend/                      # React + Vite Application
│   ├── package.json
│   ├── vite.config.js
│   ├── src/
│   │   ├── components/            
│   │   │   ├── DragDropZone.jsx   # Audio upload component
│   │   │   ├── AnimatedScoreCard.jsx # Framer Motion score UI
│   │   │   └── InteractiveChart.jsx  # Recharts sentiment visualization
│   │   ├── styles/
│   │   │   └── theme.css          # Cyberpunk/Glassmorphism CSS variables
│   │   ├── services/              # Axios API calls to Django
│   │   └── App.jsx
│   └── index.html
│
└── README.md
