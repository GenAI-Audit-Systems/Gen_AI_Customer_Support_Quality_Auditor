import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, FileText, BarChart3, CheckCircle2, AlertCircle,
  Download, History, Shield, X, Mic, MessageSquare, Sparkles,
  TrendingUp, Clock, ChevronRight, Award, Zap, Target, Star, BookOpen
} from 'lucide-react';
import {
  ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, Radar, Tooltip as RTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  RadialBarChart, RadialBar, PieChart, Pie, Cell
} from 'recharts';
import { getApiBase } from '../lib/api';

const API_BASE = getApiBase();
const getCurrentUserEmail = () => JSON.parse(window.localStorage.getItem("ai_auditor_auth") || "{}").email || "";
const getServiceStatus = (diag, label) => {
  if (!diag) return false;
  const value = diag[label];
  return typeof value === 'string' && (value.includes('Operational') || value.includes('Connected') || value.includes('Ready') || value.includes('Active'));
};

/* ── helpers ─────────────────────────────────────────────────────────── */
const scoreColor = (v) => v >= 75 ? '#34d399' : v >= 50 ? '#fbbf24' : '#f87171';

const sentBadge = (s = '') => {
  const lo = s.toLowerCase();
  if (lo === 'positive') return 'b-green';
  if (lo === 'negative') return 'b-red';
  return 'b-violet';
};

/* animated counting number */
function AnimCount({ to, duration = 1.2 }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / (duration * 1000), 1);
      setVal(Math.round(p * to));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [to, duration]);
  return <span>{val}</span>;
}

/* custom recharts tooltip */
const CustomTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rt-tooltip">
      <p style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ fontSize: 13, fontWeight: 800, color: p.fill || '#a5b4fc' }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

/* grade helper */
const grade = (s) => {
  if (s >= 90) return { g: 'A+', color: '#34d399', label: 'Excellent' };
  if (s >= 80) return { g: 'A', color: '#34d399', label: 'Very Good' };
  if (s >= 70) return { g: 'B+', color: '#a78bfa', label: 'Good' };
  if (s >= 60) return { g: 'B', color: '#a78bfa', label: 'Satisfactory' };
  if (s >= 50) return { g: 'C', color: '#fbbf24', label: 'Needs Work' };
  return { g: 'D', color: '#f87171', label: 'Poor' };
};

/* ── App ─────────────────────────────────────────────────────────────── */
export default function BatchAuditPage() {
  const userEmail = getCurrentUserEmail();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [diag, setDiag] = useState(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const fileInputRef = useRef(null);

  useEffect(() => { fetchHistory(); }, []);
  // reset tab when new result arrives
  useEffect(() => { if (result) setActiveTab('overview'); }, [result]);

  const fetchHistory = async () => {
    try { const r = await axios.get(API_BASE + `history/?user_email=${encodeURIComponent(userEmail)}`); setHistory(r.data); } catch (_) { }
  };

  const clearHistory = async () => {
    try {
      await axios.post(API_BASE + 'history/clear/', { user_email: userEmail });
      setHistory([]);
      setResult(null);
    } catch (_) { }
  };

  const handleFile = (e) => {
    const f = e.target.files[0]; if (!f) return;
    setFile(f); processFile(f);
  };

  const processFile = async (f) => {
    setLoading(true); setError(null); setResult(null);
    const fd = new FormData(); fd.append('file', f); fd.append('user_email', userEmail);
    try {
      if (f.type.includes('audio')) {
        // Audio files go through Deepgram transcription pipeline
        const { data } = await axios.post(API_BASE + 'process-audio/', fd);
        setResult(data); fetchHistory();
      } else {
        // Text files go through RAG-powered audit (policy-aware)
        const { data } = await axios.post(API_BASE + 'rag/audit/', fd);
        setResult(data); fetchHistory();
      }
    } catch (err) { setError(err.response?.data?.error || 'Error processing file.'); }
    finally { setLoading(false); }
  };

  const exportResult = (fmt = 'txt') => {
    if (!result) return;
    if (fmt === 'xls') {
      window.open(`${API_BASE}export-excel/${result.id}/`, '_blank');
      return;
    }

    const a_d = result.audit || {};
    const dlg = result.transcript?.dialogue || [];

    if (fmt === 'txt') {
      const sep = '='.repeat(60);
      const dash = '-'.repeat(60);
      const lines = [
        sep,
        '   AI QUALITY AUDITOR — AUDIT REPORT',
        `   Generated: ${new Date().toLocaleString()}`,
        sep,
        '',
        '► OVERVIEW',
        dash,
        `  File        : ${file?.name || result.filename || 'N/A'}`,
        `  Source      : ${result.source?.toUpperCase() || 'N/A'}`,
        `  Overall Score: ${a_d.overall_score || 0} / 100`,
        `  Letter Grade : ${grade(a_d.overall_score || 0).g} — ${grade(a_d.overall_score || 0).label}`,
        `  Sentiment   : ${a_d.sentiment || 'N/A'}`,
        `  Agent Perf  : ${a_d.agent_performance || 'N/A'}`,
        `  Call Outcome: ${a_d.call_outcome || 'N/A'}`,
        '',
        '► EXECUTIVE SUMMARY',
        dash,
        `  ${a_d.summary || 'N/A'}`,
        '',
        '► METRIC SCORES & JUSTIFICATIONS',
        dash,
        ...Object.entries(a_d.scores || {}).map(([k, v]) => [
          `  ${k.toUpperCase()} : ${v}/10`,
          `  → ${(a_d.metric_justifications || {})[k] || 'No justification provided.'}`,
          ''
        ]).flat(),
        '► KEY FINDINGS',
        dash,
        ...(a_d.key_findings || []).map((f, i) => `  ${i + 1}. ${f}`),
        '',
        '► IMPROVEMENT TIPS',
        dash,
        ...(a_d.improvement_tips || []).map((t, i) => `  ${i + 1}. ${t}`),
        '',
        ...(a_d.compliance_issues?.length ? [
          '► COMPLIANCE ISSUES',
          dash,
          ...(a_d.compliance_issues).map((c, i) => `  ${i + 1}. ${c}`),
          ''
        ] : []),
        '► TRANSCRIPT',
        dash,
        ...(dlg.length > 0
          ? dlg.map(m => `  [${m.speaker}]: ${m.text}`)
          : [`  ${result.content || 'N/A'}`]
        ),
        '',
        sep,
        '   END OF REPORT — AI Auditor v2',
        sep
      ];
      const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `audit_report_${result.id || 'draft'}.txt`;
      link.click();
    } else {
      // HTML → .doc (Word-compatible)
      const scores_html = Object.entries(a_d.scores || {}).map(([k, v]) =>
        `<tr><td><b>${k}</b></td><td>${v}/10</td><td>${(a_d.metric_justifications || {})[k] || ''}</td></tr>`
      ).join('');
      const transcript_html = (result.transcript?.dialogue || []).map(m =>
        `<p><b>[${m.speaker}]:</b> ${m.text}</p>`
      ).join('');
      const html = `<html><head><meta charset='utf-8'><style>
        body{font-family:Calibri,sans-serif;margin:40px;color:#222}
        h1{color:#4f46e5}h2{color:#6d28d9;border-bottom:1px solid #ddd;padding-bottom:4px}
        table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:8px;vertical-align:top}
        th{background:#ede9fe;color:#4f46e5}
      </style></head><body>
        <h1>AI Quality Auditor — Report</h1>
        <p><b>File:</b> ${file?.name || ''} &nbsp; <b>Date:</b> ${new Date().toLocaleString()}</p>
        <h2>Overview</h2>
        <table><tr><th>Metric</th><th>Value</th></tr>
          <tr><td>Overall Score</td><td><b>${a_d.overall_score || 0}/100</b></td></tr>
          <tr><td>Grade</td><td>${grade(a_d.overall_score || 0).g} — ${grade(a_d.overall_score || 0).label}</td></tr>
          <tr><td>Sentiment</td><td>${a_d.sentiment || ''}</td></tr>
          <tr><td>Agent Performance</td><td>${a_d.agent_performance || ''}</td></tr>
          <tr><td>Call Outcome</td><td>${a_d.call_outcome || ''}</td></tr>
        </table>
        <h2>Summary</h2><p>${a_d.summary || ''}</p>
        <h2>Metric Scores & Justifications</h2>
        <table><tr><th>Metric</th><th>Score</th><th>Justification</th></tr>${scores_html}</table>
        <h2>Key Findings</h2><ol>${(a_d.key_findings || []).map(f => `<li>${f}</li>`).join('')}</ol>
        <h2>Improvement Tips</h2><ol>${(a_d.improvement_tips || []).map(t => `<li>${t}</li>`).join('')}</ol>
        <h2>Transcript</h2>${transcript_html || (result.content || '')}
      </body></html>`;
      const blob = new Blob([html], { type: 'application/msword' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `audit_report_${result.id || 'draft'}.doc`;
      link.click();
    }
  };

  const testConn = async () => {
    setDiagLoading(true);
    try { const r = await axios.get(API_BASE + 'test-connection/'); setDiag(r.data); }
    catch { setDiag({ error: 'Cannot reach backend' }); }
    setDiagLoading(false);
  };

  /* derived data */
  /* derived data - supporting new enterprise schema */
  const audit = result?.audit || {};
  const dialogue = result?.transcript?.dialogue || [];
  
  // Support scores and justifications with robust normalization (lowercase for internal consistency)
  const scores = { empathy: 0, resolution: 0, professionalism: 0, compliance: 0 };
  const justifications = { empathy: "", resolution: "", professionalism: "", compliance: "" };
  
  if (audit.metrics) {
    Object.entries(audit.metrics).forEach(([k, v]) => {
      const normalizedKey = k.toLowerCase();
      if (scores.hasOwnProperty(normalizedKey)) {
        scores[normalizedKey] = v.score || 0;
        justifications[normalizedKey] = v.reason || "";
      }
    });
  } else if (audit.scores) {
     Object.entries(audit.scores).forEach(([k, v]) => {
        const normalizedKey = k.toLowerCase();
        if (scores.hasOwnProperty(normalizedKey)) {
          scores[normalizedKey] = v || 0;
          justifications[normalizedKey] = audit.metric_justifications?.[k] || "";
        }
     });
  }

  const sc = audit.overall_score || 0;
  const gr = grade(sc);

  const agentPerf = audit.metrics?.Professionalism?.label || audit.agent_performance || 'Satisfactory';
  const callOutcome = audit.metrics?.Resolution?.label || audit.call_outcome || 'Resolved';
  
  const complianceIssues = (audit.violations || audit.compliance_issues || []).map((issue) => {
    if (typeof issue === 'object' && issue !== null) {
      return {
        severity: (issue.severity || 'LOW').toUpperCase(),
        message: issue.message || issue.description || issue.msg || issue.rule || "Compliance policy breach detected.",
        quote: issue.quote || issue.evidence || "",
        action: issue.action || issue.remediation || "",
      };
    }

    return {
      severity: 'LOW',
      message: String(issue),
      quote: "",
      action: "",
    };
  });

  const radarData = Object.entries(scores).map(([k, v]) => ({
    metric: k.charAt(0).toUpperCase() + k.slice(1), value: v * 10, fullMark: 100
  }));

  const barData = Object.entries(scores).map(([k, v]) => ({
    name: k.charAt(0).toUpperCase() + k.slice(1), score: v * 10
  }));

  const pieData = [
    { name: 'Score', value: sc },
    { name: 'Gap', value: 100 - sc }
  ];

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'charts', label: 'Charts', icon: TrendingUp },
    { id: 'transcript', label: 'Transcript', icon: MessageSquare },
    { id: 'findings', label: 'Findings', icon: Target },
    { id: 'compliance', label: 'Compliance', icon: Shield },
    { id: 'evidence', label: 'Policy Evidence', icon: BookOpen },
  ];

  /* ── NAV ── */
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 }}>
      <nav style={{
        background: 'rgba(5,7,15,0.88)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(99,102,241,0.12)',
        padding: '0 2rem', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#6366f1,#a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={18} color="#fff" />
          </div>
          <div>
            <div className="gt" style={{ fontWeight: 900, fontSize: 17, letterSpacing: '-0.02em', lineHeight: 1 }}>AI Auditor</div>
            <div style={{ fontSize: 9, color: '#334155', fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase' }}>Quality Intelligence</div>
          </div>
        </div>

        {/* DB Health */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'rgba(255,255,255,.02)', padding: '4px 12px', borderRadius: 20, border: '1px solid rgba(255,255,255,.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: getServiceStatus(diag, 'Primary Database') ? '#34d399' : '#f87171', boxShadow: getServiceStatus(diag, 'Primary Database') ? '0 0 8px #34d39988' : 'none' }} />
            <span style={{ fontSize: 9, fontWeight: 900, color: '#475569', textTransform: 'uppercase' }}>Primary Database</span>
          </div>
          <div style={{ width: 1, height: 10, background: 'rgba(255,255,255,.1)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: getServiceStatus(diag, 'Vector Engine') ? '#34d399' : '#fbbf24', boxShadow: getServiceStatus(diag, 'Vector Engine') ? '0 0 8px #34d39988' : 'none' }} />
            <span style={{ fontSize: 9, fontWeight: 900, color: '#475569', textTransform: 'uppercase' }}>Vector Engine</span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {diag && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'rgba(10,14,28,.95)', border: '1px solid rgba(99,102,241,.2)', borderRadius: 10, padding: '5px 12px', marginRight: 6 }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: '#334155', letterSpacing: '.1em', textTransform: 'uppercase' }}>Status:</span>
              {[['deepgram', 'Transcription Service'], ['openrouter', 'Intelligence Layer']].map(([label, key]) => { const k = key; return (
                <span key={label} style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: getServiceStatus(diag, key) ? '#34d399' : '#f87171' }}>
                  {k} {diag[k]?.includes('Connected') ? '✓' : '✗'}
                </span>
              )})}
              <button onClick={() => setDiag(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#334155' }}><X size={11} /></button>
            </motion.div>
          )}
          <button className="btn" onClick={testConn}>
            {diagLoading ? <span className="spin" style={{ width: 12, height: 12, border: '2px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block' }} /> : <Shield size={13} />}
            Test API
          </button>
          <button className={`btn${showHistory ? ' active' : ''}`} onClick={() => { setShowHistory(true); fetchHistory(); }}>
            <History size={13} /> History
          </button>
          {result && (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <button className="btn" style={{ borderRight: '1px solid rgba(99,102,241,.2)' }}
                onClick={() => exportResult('txt')}>
                <Download size={13} /> TXT Report
              </button>
              <button className="btn" style={{ borderLeft: 'none', borderRight: '1px solid rgba(99,102,241,.2)', borderTopLeftRadius: 0, borderBottomLeftRadius: 0, paddingLeft: 8 }}
                onClick={() => { window.open(`${API_BASE}alerts/report/pdf/${result.id}/`, '_blank'); }} title="Download PDF Report">
                PDF
              </button>
              <button className="btn" style={{ borderLeft: 'none', borderRight: '1px solid rgba(99,102,241,.2)', borderTopLeftRadius: 0, borderBottomLeftRadius: 0, paddingLeft: 8 }}
                onClick={() => exportResult('doc')} title="Download as Word">
                .doc
              </button>
              <button className="btn" style={{ borderLeft: 'none', borderTopLeftRadius: 0, borderBottomLeftRadius: 0, paddingLeft: 10, background: 'rgba(52,211,153,.15)', color: '#34d399' }}
                onClick={() => exportResult('xls')} title="Download as Excel">
                <Download size={13} style={{ marginRight: 4 }} /> .xlsx
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* ── BODY ── */}
      <div style={{ flex: 1, padding: '2rem', maxWidth: 1380, margin: '0 auto', width: '100%', position: 'relative', zIndex: 1 }}>

        {/* HERO */}
        <motion.div initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5 }}
          style={{ textAlign: 'center', marginBottom: '2.5rem', paddingTop: '1rem' }}>
          <h1 style={{ fontSize: 'clamp(2rem,4vw,3.5rem)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: 10 }}>
            Customer Support <span className="gt">Quality Auditor</span>
          </h1>
          <p style={{ color: '#475569', fontWeight: 500, fontSize: 14, maxWidth: 460, margin: '0 auto' }}>
            Upload an audio call or chat transcript. Get real-time transcription, speaker analysis, AI-powered scoring, and actionable training insights.
          </p>
        </motion.div>

        {/* MAIN GRID */}
        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '1.5rem', alignItems: 'start' }}>

          {/* ── LEFT ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Upload card */}
            <motion.div className="gc" initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .1 }} style={{ padding: '1.5rem' }}>
              <p style={{ fontWeight: 800, fontSize: 13, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Upload size={14} color="#6366f1" /> Upload File
              </p>
              <div className="upload-zone" onClick={() => fileInputRef.current.click()}>
                <input type="file" ref={fileInputRef} onChange={handleFile} style={{ display: 'none' }} />
                {loading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <div className="spin" style={{ width: 44, height: 44, border: '3px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%' }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#6366f1' }}>Analyzing…</span>
                    <span style={{ fontSize: 10, color: '#334155', fontWeight: 600 }}>This may take up to 60s</span>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
                      {[Mic, MessageSquare].map((Icon, i) => (
                        <div key={i} style={{ background: 'rgba(99,102,241,.1)', borderRadius: 10, padding: 10, border: '1px solid rgba(99,102,241,.15)' }}>
                          <Icon size={20} color="#6366f1" />
                        </div>
                      ))}
                    </div>
                    <p style={{ fontWeight: 700, fontSize: 13, color: '#cbd5e1', marginBottom: 4 }}>Click to upload</p>
                    <p style={{ fontSize: 10, color: '#334155', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase' }}>MP3 · WAV · TXT</p>
                  </>
                )}
              </div>
              {file && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  style={{ marginTop: '0.875rem', padding: '10px 14px', background: 'rgba(99,102,241,.07)', borderRadius: 12, border: '1px solid rgba(99,102,241,.14)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <FileText size={15} color="#818cf8" />
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#c7d2fe', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</p>
                    <p style={{ fontSize: 10, color: '#334155', fontWeight: 700, textTransform: 'uppercase' }}>{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                </motion.div>
              )}
            </motion.div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div className="gc" initial={{ opacity: 0, scale: .95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .95 }}
                  style={{ padding: '1rem 1.25rem', borderColor: 'rgba(248,113,113,.25)', background: 'rgba(248,113,113,.05)' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <AlertCircle size={15} color="#f87171" style={{ marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 800, color: '#f87171', marginBottom: 4 }}>Processing Failed</p>
                      <p style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, lineHeight: 1.55 }}>{error}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Quick stats (shown when result exists) */}
            {result && (
              <motion.div className="gc gc-glow" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ padding: '1.25rem' }}>
                <p style={{ fontWeight: 800, fontSize: 11, color: '#334155', letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: '1rem' }}>Quick Stats</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'Overall Score', val: sc, unit: 'pts', icon: Award, color: '#6366f1' },
                    { label: 'Grade', val: gr.g, unit: '', icon: Star, color: gr.color },
                    { label: 'Turns', val: dialogue.length, unit: '', icon: MessageSquare, color: '#a78bfa' },
                    { label: 'Sentiment', val: (audit.metrics?.Sentiment?.label || audit.sentiment || '—'), unit: '', icon: Zap, color: '#34d399' },
                  ].map(({ label, val, unit, icon: Icon, color }) => (
                    <div key={label} className="score" style={{ background: 'rgba(255,255,255,.03)', padding: '1rem', borderRadius: 14, border: '1px solid rgba(255,255,255,.05)', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <Icon size={12} color={color} />
                        <span style={{ fontSize: 10, fontWeight: 800, color: '#334155', letterSpacing: '.1em', textTransform: 'uppercase' }}>{label}</span>
                      </div>
                      <p style={{ fontSize: 16, fontWeight: 900, color }}>{val}{unit}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {/* ── RIGHT ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <AnimatePresence mode="wait">
              {!result ? (
                <motion.div key="empty" className="gc" initial={{ opacity: 0 }} animate={{ opacity: .6 }} exit={{ opacity: 0 }}
                  style={{ minHeight: 520, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', textAlign: 'center' }}>
                  <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(99,102,241,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', border: '1px solid rgba(99,102,241,.14)' }}>
                    <BarChart3 size={36} color="#6366f1" />
                  </div>
                  <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 8 }}>Ready to Audit</h2>
                  <p style={{ color: '#334155', fontWeight: 600, fontSize: 13, maxWidth: 280 }}>
                    Upload an audio file or chat transcript to unlock the full analytics dashboard.
                  </p>
                </motion.div>
              ) : (
                <motion.div key="results" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                  {/* TABS */}
                  <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: 4, width: 'fit-content' }}>
                    {tabs.map(({ id, label, icon: Icon }) => (
                      <button key={id} className={`tab${activeTab === id ? ' on' : ''}`} onClick={() => setActiveTab(id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Icon size={12} /> {label}
                      </button>
                    ))}
                  </div>

                  {/* ─ TAB: OVERVIEW ─ */}
                  <AnimatePresence mode="wait">
                    {activeTab === 'overview' && (
                      <motion.div key="ov" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                        {/* Score row */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>

                          {/* Animated score */}
                          <div className="gc gc-glow" style={{ padding: '1.75rem', textAlign: 'center' }}>
                            <p style={{ fontSize: 10, fontWeight: 800, color: '#334155', letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 14 }}>Quality Score</p>
                            <div style={{ position: 'relative', width: 100, height: 100, margin: '0 auto', marginBottom: 14 }}>
                              {/* SVG ring */}
                              <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,.05)" strokeWidth="8" />
                                <motion.circle cx="50" cy="50" r="42" fill="none" stroke={scoreColor(sc)} strokeWidth="8"
                                  strokeLinecap="round" strokeDasharray={2 * Math.PI * 42}
                                  initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                                  animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - sc / 100) }}
                                  transition={{ duration: 1.2, ease: 'easeOut' }} />
                              </svg>
                              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontSize: 28, fontWeight: 900, color: scoreColor(sc), lineHeight: 1 }}>
                                  <AnimCount to={sc} />
                                </span>
                                <span style={{ fontSize: 10, color: '#334155', fontWeight: 700 }}>/ 100</span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span className={`badge ${sentBadge(audit.sentiment)}`}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                                {audit.sentiment}
                              </span>
                              <span className={`badge ${sc >= 70 ? 'b-green' : 'b-amber'}`}>{sc >= 70 ? 'Passes' : 'Review'}</span>
                            </div>
                          </div>

                          {/* Grade */}
                          <div className="gc" style={{ padding: '1.75rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <p style={{ fontSize: 10, fontWeight: 800, color: '#334155', letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 14 }}>Letter Grade</p>
                            <div style={{ width: 80, height: 80, borderRadius: '50%', border: `3px solid ${gr.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, boxShadow: `0 0 24px ${gr.color}44` }}>
                              <span style={{ fontSize: 28, fontWeight: 900, color: gr.color }}>{gr.g}</span>
                            </div>
                            <span className={`badge ${sc >= 70 ? 'b-green' : 'b-amber'}`}>{gr.label}</span>
                          </div>

                          {/* Metrics summary */}
                          <div className="gc" style={{ padding: '1.5rem' }}>
                            <p style={{ fontSize: 10, fontWeight: 800, color: '#334155', letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 14 }}>Metric Bars</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                              {Object.entries(scores).map(([k, v]) => (
                                <div key={k}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'capitalize' }}>{k}</span>
                                    <span style={{ fontSize: 11, fontWeight: 900, color: scoreColor(v * 10) }}>{v}/10</span>
                                  </div>
                                  <div className="bar-track">
                                    <motion.div className="bar-fill" initial={{ width: 0 }} animate={{ width: `${v * 10}%` }} transition={{ duration: .9, ease: 'easeOut' }}
                                      style={{ background: `linear-gradient(90deg,${scoreColor(v * 10)},${scoreColor(v * 10)}88)` }} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Summary banner */}
                        <div className="gc" style={{ padding: '1.5rem', borderLeft: '3px solid #6366f1', background: 'rgba(99,102,241,.04)' }}>
                          <p style={{ fontSize: 10, fontWeight: 800, color: '#334155', letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 8 }}>Executive Summary</p>
                          <p style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.6, fontStyle: 'italic' }}>"{audit.executive_summary || audit.summary}"</p>
                        </div>
                      </motion.div>
                    )}

                    {/* ─ TAB: CHARTS ─ */}
                    {activeTab === 'charts' && (
                      <motion.div key="ch" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>

                          {/* Radar chart */}
                          <div className="gc" style={{ padding: '1.5rem' }}>
                            <p style={{ fontSize: 10, fontWeight: 800, color: '#334155', letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 12 }}>Radar Analysis</p>
                            <ResponsiveContainer width="100%" height={240}>
                              <RadarChart data={radarData}>
                                <PolarGrid stroke="rgba(255,255,255,.06)" />
                                <PolarAngleAxis dataKey="metric" tick={{ fill: '#475569', fontSize: 11, fontFamily: 'Outfit', fontWeight: 700 }} />
                                <Radar dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} strokeWidth={2} />
                                <RTooltip content={<CustomTip />} />
                              </RadarChart>
                            </ResponsiveContainer>
                          </div>

                          {/* Bar chart */}
                          <div className="gc" style={{ padding: '1.5rem' }}>
                            <p style={{ fontSize: 10, fontWeight: 800, color: '#334155', letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 12 }}>Score Breakdown</p>
                            <ResponsiveContainer width="100%" height={240}>
                              <BarChart data={barData} layout="vertical">
                                <CartesianGrid horizontal={false} stroke="rgba(255,255,255,.04)" />
                                <XAxis type="number" domain={[0, 100]} tick={{ fill: '#334155', fontSize: 10, fontFamily: 'Outfit', fontWeight: 700 }} axisLine={false} tickLine={false} />
                                <YAxis dataKey="name" type="category" width={96} tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'Outfit', fontWeight: 700 }} axisLine={false} tickLine={false} />
                                <RTooltip content={<CustomTip />} />
                                <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={14}>
                                  {barData.map((d, i) => (
                                    <Cell key={i} fill={scoreColor(d.score)} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Donut + stat cards row */}
                        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '1.25rem' }}>
                          <div className="gc" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <p style={{ fontSize: 10, fontWeight: 800, color: '#334155', letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 12 }}>Goal vs Gap</p>
                            <ResponsiveContainer width="100%" height={160}>
                              <PieChart>
                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={48} outerRadius={70} paddingAngle={4} dataKey="value" startAngle={90} endAngle={-270}>
                                  <Cell fill={scoreColor(sc)} />
                                  <Cell fill="rgba(255,255,255,.05)" />
                                </Pie>
                              </PieChart>
                            </ResponsiveContainer>
                            <p style={{ fontSize: 28, fontWeight: 900, color: scoreColor(sc), marginTop: -16 }}>{sc}<span style={{ fontSize: 14, color: '#334155' }}>/100</span></p>
                          </div>

                          {/* Callout stats with JUSTIFICATION */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            {Object.entries(scores).map(([k, v]) => (
                              <div key={k} className="gc" style={{ padding: '14px 16px' }}>
                                <p style={{ fontSize: 9, fontWeight: 800, color: '#334155', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 6 }}>{k}</p>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                                  <span style={{ fontSize: 26, fontWeight: 900, color: scoreColor(v * 10) }}>{v}</span>
                                  <span style={{ fontSize: 12, color: '#334155', fontWeight: 700 }}>/10</span>
                                </div>
                                <div className="bar-track" style={{ marginTop: 8, marginBottom: 8 }}>
                                  <motion.div className="bar-fill" initial={{ width: 0 }} animate={{ width: `${v * 10}%` }} transition={{ duration: .9 }}
                                    style={{ background: `linear-gradient(90deg,${scoreColor(v * 10)},${scoreColor(v * 10)}77)` }} />
                                </div>
                                {justifications[k] && (
                                  <p style={{ fontSize: 10, color: '#64748b', lineHeight: 1.5, fontWeight: 500, fontStyle: 'italic', borderTop: '1px solid rgba(255,255,255,.04)', paddingTop: 8 }}>
                                    {justifications[k]}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* ─ TAB: TRANSCRIPT ─ */}
                    {activeTab === 'transcript' && (
                      <motion.div key="tr" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                        <div className="gc" style={{ padding: '1.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <p style={{ fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <MessageSquare size={15} color="#6366f1" /> Conversation Transcript
                            </p>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <span className="badge b-violet">{dialogue.length} turns</span>
                              {dialogue.filter(d => d.speaker === 'Agent').length > 0 && (
                                <span className="badge b-green">{dialogue.filter(d => d.speaker === 'Agent').length} Agent</span>
                              )}
                            </div>
                          </div>

                          <div className="scr" style={{ maxHeight: 460, overflowY: 'auto', paddingRight: 8, display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {dialogue.length > 0 ? dialogue.map((msg, i) => (
                              <motion.div key={i} custom={i}
                                initial={{ opacity: 0, x: msg.speaker === 'Agent' ? -12 : 12 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.04, duration: .25 }}
                                style={{ display: 'flex', flexDirection: 'column', alignItems: msg.speaker === 'Agent' ? 'flex-start' : 'flex-end' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                                  <div style={{
                                    width: 22, height: 22, borderRadius: '50%',
                                    background: msg.speaker === 'Agent' ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'linear-gradient(135deg,#475569,#64748b)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900, color: '#fff'
                                  }}>
                                    {msg.speaker[0]}
                                  </div>
                                  <span style={{
                                    fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase',
                                    color: msg.speaker === 'Agent' ? '#818cf8' : '#64748b'
                                  }}>{msg.speaker}</span>
                                </div>
                                <div className={msg.speaker === 'Agent' ? 'bub-agent' : 'bub-customer'}
                                  style={{ padding: '10px 14px', borderRadius: 14, maxWidth: '88%' }}>
                                  <p style={{ fontSize: 13, lineHeight: 1.6, color: '#cbd5e1', fontWeight: 500 }}>{msg.text}</p>
                                </div>
                              </motion.div>
                            )) : (
                              <div className="bub-customer" style={{ padding: '14px', borderRadius: 14 }}>
                                <p style={{ fontSize: 12, lineHeight: 1.6, color: '#cbd5e1', whiteSpace: 'pre-wrap' }}>{result.content}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* ─ TAB: FINDINGS ─ */}
                    {activeTab === 'findings' && (
                      <motion.div key="fi" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                        {/* Findings */}
                        <div className="gc" style={{ padding: '1.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.25rem' }}>
                            <Target size={15} color="#fbbf24" />
                            <p style={{ fontSize: 11, fontWeight: 800, color: '#475569', letterSpacing: '.12em', textTransform: 'uppercase' }}>Key Observations</p>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {audit.key_findings?.map((f, i) => (
                              <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * .07 }}
                                style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', background: 'rgba(255,255,255,.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,.05)' }}>
                                <div style={{ minWidth: 24, height: 24, borderRadius: '50%', background: 'rgba(99,102,241,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <span style={{ fontSize: 9, fontWeight: 900, color: '#6366f1' }}>{i + 1}</span>
                                </div>
                                <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6, fontWeight: 500 }}>{f}</p>
                              </motion.div>
                            ))}
                          </div>
                        </div>

                        {/* Tips */}
                        <div className="gc" style={{ padding: '1.5rem', background: 'rgba(99,102,241,.03)', border: '1px solid rgba(99,102,241,.1)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.25rem' }}>
                            <Sparkles size={15} color="#a78bfa" />
                            <p style={{ fontSize: 11, fontWeight: 800, color: '#475569', letterSpacing: '.12em', textTransform: 'uppercase' }}>Training Recommendations</p>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {audit.improvement_tips?.map((t, i) => (
                              <motion.div key={i} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * .08 }}
                                style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '14px', background: 'rgba(139,92,246,.05)', borderRadius: 14, border: '1px solid rgba(139,92,246,.1)' }}>
                                <div style={{ minWidth: 30, height: 30, borderRadius: 10, background: 'rgba(139,92,246,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <ChevronRight size={14} color="#a78bfa" />
                                </div>
                                <div>
                                  <p style={{ fontSize: 10, fontWeight: 800, color: '#7c3aed', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 4 }}>Tip #{i + 1}</p>
                                  <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6, fontWeight: 500 }}>{t}</p>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* ─ TAB: COMPLIANCE ─ */}
                    {activeTab === 'compliance' && (
                      <motion.div key="co" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                        {/* Agent + Call Outcome cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <div className="gc" style={{ padding: '1.5rem' }}>
                            <p style={{ fontSize: 9, fontWeight: 800, color: '#334155', letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 10 }}>Agent Performance</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                              <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Award size={24} color="#fff" />
                              </div>
                              <div>
                                <p style={{ fontSize: 22, fontWeight: 900, color: agentPerf === 'Excellent' ? '#34d399' : agentPerf === 'Good' ? '#a78bfa' : agentPerf === 'Poor' ? '#f87171' : '#fbbf24' }}>
                                  {agentPerf || 'N/A'}
                                </p>
                                <p style={{ fontSize: 10, color: '#334155', fontWeight: 700 }}>Overall assessment</p>
                              </div>
                            </div>
                          </div>
                          <div className="gc" style={{ padding: '1.5rem' }}>
                            <p style={{ fontSize: 9, fontWeight: 800, color: '#334155', letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 10 }}>Call Outcome</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                              <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg,#ec4899,#a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <CheckCircle2 size={24} color="#fff" />
                              </div>
                              <div>
                                <p style={{ fontSize: 22, fontWeight: 900, color: callOutcome === 'Resolved' ? '#34d399' : callOutcome === 'Unresolved' ? '#f87171' : '#fbbf24' }}>
                                  {callOutcome || 'N/A'}
                                </p>
                                <p style={{ fontSize: 10, color: '#334155', fontWeight: 700 }}>Resolution status</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Compliance Score visual */}
                        <div className="gc" style={{ padding: '1.5rem' }}>
                          <p style={{ fontSize: 9, fontWeight: 800, color: '#334155', letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: '1rem' }}>Compliance Score</p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <div style={{ fontSize: 48, fontWeight: 900, color: scoreColor((scores.compliance || 0) * 10), lineHeight: 1 }}>
                              {scores.compliance || 0}<span style={{ fontSize: 18, color: '#334155' }}>/10</span>
                            </div>
                            <div style={{ flex: 1 }}>
                              <div className="bar-track" style={{ height: 10, marginBottom: 8 }}>
                                <motion.div className="bar-fill" initial={{ width: 0 }} animate={{ width: `${(scores.compliance || 0) * 10}%` }} transition={{ duration: 1 }}
                                  style={{ background: `linear-gradient(90deg,${scoreColor((scores.compliance || 0) * 10)},${scoreColor((scores.compliance || 0) * 10)}88)` }} />
                              </div>
                              {justifications.compliance && (
                                <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6, fontStyle: 'italic' }}>{justifications.compliance}</p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Compliance Issues */}
                        <div className="gc" style={{ padding: '1.5rem', border: complianceIssues.length > 0 ? '1px solid rgba(248,113,113,.2)' : '1px solid rgba(52,211,153,.15)', background: complianceIssues.length > 0 ? 'rgba(248,113,113,.04)' : 'rgba(52,211,153,.03)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
                            <Shield size={14} color={complianceIssues.length > 0 ? '#f87171' : '#34d399'} />
                            <p style={{ fontSize: 11, fontWeight: 800, color: '#475569', letterSpacing: '.12em', textTransform: 'uppercase' }}>
                              Compliance Issues ({complianceIssues.length})
                            </p>
                          </div>
                          {complianceIssues.length === 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'rgba(52,211,153,.06)', borderRadius: 12 }}>
                              <CheckCircle2 size={18} color="#34d399" />
                              <p style={{ fontSize: 13, fontWeight: 700, color: '#34d399' }}>No compliance issues detected. The interaction meets regulatory standards.</p>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                              {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(sevLevel => {
                                const levelIssues = complianceIssues.filter((iss) => iss.severity === sevLevel);
                                if (levelIssues.length === 0) return null;
                                const levelColor = sevLevel === 'CRITICAL'
                                  ? '#f87171'
                                  : sevLevel === 'HIGH'
                                    ? '#fbbf24'
                                    : sevLevel === 'MEDIUM'
                                      ? '#a78bfa'
                                      : '#34d399';
                                return (
                                  <div key={sevLevel}>
                                    <div style={{ fontSize: 10, fontWeight: 900, color: levelColor, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} /> {sevLevel} ISSUES ({levelIssues.length})
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                      {levelIssues.map((issue, i) => (
                                        <div key={i} style={{ display: 'flex', gap: 12, flexDirection: 'column', padding: '14px', background: 'rgba(255,255,255,.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,.08)' }}>
                                          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                            <AlertCircle size={16} color={levelColor} style={{ marginTop: 2, flexShrink: 0 }} />
                                            <div style={{ flex: 1 }}>
                                              <p style={{ fontSize: 13, color: '#f1f5f9', lineHeight: 1.6, fontWeight: 600, margin: 0 }}>{issue.message}</p>
                                              {issue.quote && <p style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic', marginTop: 8, padding: '6px 10px', background: 'rgba(0,0,0,0.2)', borderRadius: 6, borderLeft: '2px solid rgba(255,255,255,0.1)' }}>Evidence: "{issue.quote}"</p>}
                                              {issue.action && (
                                                 <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <Shield size={10} color={levelColor} />
                                                    <span style={{ fontSize: 11, color: levelColor, fontWeight: 700 }}>Action: {issue.action}</span>
                                                 </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Metric justifications summary */}
                        <div className="gc" style={{ padding: '1.5rem' }}>
                          <p style={{ fontSize: 9, fontWeight: 800, color: '#334155', letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: '1rem' }}>Score Rationale Summary</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {Object.entries(justifications).map(([k, txt]) => (
                              <div key={k} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px', background: 'rgba(255,255,255,.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,.05)' }}>
                                <span className={`badge b-violet`} style={{ flexShrink: 0 }}>{k}</span>
                                <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6, fontWeight: 500 }}>{txt}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* ─ TAB: POLICY EVIDENCE ─ */}
                    {activeTab === 'evidence' && (
                      <motion.div key="ev" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                        {/* RAG Coverage Badge */}
                        <div className="gc" style={{ padding: '1.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <BookOpen size={16} color="#6366f1" />
                              <p style={{ fontSize: 11, fontWeight: 800, color: '#475569', letterSpacing: '.12em', textTransform: 'uppercase' }}>Policy Evidence Retrieved</p>
                            </div>
                            {result?.rag_coverage != null && (
                              <span className="badge b-green" style={{ fontSize: 11 }}>
                                Coverage: {(result.rag_coverage * 100).toFixed(0)}%
                              </span>
                            )}
                          </div>

                          {(result?.policy_context && result.policy_context.length > 0) ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                              {result.policy_context.map((chunk, i) => (
                                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * .06 }}
                                  style={{ padding: '14px 16px', background: 'rgba(99,102,241,.04)', borderRadius: 14, border: '1px solid rgba(99,102,241,.12)' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <span style={{ fontSize: 11, fontWeight: 800, color: '#6366f1', background: 'rgba(99,102,241,.15)', padding: '2px 10px', borderRadius: 6 }}>
                                      {chunk.source_file || chunk.doc_type || 'Policy'}
                                    </span>
                                    <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>
                                      Similarity: {((chunk.similarity || 0) * 100).toFixed(0)}%
                                    </span>
                                  </div>
                                  <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.7, fontWeight: 500 }}>
                                    {chunk.text || chunk.content || JSON.stringify(chunk)}
                                  </p>
                                </motion.div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'rgba(99,102,241,.06)', borderRadius: 12, border: '1px solid rgba(99,102,241,.12)' }}>
                                <Shield size={18} color="#6366f1" />
                                <div>
                                  <p style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc' }}>Company Standard Operating Procedures (SOP)</p>
                                  <p style={{ fontSize: 11, color: '#94a3b8' }}>Baseline compliance standards used for this audit.</p>
                                </div>
                              </div>
                              {[
                                "1. Greeting & Opening: Agent must greet politely and offer assistance.",
                                "2. Empathy Policy: Agent must acknowledge issues with understanding.",
                                "3. Verification Policy: Verify customer/order details before proceeding.",
                                "4. Policy Compliance: Apply company policies (e.g. 7-day returns).",
                                "5. Transparency Policy: Clear explanation of options and processes.",
                                "6. Resolution Policy: Take appropriate action to resolve efficiently.",
                                "7. Timeline Policy: Provide accurate timelines for resolution.",
                                "8. Process Clarity: Explain next steps clearly (returns, pickups).",
                                "9. Professionalism: Maintain polite, respectful communication.",
                                "10. Closing Policy: Close politely and offer further assistance."
                              ].map((policy, i) => (
                                <div key={i} style={{ padding: '12px 14px', background: 'rgba(255,255,255,.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,.05)', fontSize: 12, color: '#cbd5e1', fontWeight: 500 }}>
                                  {policy}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Policy References from audit */}
                        {audit.policy_references && audit.policy_references.length > 0 && (
                          <div className="gc" style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
                              <FileText size={14} color="#a78bfa" />
                              <p style={{ fontSize: 11, fontWeight: 800, color: '#475569', letterSpacing: '.12em', textTransform: 'uppercase' }}>Referenced Policies</p>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                              {audit.policy_references.map((ref, i) => (
                                <span key={i} className="badge b-violet" style={{ fontSize: 11 }}>{ref}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}

                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,.02)', padding: '1.25rem 2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(2,4,12,0.8)', backdropFilter: 'blur(10px)', position: 'relative', zIndex: 1 }}>
        <p style={{ fontSize: 10, fontWeight: 800, color: '#334155', letterSpacing: '.12em', textTransform: 'uppercase' }}>
          Enterprise Intelligence Platform <span style={{ color: '#1e293b', margin: '0 8px' }}>•</span> © 2026 AI Auditor
        </p>
        <div style={{ display: 'flex', gap: 24 }}>
          {[
            { t: 'Deepgram Nova-2 Service', v: 'Operational' },
            { t: 'GPT-4o Reasoning Core', v: 'Active' },
            { t: 'ISO/IEC 27001 Certified', v: 'Verified' }
          ].map(item => (
            <div key={item.t} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 8px #34d39966' }} />
              <span style={{ fontSize: 9, fontWeight: 800, color: '#475569', letterSpacing: '.08em', textTransform: 'uppercase' }}>{item.t}</span>
            </div>
          ))}
        </div>
      </footer>

      {/* HISTORY DRAWER */}
      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(6px)', zIndex: 200 }} />
            <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: 390, background: '#070a17', borderLeft: '1px solid rgba(99,102,241,.14)', zIndex: 201, display: 'flex', flexDirection: 'column', padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ background: 'rgba(99,102,241,.12)', borderRadius: 10, padding: 8 }}>
                    <History size={18} color="#6366f1" />
                  </div>
                  <div>
                    <p style={{ fontWeight: 900, fontSize: 15 }}>Audit History</p>
                    <p style={{ fontSize: 9, color: '#334155', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em' }}>Last 10 records</p>
                  </div>
                </div>
                <button onClick={() => setShowHistory(false)} style={{ background: 'rgba(255,255,255,.05)', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', color: '#64748b', display: 'flex' }}>
                  <X size={18} />
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: 12 }}>
                <p style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>Only your own audit history is shown here.</p>
                <button className="btn" onClick={clearHistory}>
                  <X size={13} /> Clear History
                </button>
              </div>
              <div className="scr" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {history.length === 0 ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: .3 }}>
                    <Clock size={32} color="#6366f1" style={{ marginBottom: 12 }} />
                    <p style={{ fontWeight: 700, fontSize: 13 }}>No history yet</p>
                  </div>
                ) : history.map(item => (
                  <motion.button key={item.id} whileHover={{ x: -4 }}
                    onClick={() => { setResult({ ...item, source: item.source, transcript: item.transcript, content: item.transcript?.full_text }); setShowHistory(false); }}
                    style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 14, padding: '14px 16px', textAlign: 'left', cursor: 'pointer', width: '100%', transition: 'border-color .2s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(99,102,241,.4)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,.06)'}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: '#6366f1', background: 'rgba(99,102,241,.1)', padding: '2px 8px', borderRadius: 6 }}>{item.source}</span>
                      <span style={{ fontSize: 9, color: '#334155', fontWeight: 800 }}>{item.date}</span>
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#cbd5e1', marginBottom: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.filename || 'Direct Input'}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,.04)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ width: `${item.score}%`, height: '100%', background: scoreColor(item.score), borderRadius: 99 }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 900, color: scoreColor(item.score) }}>{item.score}</span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
