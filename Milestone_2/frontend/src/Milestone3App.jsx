import React, { useState } from "react";
import { Routes, Route, NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

import SupervisorDashboard from "./pages/SupervisorDashboard";
import RAGAuditPage from "./pages/RAGAuditPage";
import LiveAuditPage from "./pages/LiveAuditPage";
import AlertsPage from "./pages/AlertsPage";
import CopilotPage from "./pages/CopilotPage";

const NAV = [
  { path: "/m3",          label: "Dashboard",  icon: "📊" },
  { path: "/m3/rag",      label: "RAG Audit",  icon: "🔍" },
  { path: "/m3/live",     label: "Live Audit", icon: "⚡" },
  { path: "/m3/alerts",   label: "Alerts",     icon: "🚨" },
  { path: "/m3/copilot",  label: "Copilot",    icon: "🤖" },
];

export default function Milestone3App() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={styles.shell}>
      {/* Animated mesh background */}
      <div style={styles.bg} />

      {/* Sidebar */}
      <motion.nav
        animate={{ width: collapsed ? 64 : 220 }}
        transition={{ duration: 0.3 }}
        style={styles.sidebar}
      >
        <div style={styles.logoRow}>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={styles.logo}
            >
              AI Auditor
            </motion.span>
          )}
          <button onClick={() => setCollapsed(!collapsed)} style={styles.collapseBtn}>
            {collapsed ? "›" : "‹"}
          </button>
        </div>

        {NAV.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/m3"}
            style={({ isActive }) => ({
              ...styles.navItem,
              background: isActive
                ? "linear-gradient(135deg, rgba(99,102,241,0.35), rgba(139,92,246,0.25))"
                : "transparent",
              borderLeft: isActive ? "3px solid #6366f1" : "3px solid transparent",
            })}
          >
            <span style={styles.navIcon}>{item.icon}</span>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={styles.navLabel}
              >
                {item.label}
              </motion.span>
            )}
          </NavLink>
        ))}

        {!collapsed && (
          <div style={styles.sidebarFooter}>
            <div style={styles.badge}>M3 + M4</div>
            <NavLink to="/" style={styles.backLink}>← Back to M2</NavLink>
          </div>
        )}
      </motion.nav>

      {/* Main content */}
      <main style={styles.main}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route index element={<SupervisorDashboard />} />
            <Route path="rag"     element={<RAGAuditPage />} />
            <Route path="live"    element={<LiveAuditPage />} />
            <Route path="alerts"  element={<AlertsPage />} />
            <Route path="copilot" element={<CopilotPage />} />
          </Routes>
        </AnimatePresence>
      </main>
    </div>
  );
}

const styles = {
  shell: {
    display: "flex",
    minHeight: "100vh",
    background: "#0b0f1e",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    color: "#e2e8f0",
    position: "relative",
    overflow: "hidden",
  },
  bg: {
    position: "fixed",
    inset: 0,
    background:
      "radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.15) 0%, transparent 60%)," +
      "radial-gradient(ellipse at 80% 20%, rgba(139,92,246,0.12) 0%, transparent 50%)",
    pointerEvents: "none",
    zIndex: 0,
  },
  sidebar: {
    background: "rgba(15,23,42,0.85)",
    backdropFilter: "blur(20px)",
    borderRight: "1px solid rgba(99,102,241,0.2)",
    display: "flex",
    flexDirection: "column",
    padding: "20px 0",
    position: "sticky",
    top: 0,
    height: "100vh",
    zIndex: 10,
    flexShrink: 0,
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 16px 20px",
    borderBottom: "1px solid rgba(99,102,241,0.15)",
  },
  logo: {
    fontSize: 16,
    fontWeight: 700,
    background: "linear-gradient(135deg, #6366f1, #a78bfa)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  collapseBtn: {
    background: "rgba(99,102,241,0.2)",
    border: "none",
    color: "#a78bfa",
    borderRadius: 6,
    width: 28,
    height: 28,
    cursor: "pointer",
    fontSize: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 16px",
    textDecoration: "none",
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: 500,
    margin: "2px 8px",
    borderRadius: 8,
    transition: "all 0.2s",
  },
  navIcon: { fontSize: 18, flexShrink: 0 },
  navLabel: { whiteSpace: "nowrap", overflow: "hidden" },
  sidebarFooter: {
    marginTop: "auto",
    padding: "16px",
    borderTop: "1px solid rgba(99,102,241,0.15)",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  badge: {
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: "white",
    borderRadius: 20,
    padding: "4px 12px",
    fontSize: 11,
    fontWeight: 700,
    textAlign: "center",
    letterSpacing: 1,
  },
  backLink: {
    color: "#64748b",
    textDecoration: "none",
    fontSize: 12,
    textAlign: "center",
  },
  main: {
    flex: 1,
    overflow: "auto",
    zIndex: 1,
    position: "relative",
  },
};
