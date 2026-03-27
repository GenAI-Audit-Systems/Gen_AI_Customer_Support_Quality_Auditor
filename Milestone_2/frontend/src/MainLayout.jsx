import React, { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard, FolderSearch, Zap,
  Bell, Bot, ChevronLeft, ChevronRight, Shield
} from "lucide-react";

const NAV = [
  { path: "/",          label: "Dashboard",    Icon: LayoutDashboard },
  { path: "/audit",     label: "Audit",        Icon: FolderSearch },
  { path: "/live",      label: "Live Audit",   Icon: Zap },
  { path: "/alerts",    label: "Alerts",       Icon: Bell },
  { path: "/copilot",   label: "Copilot",      Icon: Bot },
];

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [showLicense, setShowLicense] = useState(false);

  return (
    <div style={styles.shell}>
      <div style={styles.bg} />

      {/* Sidebar */}
      <motion.nav
        animate={{ width: collapsed ? 64 : 230 }}
        transition={{ duration: 0.3 }}
        style={styles.sidebar}
      >
        <div style={styles.logoRow}>
          {!collapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #6366f1, #a78bfa)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Shield size={16} color="#fff" />
              </div>
              <div>
                <div style={styles.logo}>AI Auditor</div>
                <div style={{ fontSize: 9, color: "#475569", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase" }}>Enterprise</div>
              </div>
            </motion.div>
          )}
          <button onClick={() => setCollapsed(!collapsed)} style={styles.collapseBtn}>
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        <div style={{ flex: 1, paddingTop: 8 }}>
          {NAV.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              style={({ isActive }) => ({
                ...styles.navItem,
                background: isActive
                  ? "linear-gradient(135deg, rgba(99,102,241,0.35), rgba(139,92,246,0.25))"
                  : "transparent",
                borderLeft: isActive ? "3px solid #6366f1" : "3px solid transparent",
                color: isActive ? "#e2e8f0" : "#94a3b8",
              })}
            >
              <item.Icon size={18} style={{ flexShrink: 0 }} />
              {!collapsed && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={styles.navLabel}>
                  {item.label}
                </motion.span>
              )}
            </NavLink>
          ))}
        </div>

        {/* License Footer */}
        {!collapsed && (
          <div style={styles.sidebarFooter}>
            <button onClick={() => setShowLicense(true)} style={styles.licenseBtn}>
              <Shield size={12} /> License
            </button>
          </div>
        )}
      </motion.nav>

      {/* Main content */}
      <main style={styles.main}>
        <Outlet />
      </main>

      {/* License Modal */}
      {showLicense && (
        <div style={styles.modalOverlay} onClick={() => setShowLicense(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#fff" }}>
                <Shield size={18} style={{ marginRight: 8, verticalAlign: "middle" }} />
                License
              </h2>
              <button onClick={() => setShowLicense(false)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 20 }}>×</button>
            </div>
            <div style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.8, maxHeight: 400, overflowY: "auto" }}>
              <p style={{ fontWeight: 700, color: "#a78bfa", marginBottom: 8 }}>MIT License</p>
              <p>Copyright © 2026 AI Auditor — GenAI-Powered Customer Support Quality Auditing Platform</p>
              <p style={{ marginTop: 12 }}>
                Permission is hereby granted, free of charge, to any person obtaining a copy
                of this software and associated documentation files (the "Software"), to deal
                in the Software without restriction, including without limitation the rights
                to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
                copies of the Software, and to permit persons to whom the Software is
                furnished to do so, subject to the following conditions:
              </p>
              <p style={{ marginTop: 12 }}>
                The above copyright notice and this permission notice shall be included in all
                copies or substantial portions of the Software.
              </p>
              <p style={{ marginTop: 12, color: "#64748b", fontSize: 11 }}>
                THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
                IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
                FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
                AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
                LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
                OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
                SOFTWARE.
              </p>
            </div>
          </div>
        </div>
      )}
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
    fontSize: 15,
    fontWeight: 800,
    background: "linear-gradient(135deg, #6366f1, #a78bfa)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    lineHeight: 1.2,
  },
  collapseBtn: {
    background: "rgba(99,102,241,0.2)",
    border: "none",
    color: "#a78bfa",
    borderRadius: 6,
    width: 28,
    height: 28,
    cursor: "pointer",
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
    fontSize: 14,
    fontWeight: 500,
    margin: "2px 8px",
    borderRadius: 8,
    transition: "all 0.2s",
  },
  navLabel: { whiteSpace: "nowrap", overflow: "hidden" },
  sidebarFooter: {
    padding: "16px",
    borderTop: "1px solid rgba(99,102,241,0.15)",
  },
  licenseBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "none",
    border: "1px solid rgba(99,102,241,0.2)",
    color: "#64748b",
    borderRadius: 8,
    padding: "8px 14px",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
    width: "100%",
    justifyContent: "center",
    transition: "all 0.2s",
  },
  main: {
    flex: 1,
    overflow: "auto",
    zIndex: 1,
    position: "relative",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.7)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    background: "rgba(15,23,42,0.95)",
    border: "1px solid rgba(99,102,241,0.3)",
    borderRadius: 16,
    padding: "28px 32px",
    maxWidth: 560,
    width: "90%",
    boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
  },
};
