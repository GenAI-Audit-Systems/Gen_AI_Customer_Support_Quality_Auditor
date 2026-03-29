import React, { useState, useEffect, useRef } from "react";
import { Zap, AlertTriangle } from "lucide-react";
import { GlassPanel } from "../components/ui/GlassPanel";
import { getApiBase, getWsBase } from "../lib/api";

const API_BASE = getApiBase();
const getCurrentUserEmail = () => JSON.parse(window.localStorage.getItem("ai_auditor_auth") || "{}").email || "";
const getWsUrl = (sessionId, userEmail) => {
  return `${getWsBase()}/ws/audit/${sessionId}/?agent_id=${encodeURIComponent(userEmail || "demo_agent")}`;
};

export default function LiveAuditPage() {
  const [sessionId] = useState(`sess_${Math.floor(Math.random() * 10000)}`);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [streamingToken, setStreamingToken] = useState("");
  const [risk, setRisk] = useState(null);
  const [mode, setMode] = useState("auto"); // "ws" | "sse" | "auto"
  const [statusMessage, setStatusMessage] = useState("Connecting to live socket...");
  const userEmail = getCurrentUserEmail();
  
  const ws = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingToken]);

  // Try WebSocket connection
  const connectWs = () => {
    setConnecting(true);
    setStatusMessage("Connecting to live socket...");
    const socket = new WebSocket(getWsUrl(sessionId, userEmail));
    
    socket.onopen = () => {
      ws.current = socket;
      setConnected(true);
      setConnecting(false);
      setMode("ws");
      setStatusMessage("Connected through WebSocket");
    };
    
    socket.onclose = () => {
      setConnected(false);
      ws.current = null;
    };
    
    socket.onerror = () => {
      setConnecting(false);
      setMode("sse");
      setConnected(true);
      setStatusMessage("WebSocket unavailable, using HTTP live stream");
    };
    
    socket.onmessage = (e) => {
      const data = JSON.parse(e.data);
      handleServerEvent(data);
    };

    // Timeout: if not connected in 3 seconds, fall back to SSE
    setTimeout(() => {
      if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
        if (socket.readyState === WebSocket.CONNECTING) {
          socket.close();
        }
        setMode("sse");
        setConnected(true);
        setConnecting(false);
        setStatusMessage("WebSocket timed out, using HTTP live stream");
      }
    }, 3000);
  };

  const handleServerEvent = (data) => {
    if (data.event === "token") {
      setStreamingToken(prev => prev + data.data);
    } else if (data.type === "UTTERANCE_SCORED") {
      const payload = data.data;
      setMessages(prev => {
        const newMsgs = [...prev];
        const last = newMsgs[newMsgs.length - 1];
        if (last && last.role === "agent") {
            const s = payload.scores || {};
            const msg = payload.justification ? `\n\nJustification: ${payload.justification}` : "";
            last.ai_analysis = `Empathy: ${s.empathy}/10 | Professionalism: ${s.professionalism}/10 | Compliance: ${s.compliance}/10 | Flags: ${payload.flags?.join(", ") || "None"} | [${payload.severity}]${msg}`;
        }
        return newMsgs;
      });
      if (payload.scores) {
         setRisk({ risk_score: payload.scores.compliance * 10, risk_level: payload.severity, flags: payload.flags });
      }
    } else if (data.type === "VIOLATION_DETECTED") {
      setMessages(prev => {
        const newMsgs = [...prev];
        const last = newMsgs[newMsgs.length - 1];
        if (last) last.flag = { flags: data.data.flags, severity: data.data.severity };
        return newMsgs;
      });
    } else if (data.event === "turn_complete" || data.event === "session_complete") {
      setMessages(prev => {
        const newMsgs = [...prev];
        const last = newMsgs[newMsgs.length - 1];
        if (last && last.role === "agent") {
          last.ai_analysis = last.ai_analysis || "";
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

  const sendTurnWs = (turnText) => {
    setMessages(prev => [...prev, { role: "agent", text: turnText }]);
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ turn_text: turnText, audit_id: 0, tenant_id: "default" }));
    } else {
      setMessages(prev => [...prev, { role: "system", text: "Error: WebSocket is disconnected." }]);
    }
  };

  // SSE fallback: send turn via HTTP and read SSE stream
  const sendTurnSSE = async (turnText) => {
    setMessages(prev => [...prev, { role: "agent", text: turnText }]);

    try {
      const url = `${API_BASE}rag/stream-audit/?content=${encodeURIComponent(turnText)}&tenant_id=default&user_email=${encodeURIComponent(userEmail)}`;
      const response = await fetch(url);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let analysis = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        
        const lines = buffer.split("\n");
        buffer = lines.pop(); // keep incomplete line
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6));
              if (event.event === "token") {
                analysis += event.data;
                setStreamingToken(analysis);
              } else if (event.event === "risk_update") {
                setRisk(event.data);
              }
            } catch {}
          }
        }
      }

      // Finalize
      setMessages(prev => {
        const newMsgs = [...prev];
        const last = newMsgs[newMsgs.length - 1];
        if (last && last.role === "agent") {
          last.ai_analysis = analysis;
        }
        return newMsgs;
      });
      setStreamingToken("");
    } catch (e) {
      console.error("SSE error:", e);
      setMessages(prev => [...prev, { role: "system", text: "Error: Could not reach audit API." }]);
    }
  };

  // WebSocket: send turn via WS
  const sendTurnWS = (turnText) => {
    setMessages(prev => [...prev, { role: "agent", text: turnText }]);
    ws.current.send(JSON.stringify({ turn_text: turnText, audit_id: 1, tenant_id: "default" }));
  };

  const sendTurn = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const text = input;
    setInput("");

    if (mode === "ws") {
      sendTurnWs(text);
    } else {
      sendTurnSSE(text);
    }
  };

  // Auto-connect on mount
  useEffect(() => {
    connectWs();
    return () => { if (ws.current) ws.current.close(); };
  }, []);

  return (
    <div style={{ padding: 32, maxWidth: 1000, margin: "0 auto", height: "calc(100vh - 64px)", display: "flex", flexDirection: "column" }}>
      <header style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: 10 }}><Zap size={28} /> Live Audit Stream</h1>
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
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: connected ? "#34d399" : connecting ? "#fbbf24" : "#f87171", fontSize: 14 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: connected ? "#34d399" : connecting ? "#fbbf24" : "#f87171", boxShadow: connected ? "0 0 10px #34d399" : "none" }} />
            {connected ? statusMessage : connecting ? "Connecting..." : "Disconnected"}
          </div>
        </div>
      </header>

      <GlassPanel style={{ flex: 1, display: "flex", flexDirection: "column", padding: 0 }}>
        <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
          {messages.length === 0 && <p style={{ color: "#64748b", textAlign: "center", marginTop: 100 }}>Type a message to simulate a live agent turn. The AI will stream an analysis per turn.</p>}
          
          {messages.map((m, i) => (
            <div key={i} style={{ alignSelf: m.role === "customer" ? "flex-start" : "flex-end", maxWidth: "80%" }}>
              <div style={{ background: m.role === "customer" ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg, #6366f1, #8b5cf6)", padding: "12px 16px", borderRadius: 16, color: "#fff", borderBottomRightRadius: m.role === "agent" ? 0 : 16, borderBottomLeftRadius: m.role === "customer" ? 0 : 16 }}>
                <span>{m.text}</span>
              </div>
              
              {/* Turn level AI analysis */}
              {(m.ai_analysis || (i === messages.length - 1 && streamingToken)) && (
                 <div style={{ marginTop: 8, fontSize: 13, color: "#a78bfa", background: "rgba(0,0,0,0.3)", padding: 12, borderRadius: 8, borderLeft: "2px solid #a78bfa" }}>
                   {m.ai_analysis || streamingToken}
                 </div>
              )}
              
              {/* Compliance Flag inline */}
              {m.flag && (
                 <div style={{ marginTop: 8, fontSize: 13, color: "#fca5a5", background: "rgba(239,68,68,0.15)", padding: "8px 12px", borderRadius: 8, borderLeft: "2px solid #ef4444", display: "flex", alignItems: "center", gap: 8 }}>
                   Flag: {m.flag.flags?.join(", ")}
                 </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div style={{ padding: '12px 24px', background: 'rgba(99,102,241,.05)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <p style={{ fontSize: 10, fontWeight: 900, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4 }}>Simulation Console</p>
          <p style={{ fontSize: 11, color: '#64748b' }}>
            Type below to simulate an <b>Agent</b>. Use <b>"C: "</b> or <b>"Customer: "</b> prefix to simulate a customer turn.
          </p>
        </div>
        <form onSubmit={sendTurn} style={{ display: "flex", padding: "16px 24px 24px", background: "rgba(0,0,0,0.2)" }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g., Hello, how can I help? or C: I want a refund"
            style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "12px 16px", borderRadius: 10, outline: "none", fontSize: 14 }}
          />
          <button type="submit" disabled={!input.trim()} style={{ background: "linear-gradient(135deg,#6366f1,#4f46e5)", border: "none", color: "#fff", padding: "0 24px", borderRadius: 10, marginLeft: 12, fontWeight: 700, cursor: !input.trim() ? "not-allowed" : "pointer", boxShadow: '0 4px 12px rgba(99,102,241,.2)' }}>
            Send Turn
          </button>
        </form>
      </GlassPanel>
    </div>
  );
}
