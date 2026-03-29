import React from "react";
import { GlassPanel } from "../components/ui/GlassPanel";
import { useCopilot } from "../context/CopilotContext";
import { Bot, User } from "lucide-react";
import { getApiBase } from "../lib/api";

const API_BASE = getApiBase();

export default function CopilotPage() {
  const { messages, setMessages, input, setInput, loading, setLoading } = useCopilot();

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = { role: "user", text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}rag/copilot/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userMsg.text,
          tenant_id: "default"
        })
      });
      const data = await res.json();
      
      setMessages(prev => [...prev, { role: "assistant", text: data.answer || data.response }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", text: "Error connecting to AI Copilot." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 32, maxWidth: 800, margin: "0 auto", height: "calc(100vh - 64px)", display: "flex", flexDirection: "column" }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: 10 }}>
          <Bot size={28} /> AI Supervisor Copilot
        </h1>
        <p style={{ margin: "8px 0 0", color: "#94a3b8" }}>
          Query your analytics and policies using natural language.
        </p>
      </header>

      <GlassPanel style={{ flex: 1, display: "flex", flexDirection: "column", padding: 0 }}>
        {/* Chat History */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", opacity: m.role === "assistant" && loading && i === messages.length - 1 ? 0.5 : 1 }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                background: m.role === "assistant" ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "#475569",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18
              }}>
                {m.role === "assistant" ? <Bot size={16} color="#fff" /> : <User size={16} color="#fff" />}
              </div>
              <div style={{
                background: m.role === "assistant" ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.05)",
                border: m.role === "assistant" ? "1px solid rgba(99,102,241,0.2)" : "1px solid rgba(255,255,255,0.1)",
                padding: "12px 16px", borderRadius: "0 16px 16px 16px", color: "#e2e8f0", lineHeight: 1.5,
                borderTopLeftRadius: m.role === "assistant" ? 0 : 16,
                borderTopRightRadius: m.role === "user" ? 0 : 16,
                maxWidth: "85%"
              }}>
                 {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
               <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center" }}><Bot size={16} color="#fff" /></div>
               <div style={{ background: "rgba(99,102,241,0.1)", padding: "12px 16px", borderRadius: "0 16px 16px 16px", color: "#8b5cf6" }}>
                 Thinking...
               </div>
            </div>
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={sendMessage} style={{ display: "flex", padding: 16, borderTop: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.2)" }}>
           <input
             type="text"
             value={input}
             onChange={e => setInput(e.target.value)}
             placeholder="e.g. Which agents have the highest risk scores today?"
             disabled={loading}
             style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "12px 16px", borderRadius: 8, outline: "none" }}
           />
           <button type="submit" disabled={loading || !input.trim()} style={{ background: "#6366f1", border: "none", color: "#fff", padding: "0 24px", borderRadius: 8, marginLeft: 12, fontWeight: 600, cursor: loading || !input.trim() ? "not-allowed" : "pointer" }}>
             Ask AI
           </button>
        </form>
      </GlassPanel>
    </div>
  );
}
