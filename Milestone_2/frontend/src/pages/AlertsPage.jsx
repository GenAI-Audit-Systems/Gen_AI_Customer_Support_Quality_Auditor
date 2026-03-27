import React, { useState, useEffect } from "react";
import { GlassPanel } from "../components/ui/GlassPanel";
import { BarChart3, AlertTriangle, FileText } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api/";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    try {
      const res = await fetch(`${API_BASE}alerts/history/?limit=100`);
      const data = await res.json();
      if (data.alerts) setAlerts(data.alerts);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleReview = async (id) => {
    try {
      await fetch(`${API_BASE}alerts/${id}/review/`, { method: "PATCH" });
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, reviewed: true } : a));
    } catch (e) {
      console.error("Failed to mark reviewed");
    }
  };

  const downloadReport = (type, id = "") => {
    if (type === "pdf" && id) {
      window.open(`${API_BASE}alerts/report/pdf/${id}/`, "_blank");
    } else if (type === "excel") {
      window.open(`${API_BASE}alerts/report/excel/`, "_blank");
    }
  };

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: "0 auto" }}>
      <header style={{ marginBottom: 32, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "#fff" }}>
            Alerts & Enterprise Reporting
          </h1>
          <p style={{ margin: "8px 0 0", color: "#94a3b8" }}>
            Manage compliance violations and download system-wide analytics.
          </p>
        </div>
        <button 
          onClick={() => downloadReport("excel")}
          style={{ background: "#10b981", border: "none", color: "#fff", padding: "10px 20px", borderRadius: 8, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
        >
          <BarChart3 size={16} style={{ marginRight: 6 }} /> Export Analytics (Excel)
        </button>
      </header>

      <GlassPanel title={<><AlertTriangle size={16} style={{marginRight:8, verticalAlign:"middle"}} /> Compliance Violations Log</>}>
        {loading ? (
          <div style={{ color: "#94a3b8", padding: 20 }}>Loading alerts...</div>
        ) : alerts.length === 0 ? (
          <div style={{ color: "#94a3b8", padding: 20 }}>No compliance alerts triggered.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ color: "#94a3b8", textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                <th style={{ padding: "12px 0" }}>Time</th>
                <th>Severity</th>
                <th>Rule Triggered</th>
                <th>Agent</th>
                <th>Audit Report</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a, i) => (
                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", opacity: a.reviewed ? 0.6 : 1 }}>
                  <td style={{ padding: "12px 0", color: "#cbd5e1" }}>{a.created_at}</td>
                  <td>
                    <span style={{
                      padding: "4px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                      background: a.severity === "CRITICAL" ? "rgba(239,68,68,0.2)" : a.severity === "WARNING" ? "rgba(251,191,36,0.2)" : "rgba(148,163,184,0.2)",
                      color: a.severity === "CRITICAL" ? "#fca5a5" : a.severity === "WARNING" ? "#fcd34d" : "#cbd5e1"
                    }}>
                      {a.severity}
                    </span>
                  </td>
                  <td style={{ color: "#e2e8f0" }}>{a.rule}</td>
                  <td style={{ color: "#94a3b8" }}>{a.agent_id}</td>
                  <td>
                    <button 
                      onClick={() => downloadReport("pdf", a.audit_id)}
                      style={{ background: "transparent", border: "1px solid #6366f1", color: "#a78bfa", padding: "4px 12px", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
                    >
                      <FileText size={12} style={{ marginRight: 4 }} /> Get PDF
                    </button>
                  </td>
                  <td>
                    {!a.reviewed && (
                      <button 
                         onClick={() => handleReview(a.id)}
                         style={{ background: "#475569", border: "none", color: "#fff", padding: "4px 12px", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
                      >
                        Mark Reviewed
                      </button>
                    )}
                    {a.reviewed && <span style={{ color: "#34d399", fontSize: 12 }}>✓ Reviewed</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </GlassPanel>
    </div>
  );
}
