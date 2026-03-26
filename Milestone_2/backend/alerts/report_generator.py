# ══════════════════════════════════════════════════════════════════════
# PDF Report Generator — ReportLab
# Generates multi-page professional audit reports
# ══════════════════════════════════════════════════════════════════════
import io
from datetime import datetime

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
        HRFlowable, PageBreak,
    )
    from reportlab.lib.enums import TA_CENTER, TA_LEFT
    RL_AVAILABLE = True
except ImportError:
    RL_AVAILABLE = False


# ── Brand colours ──────────────────────────────────────────────────────
PURPLE = colors.HexColor("#6366f1")
VIOLET = colors.HexColor("#8b5cf6")
GREEN  = colors.HexColor("#34d399")
AMBER  = colors.HexColor("#fbbf24")
RED    = colors.HexColor("#f87171")
DARK   = colors.HexColor("#0f172a")
LIGHT  = colors.HexColor("#f8fafc")


def _score_color(score: float):
    if score >= 75:
        return GREEN
    if score >= 50:
        return AMBER
    return RED


def generate_pdf_report(audit_record) -> bytes:
    """
    Generate a professional PDF audit report.
    `audit_record` is a processor.AuditResult model instance or dict with:
        id, filename, overall_score, sentiment, audit_json, transcript_json, created_at
    Returns raw PDF bytes.
    """
    if not RL_AVAILABLE:
        return b"%PDF-1.4 placeholder - install reportlab"

    buf    = io.BytesIO()
    doc    = SimpleDocTemplate(buf, pagesize=A4,
                               rightMargin=2*cm, leftMargin=2*cm,
                               topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()
    story  = []

    # Helper styles
    h1 = ParagraphStyle("h1", parent=styles["Heading1"],
                         textColor=PURPLE, fontSize=22, spaceAfter=6)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"],
                         textColor=VIOLET, fontSize=14, spaceBefore=14, spaceAfter=6)
    body = ParagraphStyle("body", parent=styles["Normal"],
                           fontSize=10, leading=15, textColor=DARK)
    small = ParagraphStyle("small", parent=styles["Normal"],
                            fontSize=9, textColor=colors.grey)

    def hr():
        return HRFlowable(width="100%", thickness=0.5, color=PURPLE, spaceAfter=8)

    # Extract data
    if hasattr(audit_record, "audit_json"):
        audit      = audit_record.audit_json or {}
        transcript = audit_record.transcript_json or {}
        filename   = audit_record.filename or "N/A"
        score      = audit_record.overall_score or 0
        sentiment  = audit_record.sentiment or "Neutral"
        created    = audit_record.created_at.strftime("%Y-%m-%d %H:%M UTC") \
                     if hasattr(audit_record.created_at, "strftime") else str(audit_record.created_at)
        rec_id     = audit_record.id
    else:
        audit      = audit_record.get("audit_json", {})
        transcript = audit_record.get("transcript_json", {})
        filename   = audit_record.get("filename", "N/A")
        score      = audit_record.get("overall_score", 0)
        sentiment  = audit_record.get("sentiment", "Neutral")
        created    = str(audit_record.get("created_at", datetime.now()))
        rec_id     = audit_record.get("id", "?")

    scores = audit.get("scores", {})
    justs  = audit.get("metric_justifications", {})

    # ── Cover ────────────────────────────────────────────────────────
    story.append(Spacer(1, 1.5*cm))
    story.append(Paragraph("AI Auditor", h1))
    story.append(Paragraph("Customer Support Quality Report", styles["Heading2"]))
    story.append(hr())
    meta = [
        ["Audit ID",   str(rec_id)],
        ["File",       filename],
        ["Date",       created],
        ["Sentiment",  sentiment],
        ["Score",      f"{score} / 100"],
    ]
    t = Table(meta, colWidths=[4*cm, 12*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (0,-1), LIGHT),
        ("TEXTCOLOR",  (0,0), (0,-1), PURPLE),
        ("FONTNAME",   (0,0), (-1,-1), "Helvetica"),
        ("FONTSIZE",   (0,0), (-1,-1), 10),
        ("ROWBACKGROUNDS", (0,0), (-1,-1), [LIGHT, colors.white]),
        ("GRID", (0,0), (-1,-1), 0.25, colors.lightgrey),
        ("PADDING", (0,0), (-1,-1), 6),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.5*cm))

    # ── Summary ──────────────────────────────────────────────────────
    story.append(Paragraph("Executive Summary", h2))
    story.append(Paragraph(audit.get("summary", "No summary available."), body))
    story.append(Spacer(1, 0.3*cm))

    # ── Score Card ───────────────────────────────────────────────────
    story.append(Paragraph("Quality Scores", h2))
    score_rows = [["Metric", "Score", "Justification"]]
    for metric, val in scores.items():
        score_rows.append([
            metric.capitalize(),
            f"{val}/10",
            justs.get(metric, "—"),
        ])
    st = Table(score_rows, colWidths=[3.5*cm, 2*cm, 11*cm])
    st.setStyle(TableStyle([
        ("BACKGROUND",  (0,0), (-1,0), PURPLE),
        ("TEXTCOLOR",   (0,0), (-1,0), colors.white),
        ("FONTNAME",    (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE",    (0,0), (-1,-1), 9),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, LIGHT]),
        ("GRID",        (0,0), (-1,-1), 0.25, colors.lightgrey),
        ("PADDING",     (0,0), (-1,-1), 6),
        ("VALIGN",      (0,0), (-1,-1), "TOP"),
    ]))
    story.append(st)
    story.append(Spacer(1, 0.3*cm))

    # ── Compliance ───────────────────────────────────────────────────
    issues = audit.get("compliance_issues", [])
    story.append(Paragraph("Compliance Issues", h2))
    if issues:
        for i, issue in enumerate(issues, 1):
            story.append(Paragraph(f"{i}. {issue}", body))
    else:
        story.append(Paragraph("[OK] No compliance issues detected.", body))
    story.append(Spacer(1, 0.3*cm))

    # ── Key Findings ─────────────────────────────────────────────────
    story.append(Paragraph("Key Findings", h2))
    for i, f in enumerate(audit.get("key_findings", []), 1):
        story.append(Paragraph(f"{i}. {f}", body))
    story.append(Spacer(1, 0.3*cm))

    # ── Improvement Tips ─────────────────────────────────────────────
    story.append(Paragraph("Coaching & Improvement Tips", h2))
    for i, tip in enumerate(audit.get("improvement_tips", []), 1):
        story.append(Paragraph(f"{i}. {tip}", body))
    story.append(PageBreak())

    # ── Transcript ───────────────────────────────────────────────────
    story.append(Paragraph("Conversation Transcript", h2))
    dialogue = transcript.get("dialogue", [])
    if dialogue:
        for turn in dialogue:
            spk   = turn.get("speaker", "?")
            color = PURPLE if spk == "Agent" else DARK
            story.append(Paragraph(
                f'<font color="#{color.hexval()[2:]}"><b>[{spk}]</b></font> {turn.get("text","")}',
                body,
            ))
            story.append(Spacer(1, 0.15*cm))
    else:
        story.append(Paragraph(transcript.get("full_text", "No transcript."), body))

    story.append(Spacer(1, 0.5*cm))
    story.append(hr())
    story.append(Paragraph("Generated by AI Auditor — Quality Intelligence Platform", small))

    doc.build(story)
    return buf.getvalue()
