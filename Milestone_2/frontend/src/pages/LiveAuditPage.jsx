import React, { useState, useEffect, useRef } from "react";
import { GlassPanel } from "../components/ui/GlassPanel";
import { Zap, Sparkles, AlertTriangle } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api/";

export default function LiveAuditPage() {
  const [sessionId] = useState(`sess_${Math.floor(Math.random() * 10000)}`);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [streamingToken, setStreamingToken] = useState("");
  const [risk, setRisk] = useState(null);
  const [mode, setMode] = useState("auto"); // "ws" | "sse" | "auto"
  
  const ws = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingToken]);

  // Try WebSocket connection
  const connectWs = () => {
    setConnecting(true);
    const host = window.location.hostname === "localhost" ? "localhost:8000" : window.location.host;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    
    const socket = new WebSocket(`${protocol}//${host}/ws/audit/${sessionId}/?agent_id=demo_agent`);
    
    socket.onopen = () => {
      ws.current = socket;
      setConnected(true);
      setConnecting(false);
      setMode("ws");
    };
    
    socket.onclose = () => {
      setConnected(false);
      ws.current = null;
    };
    
    socket.onerror = () => {
      setConnecting(false);
      // If WebSocket fails, fall back to SSE mode
      setMode("sse");
      setConnected(true); // SSE is always "connected" via HTTP
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
      }
    }, 3000);
  };

  const handleServerEvent = (data) => {
    if (data.event === "token") {
      setStreamingToken(prev => prev + data.data);
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

  // SSE fallback: send turn via HTTP and read SSE stream
  const sendTurnSSE = async (turnText) => {
    setMessages(prev => [...prev, { role: "agent", text: turnText }]);

    try {
      const url = `${API_BASE}rag/stream-audit/?content=${encodeURIComponent(turnText)}&tenant_id=default`;
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

    // ALWAYS use the rock-solid SSE endpoint for AI turn evaluation
    // (Django Channels AsyncWebsocketConsumer freezes during sync LLM generators)
    sendTurnSSE(text);
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
            {connected ? "Live Stream Connected" : connecting ? "Connecting..." : "Disconnected"}
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
        <form onSubmit={sendTurn} style={{ display: "flex", padding: 16, borderTop: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.2)" }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type agent response..."
            style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "12px 16px", borderRadius: 8, outline: "none" }}
          />
          <button type="submit" disabled={!input.trim()} style={{ background: "#6366f1", border: "none", color: "#fff", padding: "0 24px", borderRadius: 8, marginLeft: 12, fontWeight: 600, cursor: !input.trim() ? "not-allowed" : "pointer" }}>
            Send Turn
          </button>
        </form>
      </GlassPanel>
    </div>
  );
}
