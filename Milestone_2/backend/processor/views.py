import requests
import json
import os
import re
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from .models import AuditResult
from dotenv import load_dotenv

# Load .env file
load_dotenv()

# ==============================
# 🔑 API KEYS (From .env)
# ==============================
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL_NAME = "openai/gpt-3.5-turbo"

# ==============================
# 🎧 TRANSCRIBE USING DEEPGRAM (With Diarization)
# ==============================

def transcribe_with_deepgram(file_content):
    url = "https://api.deepgram.com/v1/listen?diarize=true&smart_format=true&model=nova-2"
    
    headers = {
        "Authorization": f"Token {DEEPGRAM_API_KEY}",
        "Content-Type": "audio/*"
    }

    try:
        response = requests.post(url, headers=headers, data=file_content, timeout=60)
    except requests.exceptions.Timeout:
        raise Exception("Deepgram API request timed out. Please check your network.")
    except requests.exceptions.ConnectionError:
        raise Exception("Could not connect to Deepgram API. Please check your internet connection.")

    if response.status_code != 200:
        raise Exception(f"Deepgram Error: {response.text}")

    result = response.json()
    
    # Process Diarization
    try:
        paragraphs = result.get("results", {}).get("channels", [{}])[0].get("alternatives", [{}])[0].get("paragraphs", {}).get("paragraphs", [])
        if paragraphs:
            dialogue = []
            full_text = ""
            for para in paragraphs:
                speaker_id = para.get('speaker', 0)
                speaker_label = "Agent" if speaker_id == 0 else "Customer"
                sentences = para.get("sentences", [])
                para_text = " ".join([s.get("text", "") for s in sentences])
                dialogue.append({
                    "speaker": speaker_label,
                    "text": para_text
                })
                full_text += f"[{speaker_label}]: {para_text}\n"
            return {"full_text": full_text, "dialogue": dialogue}
    except Exception as e:
        print(f"Diarization fallback: {e}")

    transcript = result["results"]["channels"][0]["alternatives"][0]["transcript"]
    return {"full_text": transcript, "dialogue": [{"speaker": "Unknown", "text": transcript}]}


# ==============================
# 🤖 QUALITY AUDIT ANALYSIS (Detailed Scoring)
# ==============================

def perform_quality_audit(input_text):
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost",
        "X-Title": "Support Quality Auditor Milestone 2"
    }

    system_prompt = """
You are a lead Quality Auditor for a customer support center.
Analyze the provided conversation and provide a detailed audit in JSON format.
STRICT JSON STRUCTURE (all fields required):
{
  "summary": "2-3 sentence summary of the interaction",
  "scores": {
    "empathy": 0-10,
    "resolution": 0-10,
    "professionalism": 0-10,
    "compliance": 0-10
  },
  "metric_justifications": {
    "empathy": "1-2 sentence explanation of why this empathy score was given",
    "resolution": "1-2 sentence explanation of why this resolution score was given",
    "professionalism": "1-2 sentence explanation of why this professionalism score was given",
    "compliance": "1-2 sentence explanation of why this compliance score was given"
  },
  "overall_score": 0-100,
  "sentiment": "Positive/Neutral/Negative",
  "agent_performance": "Excellent/Good/Satisfactory/Needs Improvement/Poor",
  "call_outcome": "Resolved/Partially Resolved/Unresolved/Escalated",
  "key_findings": ["Finding 1", "Finding 2", "Finding 3"],
  "improvement_tips": ["Tip 1", "Tip 2", "Tip 3"],
  "compliance_issues": []
}
Only return valid JSON. No extra text.
"""

    payload = {
        "model": MODEL_NAME,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": input_text}
        ],
        "temperature": 0.3,
        "response_format": { "type": "json_object" }
    }

    try:
        response = requests.post(OPENROUTER_URL, headers=headers, data=json.dumps(payload), timeout=60)
    except requests.exceptions.Timeout:
        raise Exception("OpenRouter API request timed out.")
    except requests.exceptions.ConnectionError:
        raise Exception("Could not connect to OpenRouter API.")

    if response.status_code != 200:
        raise Exception(f"OpenRouter Error: {response.text}")

    result = response.json()
    content = result["choices"][0]["message"]["content"]
    return json.loads(content)

# ==============================
# 🚀 API VIEWS
# ==============================

class AudioProcessView(APIView):
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, *args, **kwargs):
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({"error": "No file uploaded"}, status=400)
        
        try:
            # 1. Transcription
            transcription_data = transcribe_with_deepgram(file_obj.read())
            
            # 2. Audit
            audit_results = perform_quality_audit(transcription_data["full_text"])
            
            # 3. Persistence
            audit_record = AuditResult.objects.create(
                source_type='audio',
                filename=file_obj.name,
                transcript_json=transcription_data,
                audit_json=audit_results,
                overall_score=audit_results.get("overall_score", 0),
                sentiment=audit_results.get("sentiment", "Neutral")
            )
            
            return Response({
                "id": audit_record.id,
                "source": "audio",
                "transcript": transcription_data,
                "audit": audit_results
            })
        except Exception as e:
            return Response({"error": str(e)}, status=500)

class TextProcessView(APIView):
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, *args, **kwargs):
        content = request.data.get('content')
        file_obj = request.FILES.get('file')

        if file_obj:
            try:
                content = file_obj.read().decode('utf-8')
            except Exception:
                return Response({"error": "Could not read text file"}, status=400)
        
        if not content:
            return Response({"error": "No content provided"}, status=400)
        
        try:
            # Audit
            audit_results = perform_quality_audit(content)
            
            # Persistence
            audit_record = AuditResult.objects.create(
                source_type='text',
                filename=file_obj.name if file_obj else "Direct Input",
                transcript_json={"full_text": content, "dialogue": []},
                audit_json=audit_results,
                overall_score=audit_results.get("overall_score", 0),
                sentiment=audit_results.get("sentiment", "Neutral")
            )

            return Response({
                "id": audit_record.id,
                "source": "text",
                "content": content,
                "audit": audit_results
            })
        except Exception as e:
            return Response({"error": str(e)}, status=500)

class HistoryListView(APIView):
    def get(self, request):
        history = AuditResult.objects.all().order_by('-created_at')[:10]
        data = [{
            "id": h.id,
            "source": h.source_type,
            "filename": h.filename,
            "score": h.overall_score,
            "sentiment": h.sentiment,
            "date": h.created_at.strftime('%Y-%m-%d %H:%M'),
            "audit": h.audit_json,
            "transcript": h.transcript_json
        } for h in history]
        return Response(data)

class DiagnosticView(APIView):
    def get(self, request):
        results = {}
        # Test Deepgram
        try:
            dg_resp = requests.get("https://api.deepgram.com/v1/projects", 
                                  headers={"Authorization": f"Token {DEEPGRAM_API_KEY}"}, 
                                  timeout=10)
            results["deepgram"] = "Connected" if dg_resp.status_code in [200, 401, 403] else f"Error: {dg_resp.status_code}"
        except Exception as e:
            results["deepgram"] = f"Timeout/Error: {str(e)}"

        # Test OpenRouter
        try:
            or_resp = requests.get("https://openrouter.ai/api/v1/models", timeout=10)
            results["openrouter"] = "Connected" if or_resp.status_code == 200 else f"Error: {or_resp.status_code}"
        except Exception as e:
            results["openrouter"] = f"Timeout/Error: {str(e)}"
            
        return Response(results)
