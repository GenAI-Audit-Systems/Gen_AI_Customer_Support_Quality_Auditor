import React, { useState, useEffect } from "react";
import { ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, AreaChart, Area, XAxis, Tooltip } from "recharts";
import { GlassPanel } from "../components/ui/GlassPanel";
import { AlertTriangle, Users, Target, Thermometer } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api/";

export default function SupervisorDashboard() {
  const [agents, setAgents] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [heatmap, setHeatmap] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const [resAgents, resAlerts, resHeatmap] = await Promise.all([
        fetch(`${API_BASE}rag/agents/`).then(r => r.json()),
        fetch(`${API_BASE}alerts/history/?limit=5`).then(r => r.json()),
        fetch(`${API_BASE}rag/sentiment-heatmap/`).then(r => r.json()),
      ]);
      if (resAgents.agents) setAgents(resAgents.agents);
      if (resAlerts.alerts) setAlerts(resAlerts.alerts);
      if (resHeatmap.heatmap) setHeatmap(resHeatmap.heatmap);
    } catch (e) {
      console.error("Dashboard fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div style={{ padding: 40, color: "#94a3b8" }}>Loading AI Intelligence...</div>;
  }

  // Pick top agent for radar
  const topAgent = agents[0] || { avg_empathy: 0, avg_compliance: 0, avg_score: 0 };
  const radarData = [
    { metric: "Empathy", val: topAgent.avg_empathy * 10 },
    { metric: "Compliance", val: topAgent.avg_compliance * 10 },
    { metric: "Overall", val: topAgent.avg_score },
    { metric: "Resolution", val: topAgent.avg_score * 0.95 }, // simulation if missing
  ];

  return (
    <div style={{ padding: 32, maxWidth: 1400, margin: "0 auto" }}>
      <header style={{ marginBottom: 32 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "#fff" }}>
          Supervisor Intelligence
        </h1>
        <p style={{ margin: "8px 0 0", color: "#94a3b8" }}>
          Real-time AI analysis of {agents.length || 0} active agents
        </p>
      </header>

      {/* Alerts Ticker */}
      <GlassPanel title={<><AlertTriangle size={16} style={{marginRight:8, verticalAlign:"middle"}} /> Recent Compliance Alerts</>} delayed={0.1} style={{ marginBottom: 24, padding: "16px 24px" }}>
        <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 8 }}>
          {alerts.length === 0 ? <span style={{color: "#64748b"}}>No recent alerts.</span> : 
           alerts.map(a => (
            <div key={a.id} style={{ 
              background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)",
              padding: "8px 16px", borderRadius: 8, flexShrink: 0, color: "#f87171", fontSize: 13
            }}>
              <strong style={{ display: "block", marginBottom: 4 }}>{a.rule}</strong>
              Agent {a.agent_id} • Audit #{a.audit_id}
            </div>
          ))}
        </div>
      </GlassPanel>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24, alignItems: "start" }}>
        {/* Agent Grid */}
        <GlassPanel title={<><Users size={16} style={{marginRight:8, verticalAlign:"middle"}} /> Agent Performance Grid</>} delayed={0.2}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ color: "#94a3b8", textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                <th style={{ padding: "12px 0" }}>Agent ID</th>
                <th>Audits</th>
                <th>Avg Score</th>
                <th>Compliance</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {agents.slice(0, 10).map((ag, i) => (
                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <td style={{ padding: "12px 0", color: "#e2e8f0" }}>{ag.agent_id.substring(0, 15)}...</td>
                  <td style={{ color: "#94a3b8" }}>{ag.total_audits}</td>
                  <td>
                    <span style={{ 
                      color: ag.avg_score >= 80 ? "#34d399" : ag.avg_score >= 60 ? "#fbbf24" : "#f87171" 
                    }}>{ag.avg_score}</span>
                  </td>
                  <td>{ag.avg_compliance}/10</td>
                  <td>
                    <span style={{
                      padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                      background: ag.risk_level === "HIGH" ? "rgba(239,68,68,0.2)" : "rgba(52,211,153,0.1)",
                      color: ag.risk_level === "HIGH" ? "#fca5a5" : "#6ee7b7"
                    }}>
                      {ag.risk_level}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassPanel>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Radar */}
          <GlassPanel title={<><Target size={16} style={{marginRight:8, verticalAlign:"middle"}} /> Top Agent: {topAgent.agent_id?.substring(0,8) || "N/A"}</>} delayed={0.3} style={{ height: 300 }}>
             <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name="Score" dataKey="val" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.4} />
              </RadarChart>
            </ResponsiveContainer>
          </GlassPanel>
          
          {/* Sentiment Heatmap preview */}
          <GlassPanel title={<><Thermometer size={16} style={{marginRight:8, verticalAlign:"middle"}} /> Sentiment Volumes</>} delayed={0.4} style={{ height: 200 }}>
             {heatmap.length === 0 ? <p style={{color: "#64748b"}}>No data.</p> :
              <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={heatmap.slice(-10)}>
                    <XAxis dataKey="day" hide />
                    <Tooltip contentStyle={{ background: "#1e293b", border: "none", borderRadius: 8, color: "#e2e8f0" }} />
                    <Area type="monotone" dataKey="positive" stackId="1" stroke="#34d399" fill="#34d399" fillOpacity={0.6} />
                    <Area type="monotone" dataKey="negative" stackId="1" stroke="#f87171" fill="#f87171" fillOpacity={0.6} />
                 </AreaChart>
              </ResponsiveContainer>
             }
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}
