# ══════════════════════════════════════════════════════════════════════
# Excel Analytics Export — openpyxl
# 4-sheet enterprise export: Summary, Score Trends, Compliance Log, Leaderboard
# ══════════════════════════════════════════════════════════════════════
import io
from datetime import datetime

try:
    import openpyxl
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter
    XL_AVAILABLE = True
except ImportError:
    XL_AVAILABLE = False

# ── Style helpers ──────────────────────────────────────────────────────
def _score_fill(score: float):
    if not XL_AVAILABLE:
        return None
    if score >= 75:
        return PatternFill("solid", fgColor="34d399")
    if score >= 50:
        return PatternFill("solid", fgColor="fbbf24")
    return PatternFill("solid", fgColor="f87171")


def _header_style(ws, row: int, cols: int):
    for c in range(1, cols + 1):
        cell = ws.cell(row=row, column=c)
        cell.font = Font(bold=True, color="FFFFFF", size=10)
        cell.fill = PatternFill("solid", fgColor="6366f1")
        cell.alignment = Alignment(horizontal="center", wrap_text=True)


def generate_excel_report(records) -> bytes:
    """
    Generate a 4-sheet Excel analytics report.
    `records` should be an iterable of processor.AuditResult instances.
    Returns raw XLSX bytes.
    """
    if not XL_AVAILABLE:
        return b"openpyxl not installed"

    wb = Workbook()

    # ── Sheet 1: Audit Summary ────────────────────────────────────────
    ws1 = wb.active
    ws1.title = "Audit Summary"
    headers1 = ["ID", "File", "Date", "Source", "Score", "Grade",
                 "Sentiment", "Agent Performance", "Call Outcome",
                 "Empathy", "Resolution", "Professionalism", "Compliance"]
    ws1.append(headers1)
    _header_style(ws1, 1, len(headers1))

    def grade(s):
        if s >= 90: return "A+"
        if s >= 80: return "A"
        if s >= 70: return "B+"
        if s >= 60: return "B"
        if s >= 50: return "C"
        return "D"

    all_records = list(records)
    for r in all_records:
        a = r.audit_json or {}
        sc = r.overall_score or 0
        scores = a.get("scores", {})
        date = r.created_at.strftime("%Y-%m-%d %H:%M") if hasattr(r.created_at, "strftime") else str(r.created_at)
        row = [
            r.id, r.filename, date, r.source_type, sc, grade(sc),
            r.sentiment,
            a.get("agent_performance", "N/A"),
            a.get("call_outcome", "N/A"),
            scores.get("empathy", 0),
            scores.get("resolution", 0),
            scores.get("professionalism", 0),
            scores.get("compliance", 0),
        ]
        ws1.append(row)
        # Conditional colour on Score column (E)
        score_cell = ws1.cell(row=ws1.max_row, column=5)
        score_cell.fill = _score_fill(sc)

    for col in ws1.columns:
        ws1.column_dimensions[get_column_letter(col[0].column)].width = 16

    # ── Sheet 2: Score Trends ─────────────────────────────────────────
    ws2 = wb.create_sheet("Score Trends")
    headers2 = ["Date", "File", "Overall", "Empathy", "Resolution", "Professionalism", "Compliance"]
    ws2.append(headers2)
    _header_style(ws2, 1, len(headers2))
    for r in sorted(all_records, key=lambda x: x.created_at):
        a = r.audit_json or {}
        sc = a.get("scores", {})
        date = r.created_at.strftime("%Y-%m-%d") if hasattr(r.created_at, "strftime") else str(r.created_at)
        ws2.append([
            date, r.filename, r.overall_score,
            sc.get("empathy", 0), sc.get("resolution", 0),
            sc.get("professionalism", 0), sc.get("compliance", 0),
        ])
    for col in ws2.columns:
        ws2.column_dimensions[get_column_letter(col[0].column)].width = 18

    # ── Sheet 3: Compliance Log ───────────────────────────────────────
    ws3 = wb.create_sheet("Compliance Log")
    headers3 = ["Audit ID", "File", "Date", "Compliance Score", "Issues"]
    ws3.append(headers3)
    _header_style(ws3, 1, len(headers3))
    for r in all_records:
        a      = r.audit_json or {}
        issues = a.get("compliance_issues", [])
        c_score = (a.get("scores") or {}).get("compliance", 0)
        date = r.created_at.strftime("%Y-%m-%d %H:%M") if hasattr(r.created_at, "strftime") else str(r.created_at)
        ws3.append([
            r.id, r.filename, date, c_score,
            "; ".join(issues) if issues else "None",
        ])
        if issues:
            ws3.cell(row=ws3.max_row, column=4).fill = _score_fill(c_score * 10)
    for col in ws3.columns:
        ws3.column_dimensions[get_column_letter(col[0].column)].width = 22

    # ── Sheet 4: Agent Leaderboard ────────────────────────────────────
    ws4 = wb.create_sheet("Agent Leaderboard")
    headers4 = ["Rank", "Agent (File)", "Audits", "Avg Score", "Avg Empathy",
                 "Avg Compliance", "Grade", "Risk Level"]
    ws4.append(headers4)
    _header_style(ws4, 1, len(headers4))

    agents = {}
    for r in all_records:
        key = (r.filename or "Unknown")[:40]
        a   = r.audit_json or {}
        sc  = a.get("scores", {})
        if key not in agents:
            agents[key] = {"total": 0, "score_sum": 0, "emp_sum": 0, "comp_sum": 0}
        agents[key]["total"]    += 1
        agents[key]["score_sum"] += r.overall_score or 0
        agents[key]["emp_sum"]   += sc.get("empathy", 0)
        agents[key]["comp_sum"]  += sc.get("compliance", 0)

    ranked = sorted(
        [(k, v) for k, v in agents.items()],
        key=lambda x: x[1]["score_sum"] / max(x[1]["total"], 1),
        reverse=True,
    )
    for rank, (name, v) in enumerate(ranked, 1):
        n    = v["total"]
        avg  = round(v["score_sum"] / n, 1)
        comp = round(v["comp_sum"] / n, 1)
        risk = "HIGH" if comp < 5 else "MEDIUM" if avg < 65 else "LOW"
        ws4.append([rank, name, n, avg, round(v["emp_sum"]/n, 1), comp, grade(avg), risk])
        ws4.cell(row=ws4.max_row, column=4).fill = _score_fill(avg)
    for col in ws4.columns:
        ws4.column_dimensions[get_column_letter(col[0].column)].width = 18

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
