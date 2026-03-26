import React, { useState } from "react";
import { GlassPanel } from "../components/m3/GlassPanel";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api/";

export default function RAGAuditPage() {
  const [file, setFile] = useState(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleAudit = async () => {
    if (!file && !text) return;
    setLoading(true);
    setResult(null);

    const formData = new FormData();
    if (file) formData.append("file", file);
    else formData.append("content", text);
    formData.append("tenant_id", "default");

    try {
      const res = await fetch(`${API_BASE}rag/audit/`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setResult(data);
    } catch (e) {
      console.error(e);
      alert("Evaluation failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: "0 auto" }}>
      <header style={{ marginBottom: 32 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "#fff" }}>
          RAG Policy Audit
        </h1>
        <p style={{ margin: "8px 0 0", color: "#94a3b8" }}>
          Upload a transcript to evaluate it against latest compliance policies via Milvus.
        </p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: result ? "1fr 1fr" : "1fr", gap: 24, alignItems: "start" }}>
        
        {/* Input Panel */}
        <GlassPanel title="📁 Upload Transcript">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste Chat Transcript here..."
            style={{ 
              width: "100%", height: 160, background: "rgba(0,0,0,0.2)", color: "#fff",
              border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: 12,
              fontFamily: "monospace", resize: "none", marginBottom: 16
            }}
          />
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <input type="file" onChange={(e) => setFile(e.target.files[0])} style={{ color: "#94a3b8" }} />
            <button 
              onClick={handleAudit} 
              disabled={loading}
              style={{
                background: loading ? "#475569" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                border: "none", padding: "10px 24px", borderRadius: 8, color: "#fff",
                fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", marginLeft: "auto"
              }}
            >
              {loading ? "Evaluating..." : "Run RAG Audit"}
            </button>
          </div>
        </GlassPanel>

        {/* Results Panel */}
        {result && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <GlassPanel title={`📊 Audit Result (Score: ${result.audit?.overall_score}/100)`}>
              <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                <span style={{ background: "rgba(139,92,246,0.2)", color: "#c4b5fd", padding: "4px 12px", borderRadius: 12, fontSize: 12 }}>
                  Sentiment: {result.audit?.sentiment}
                </span>
                <span style={{ background: "rgba(16,185,129,0.2)", color: "#6ee7b7", padding: "4px 12px", borderRadius: 12, fontSize: 12 }}>
                  RAG Coverage: {result.rag_coverage * 100}%
                </span>
              </div>
              <p style={{ color: "#cbd5e1", lineHeight: 1.6, fontSize: 14 }}>{result.audit?.summary}</p>
              
              <h4 style={{ color: "#fff", marginTop: 16, marginBottom: 8 }}>Compliance Issues</h4>
              {result.audit?.compliance_issues?.length > 0 ? (
                <ul style={{ color: "#f87171", margin: 0, paddingLeft: 20, fontSize: 14 }}>
                  {result.audit.compliance_issues.map((iss, i) => <li key={i}>{iss}</li>)}
                </ul>
              ) : (
                <span style={{ color: "#34d399", fontSize: 14 }}>✓ No issues detected.</span>
              )}
            </GlassPanel>

            <GlassPanel title="📖 Retrieved Policy Evidence" delayed={0.1}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {result.policy_context?.map((chunk, i) => (
                  <div key={i} style={{ 
                    background: "rgba(0,0,0,0.2)", borderLeft: "3px solid #6366f1",
                    padding: 12, borderRadius: 4, fontSize: 13, color: "#94a3b8" 
                  }}>
                    <strong style={{ color: "#8b5cf6", display: "block", marginBottom: 4 }}>
                      File: {chunk.source_file} (Similarity: {chunk.score})
                    </strong>
                    {chunk.content}
                  </div>
                ))}
              </div>
            </GlassPanel>
          </div>
        )}
      </div>
    </div>
  );
}
