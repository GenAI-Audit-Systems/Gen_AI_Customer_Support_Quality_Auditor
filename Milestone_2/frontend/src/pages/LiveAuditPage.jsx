import React, { useState, useEffect, useRef } from "react";
import { GlassPanel } from "../components/m3/GlassPanel";

export default function LiveAuditPage() {
  const [sessionId, setSessionId] = useState(`sess_${Math.floor(Math.random() * 10000)}`);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [streamingToken, setStreamingToken] = useState("");
  const [risk, setRisk] = useState(null);
  
  const ws = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Only connect when explicitly requested in a real app, 
    // but we'll auto-connect for demo purposes.
    connectWs();
    return () => { if (ws.current) ws.current.close(); };
  }, [sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingToken]);

  const connectWs = () => {
    // In dev: ws://localhost:8000/ws/audit/sess_123/?agent_id=ag_1
    const host = window.location.hostname === "localhost" ? "localhost:8000" : window.location.host;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    
    ws.current = new WebSocket(`${protocol}//${host}/ws/audit/${sessionId}/?agent_id=demo_agent`);
    
    ws.current.onopen = () => setConnected(true);
    ws.current.onclose = () => setConnected(false);
    
    ws.current.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.event === "token") {
        setStreamingToken(prev => prev + data.data);
      } else if (data.event === "turn_complete") {
        setMessages(prev => {
          const newMsgs = [...prev];
          const last = newMsgs[newMsgs.length - 1];
          if (last && last.role === "agent") {
            last.ai_analysis = streamingToken;
          }
          return newMsgs;
        });
        setStreamingToken("");
      } else if (data.event === "risk_update") {
        setRisk(data.data);
      } else if (data.event === "compliance_flag") {
         setMessages(prev => {
           const newMsgs = [...prev];
           const last = newMsgs[newMsgs.length - 1];
           if (last) last.flag = data;
           return newMsgs;
         });
      }
    };
  };

  const sendTurn = (e) => {
    e.preventDefault();
    if (!input.trim() || !ws.current) return;
    
    setMessages(prev => [...prev, { role: "agent", text: input }]);
    ws.current.send(JSON.stringify({ turn_text: input, audit_id: 1, tenant_id: "default" }));
    setInput("");
  };

  return (
    <div style={{ padding: 32, maxWidth: 1000, margin: "0 auto", height: "calc(100vh - 64px)", display: "flex", flexDirection: "column" }}>
      <header style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "#fff" }}>⚡ Live Audit Stream</h1>
          <p style={{ margin: "4px 0 0", color: "#94a3b8" }}>Session: {sessionId}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {risk && (
            <span style={{ 
              background: risk.risk_level === "CRITICAL" ? "rgba(239,68,68,0.2)" : "rgba(251,191,36,0.2)",
              color: risk.risk_level === "CRITICAL" ? "#fca5a5" : "#fcd34d",
              padding: "6px 16px", borderRadius: 20, fontSize: 13, fontWeight: 600
            }}>
              Risk: {risk.risk_score}
            </span>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: connected ? "#34d399" : "#f87171", fontSize: 14 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: connected ? "#34d399" : "#f87171", boxShadow: connected ? "0 0 10px #34d399" : "none" }} />
            {connected ? "WebSocket Connected" : "Disconnected"}
          </div>
        </div>
      </header>

      <GlassPanel style={{ flex: 1, display: "flex", flexDirection: "column", padding: 0 }}>
        <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
          {messages.length === 0 && <p style={{ color: "#64748b", textAlign: "center", marginTop: 100 }}>Type a message to simulate a live agent turn. The AI will stream an analysis per turn.</p>}
          
          {messages.map((m, i) => (
            <div key={i} style={{ alignSelf: m.role === "customer" ? "flex-start" : "flex-end", maxWidth: "80%" }}>
              <div style={{ background: m.role === "customer" ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg, #6366f1, #8b5cf6)", padding: "12px 16px", borderRadius: 16, color: "#fff", borderBottomRightRadius: m.role === "agent" ? 0 : 16, borderBottomLeftRadius: m.role === "customer" ? 0 : 16 }}>
                {m.text}
              </div>
              
              {/* Turn level AI analysis */}
              {(m.ai_analysis || (i === messages.length - 1 && streamingToken)) && (
                 <div style={{ marginTop: 8, fontSize: 13, color: "#a78bfa", background: "rgba(0,0,0,0.3)", padding: 12, borderRadius: 8, borderLeft: "2px solid #a78bfa" }}>
                   ✨ {m.ai_analysis || streamingToken}
                 </div>
              )}
              
              {/* Compliance Flag inline */}
              {m.flag && (
                 <div style={{ marginTop: 8, fontSize: 13, color: "#fca5a5", background: "rgba(239,68,68,0.15)", padding: "8px 12px", borderRadius: 8, borderLeft: "2px solid #ef4444", display: "flex", alignItems: "center", gap: 8 }}>
                   🚨 Flag: {m.flag.flags.join(", ")}
                 </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <form onSubmit={sendTurn} style={{ display: "flex", padding: 16, borderTop: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.2)" }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type agent response..."
            disabled={!connected}
            style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "12px 16px", borderRadius: 8, outline: "none" }}
          />
          <button type="submit" disabled={!connected || !input.trim()} style={{ background: "#6366f1", border: "none", color: "#fff", padding: "0 24px", borderRadius: 8, marginLeft: 12, fontWeight: 600, cursor: (!connected || !input.trim()) ? "not-allowed" : "pointer" }}>
            Send Turn
          </button>
        </form>
      </GlassPanel>
    </div>
  );
}
