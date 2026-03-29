import React, { useState } from "react";
import { LockKeyhole, Mail, Shield, UserPlus } from "lucide-react";
import { getApiBase } from "../lib/api";

const API_BASE = getApiBase();

const initialLogin = { email: "", password: "" };
const initialRegister = { email: "", password: "", role: "Supervisor", otp: "" };

export default function LoginPage() {
  const [mode, setMode] = useState("login");
  const [loginForm, setLoginForm] = useState(initialLogin);
  const [registerForm, setRegisterForm] = useState(initialRegister);
  const [otpRequested, setOtpRequested] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const saveSession = (user) => {
    window.localStorage.setItem("ai_auditor_auth", JSON.stringify({
      username: user.email || user.username,
      email: user.email || user.username,
      role: user.role || "Supervisor",
      loggedInAt: new Date().toISOString(),
    }));
    window.location.href = "/";
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(`${API_BASE}auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginForm),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Login failed.");
      }
      saveSession(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(`${API_BASE}auth/request-otp/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: registerForm.email,
          password: registerForm.password,
          role: registerForm.role,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Could not send OTP.");
      }
      setOtpRequested(true);
      setMessage(data.message || "OTP sent.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(`${API_BASE}auth/verify-register/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: registerForm.email,
          otp: registerForm.otp,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "OTP verification failed.");
      }
      saveSession(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.glow} />
      <div style={styles.card}>
        <div style={styles.logo}>
          <Shield size={20} color="#fff" />
        </div>
        <h1 style={styles.title}>AI Auditor Access</h1>
        <p style={styles.subtitle}>Log in with your email, or create a new account and verify it with an OTP sent to your email.</p>

        <div style={styles.switcher}>
          <button type="button" onClick={() => { setMode("login"); setError(""); setMessage(""); }} style={{ ...styles.switchButton, ...(mode === "login" ? styles.switchButtonActive : {}) }}>
            Login
          </button>
          <button type="button" onClick={() => { setMode("register"); setError(""); setMessage(""); }} style={{ ...styles.switchButton, ...(mode === "register" ? styles.switchButtonActive : {}) }}>
            New User
          </button>
        </div>

        {mode === "login" ? (
          <form onSubmit={handleLogin}>
            <label style={styles.label}>Email</label>
            <div style={styles.field}>
              <Mail size={16} color="#94a3b8" />
              <input
                value={loginForm.email}
                onChange={(e) => setLoginForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="name@email.com"
                style={styles.input}
              />
            </div>

            <label style={styles.label}>Password</label>
            <div style={styles.field}>
              <LockKeyhole size={16} color="#94a3b8" />
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
                placeholder="Enter password"
                style={styles.input}
              />
            </div>

            {message && <div style={styles.message}>{message}</div>}
            {error && <div style={styles.error}>{error}</div>}

            <button type="submit" style={styles.button} disabled={loading}>
              {loading ? "Signing In..." : "Log In"}
            </button>
          </form>
        ) : (
          <form onSubmit={otpRequested ? handleVerifyOtp : handleRequestOtp}>
            <label style={styles.label}>Email</label>
            <div style={styles.field}>
              <Mail size={16} color="#94a3b8" />
              <input
                value={registerForm.email}
                onChange={(e) => setRegisterForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="name@email.com"
                style={styles.input}
                disabled={otpRequested}
              />
            </div>

            <label style={styles.label}>Password</label>
            <div style={styles.field}>
              <LockKeyhole size={16} color="#94a3b8" />
              <input
                type="password"
                value={registerForm.password}
                onChange={(e) => setRegisterForm((prev) => ({ ...prev, password: e.target.value }))}
                placeholder="Create your password"
                style={styles.input}
                disabled={otpRequested}
              />
            </div>

            <label style={styles.label}>Role</label>
            <select
              value={registerForm.role}
              onChange={(e) => setRegisterForm((prev) => ({ ...prev, role: e.target.value }))}
              style={styles.select}
              disabled={otpRequested}
            >
              <option style={styles.option} value="Supervisor">Supervisor</option>
              <option style={styles.option} value="QA Manager">QA Manager</option>
              <option style={styles.option} value="Team Lead">Team Lead</option>
            </select>

            {otpRequested && (
              <>
                <label style={styles.label}>OTP</label>
                <div style={styles.field}>
                  <UserPlus size={16} color="#94a3b8" />
                  <input
                    value={registerForm.otp}
                    onChange={(e) => setRegisterForm((prev) => ({ ...prev, otp: e.target.value }))}
                    placeholder="Enter 6-digit OTP"
                    style={styles.input}
                  />
                </div>
              </>
            )}

            {message && <div style={styles.message}>{message}</div>}
            {error && <div style={styles.error}>{error}</div>}

            <button type="submit" style={styles.button} disabled={loading}>
              {loading ? "Please wait..." : otpRequested ? "Verify OTP & Create Account" : "Send OTP"}
            </button>

            {otpRequested && (
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => {
                  setOtpRequested(false);
                  setRegisterForm((prev) => ({ ...prev, otp: "" }));
                  setMessage("");
                  setError("");
                }}
              >
                Change details
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "#05070f",
    position: "relative",
    padding: 24,
  },
  glow: {
    position: "fixed",
    inset: 0,
    background:
      "radial-gradient(circle at 20% 20%, rgba(99,102,241,0.2), transparent 35%), radial-gradient(circle at 80% 10%, rgba(16,185,129,0.15), transparent 30%)",
    pointerEvents: "none",
  },
  card: {
    width: "100%",
    maxWidth: 460,
    padding: 32,
    borderRadius: 24,
    background: "rgba(10, 14, 28, 0.9)",
    border: "1px solid rgba(99,102,241,0.18)",
    boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
    backdropFilter: "blur(20px)",
    position: "relative",
    zIndex: 1,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 14,
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    display: "grid",
    placeItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 800,
    marginBottom: 8,
    color: "#fff",
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: 14,
    lineHeight: 1.6,
    marginBottom: 24,
  },
  switcher: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
    padding: 6,
    borderRadius: 14,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.06)",
    marginBottom: 24,
  },
  switchButton: {
    border: "none",
    borderRadius: 10,
    padding: "12px 14px",
    fontWeight: 700,
    cursor: "pointer",
    background: "transparent",
    color: "#94a3b8",
  },
  switchButtonActive: {
    background: "linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.2))",
    color: "#fff",
  },
  label: {
    display: "block",
    marginBottom: 8,
    color: "#cbd5e1",
    fontWeight: 600,
    fontSize: 13,
  },
  field: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: "0 14px",
    marginBottom: 16,
  },
  input: {
    width: "100%",
    background: "transparent",
    border: "none",
    outline: "none",
    color: "#fff",
    padding: "14px 0",
    fontSize: 14,
  },
  select: {
    width: "100%",
    background: "#10172b",
    border: "1px solid rgba(99,102,241,0.28)",
    borderRadius: 12,
    color: "#f8fafc",
    padding: "14px",
    fontSize: 14,
    marginBottom: 16,
    outline: "none",
  },
  option: {
    background: "#10172b",
    color: "#f8fafc",
  },
  message: {
    marginBottom: 16,
    color: "#6ee7b7",
    fontSize: 13,
    background: "rgba(16,185,129,0.08)",
    border: "1px solid rgba(16,185,129,0.18)",
    padding: "10px 12px",
    borderRadius: 10,
  },
  error: {
    marginBottom: 16,
    color: "#fca5a5",
    fontSize: 13,
    background: "rgba(248,113,113,0.08)",
    border: "1px solid rgba(248,113,113,0.18)",
    padding: "10px 12px",
    borderRadius: 10,
  },
  button: {
    width: "100%",
    border: "none",
    borderRadius: 12,
    padding: "14px 16px",
    background: "linear-gradient(135deg, #6366f1, #4f46e5)",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryButton: {
    width: "100%",
    marginTop: 12,
    borderRadius: 12,
    padding: "12px 16px",
    background: "rgba(255,255,255,0.04)",
    color: "#cbd5e1",
    border: "1px solid rgba(255,255,255,0.08)",
    fontWeight: 700,
    cursor: "pointer",
  },
};
