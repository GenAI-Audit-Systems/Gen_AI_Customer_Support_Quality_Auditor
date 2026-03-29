import React, { useState, useEffect } from "react";
import { GlassPanel } from "../components/ui/GlassPanel";
import { BarChart3, AlertTriangle, FileText } from "lucide-react";
import { getApiBase } from "../lib/api";

const API_BASE = getApiBase();
const getCurrentUserEmail = () => JSON.parse(window.localStorage.getItem("ai_auditor_auth") || "{}").email || "";

export default function AlertsPage() {
  const userEmail = getCurrentUserEmail();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const alertCounts = alerts.reduce((acc, alert) => {
    acc[alert.severity] = (acc[alert.severity] || 0) + 1;
    return acc;
  }, {});

  const fetchAlerts = async () => {
    try {
      const res = await fetch(`${API_BASE}alerts/history/?limit=100&user_email=${encodeURIComponent(userEmail)}`);
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
    const interval = setInterval(fetchAlerts, 10000);
    return () => clearInterval(interval);
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Critical", key: "CRITICAL", color: "#f87171" },
          { label: "Warning", key: "WARNING", color: "#fbbf24" },
          { label: "Info", key: "INFO", color: "#34d399" },
        ].map((item) => (
          <GlassPanel key={item.key} style={{ padding: 18 }}>
            <div style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8 }}>{item.label} Alerts</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: item.color }}>{alertCounts[item.key] || 0}</div>
          </GlassPanel>
        ))}
      </div>

      <GlassPanel title={<><AlertTriangle size={16} style={{marginRight:8, verticalAlign:"middle"}} /> Compliance Violations Log</>}>
        {loading ? (
          <div style={{ color: "#94a3b8", padding: 20 }}>Loading alerts...</div>
        ) : alerts.length === 0 ? (
          <div style={{ color: "#94a3b8", padding: 20 }}>
            No compliance alerts triggered yet for this user.
            <div style={{ marginTop: 10, fontSize: 12, color: "#64748b" }}>
              Submit a risky text or audio audit and this page will refresh automatically.
            </div>
          </div>
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
              {(alerts || []).map((a, i) => (
                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", opacity: a.reviewed ? 0.6 : 1 }}>
                  <td style={{ padding: "12px 0", color: "#cbd5e1" }}>{a.created_at}</td>
                  <td>
                    <span className={`badge ${a.severity === 'CRITICAL' ? 'b-red alert-critical' : a.severity === 'WARNING' ? 'b-amber' : 'b-green'}`}>
                      {a.severity}
                    </span>
                  </td>
                  <td style={{ color: "#e2e8f0", maxWidth: 400 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{a.rule.replace(/_/g, ' ')}</div>
                    <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.4 }}>{a.description}</div>
                  </td>
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
