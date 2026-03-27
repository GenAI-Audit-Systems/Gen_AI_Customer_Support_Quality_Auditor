import React, { createContext, useContext, useState } from 'react';

const CopilotContext = createContext();

export function CopilotProvider({ children }) {
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Hello! I am your AI Supervisor Copilot. Ask me questions about agent performance, compliance trends, or recent alerts." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <CopilotContext.Provider value={{ messages, setMessages, input, setInput, loading, setLoading }}>
      {children}
    </CopilotContext.Provider>
  );
}

export function useCopilot() {
  const context = useContext(CopilotContext);
  if (!context) {
    throw new Error('useCopilot must be used within a CopilotProvider');
  }
  return context;
}
