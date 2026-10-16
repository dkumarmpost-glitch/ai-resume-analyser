
import { GoogleLogin } from "@react-oauth/google";
import { useState, useEffect, useRef, useCallback } from "react";

import html2canvas from "html2canvas";

// jsPDF pulls in a Node-only dependency tree in Jest, which can fail in the
// test environment (e.g., TextEncoder not defined). Import it dynamically
// only when the user clicks “Download PDF”.
  const getJsPDF = async () => {
    // Import lazily to avoid Jest/node-only dependency issues.
    if (!window.__jsPDFPromise) {
      window.__jsPDFPromise = import('jspdf').then((m) => m.jsPDF);
    }
    return window.__jsPDFPromise;
  };

// ── Inject Google Fonts ──────────────────────────────────────────────────────
const FontLink = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
  `}</style>
);

// ── Theme Tokens ─────────────────────────────────────────────────────────────
const themes = {
  dark: {
    bg: "#0a0a0f",
    surface: "#13131a",
    surfaceAlt: "#1c1c28",
    border: "#2a2a3d",
    accent: "#6ee7b7",
    accentSoft: "rgba(110,231,183,0.12)",
    accentGlow: "rgba(110,231,183,0.3)",
    text: "#f0f0f5",
    textMuted: "#8888aa",
    textDim: "#555570",
    danger: "#f87171",
    warning: "#fbbf24",
    info: "#60a5fa",
    gradient: "linear-gradient(135deg,#0a0a0f 0%,#0f0f1e 100%)",
    cardGrad: "linear-gradient(145deg,#13131a,#1c1c28)",
    scoreBg: "#0d1f1a",
  },
  light: {
    bg: "#f5f5f7",
    surface: "#ffffff",
    surfaceAlt: "#eef0f6",
    border: "#dde0ea",
    accent: "#059669",
    accentSoft: "rgba(5,150,105,0.08)",
    accentGlow: "rgba(5,150,105,0.25)",
    text: "#0f0f1a",
    textMuted: "#5a5a78",
    textDim: "#aaaacc",
    danger: "#dc2626",
    warning: "#d97706",
    info: "#2563eb",
    gradient: "linear-gradient(135deg,#f5f5f7 0%,#eef0f6 100%)",
    cardGrad: "linear-gradient(145deg,#ffffff,#f0f2f8)",
    scoreBg: "#eaf7f2",
  },
};

// ── Global CSS ────────────────────────────────────────────────────────────────
const GlobalStyles = ({ t }) => (
  <style>{`
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'DM Sans', sans-serif; }
    h1,h2,h3,h4,h5,h6 { font-family: 'Syne', sans-serif; }

    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: ${t.bg}; }
    ::-webkit-scrollbar-thumb { background: ${t.border}; border-radius: 3px; }

    @keyframes fadeUp {
      from { opacity:0; transform:translateY(24px); }
      to   { opacity:1; transform:translateY(0); }
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
    @keyframes scoreArc {
      from { stroke-dashoffset: 339; }
    }
    @keyframes shimmer {
      0%   { background-position: -600px 0; }
      100% { background-position:  600px 0; }
    }
    @keyframes float {
      0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)}
    }
    @keyframes gradShift {
      0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%}
    }
    .fade-up { animation: fadeUp .55s cubic-bezier(.22,1,.36,1) both; }
    .delay-1 { animation-delay:.1s }
    .delay-2 { animation-delay:.2s }
    .delay-3 { animation-delay:.3s }
    .delay-4 { animation-delay:.4s }
    .delay-5 { animation-delay:.5s }
    .delay-6 { animation-delay:.6s }

    .nav-link {
      color: ${t.textMuted};
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      transition: color .2s;
      cursor: pointer;
    }
    .nav-link:hover { color: ${t.text}; }

    .btn-primary {
      background: ${t.accent};
      color: #000;
      border: none;
      border-radius: 10px;
      padding: 11px 26px;
      font-family: 'Syne', sans-serif;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: all .2s;
      letter-spacing: .3px;
    }
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px ${t.accentGlow};
    }
    .btn-ghost {
      background: transparent;
      color: ${t.text};
      border: 1px solid ${t.border};
      border-radius: 10px;
      padding: 10px 24px;
      font-family: 'Syne', sans-serif;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all .2s;
    }
    .btn-ghost:hover { border-color: ${t.accent}; color: ${t.accent}; }

    .card {
      background: ${t.cardGrad};
      border: 1px solid ${t.border};
      border-radius: 16px;
      padding: 24px;
      transition: box-shadow .25s;
    }
    .card:hover { box-shadow: 0 8px 32px rgba(0,0,0,.12); }

    .tag {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      font-family: 'DM Sans', sans-serif;
    }

    .input-field {
      width: 100%;
      background: ${t.surfaceAlt};
      border: 1px solid ${t.border};
      border-radius: 10px;
      padding: 12px 16px;
      color: ${t.text};
      font-family: 'DM Sans', sans-serif;
      font-size: 14px;
      outline: none;
      transition: border-color .2s;
    }
    .input-field:focus { border-color: ${t.accent}; }
    .input-field::placeholder { color: ${t.textDim}; }
  `}</style>
);

// ── Score Ring SVG ────────────────────────────────────────────────────────────
const ScoreRing = ({ score, size = 120, color }) => {
  const r = 50, cx = 60, cy = 60;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(128,128,160,0.15)" strokeWidth="10" />
      <circle
        cx={cx} cy={cy} r={r} fill="none"
        stroke={color} strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform="rotate(-90 60 60)"
        style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.22,1,.36,1)", animation: "scoreArc 1.2s ease both" }}
      />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle"
        fill={color} fontSize="22" fontWeight="800" fontFamily="Syne,sans-serif">
        {score}
      </text>
      <text x="50%" y="68%" dominantBaseline="middle" textAnchor="middle"
        fill="rgba(128,128,160,0.7)" fontSize="9" fontFamily="DM Sans,sans-serif">
        /100
      </text>
    </svg>
  );
};

// ── Skill Tag ─────────────────────────────────────────────────────────────────
const SkillTag = ({ label, present, t }) => (
  <span className="tag" style={{
    background: present ? t.accentSoft : "rgba(248,113,113,0.1)",
    color: present ? t.accent : t.danger,
    border: `1px solid ${present ? t.accentGlow : "rgba(248,113,113,0.25)"}`,
  }}>
    {present ? "✓" : "✗"} {label}
  </span>
);

// ── Progress Bar ──────────────────────────────────────────────────────────────
const Bar = ({ label, value, color, t }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
      <span style={{ fontSize: 13, color: t.textMuted, fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 13, color: t.text, fontWeight: 700 }}>{value}%</span>
    </div>
    <div style={{ height: 7, borderRadius: 10, background: t.surfaceAlt, overflow: "hidden" }}>
      <div style={{
        height: "100%", borderRadius: 10,
        background: color,
        width: `${value}%`,
        transition: "width 1.2s cubic-bezier(.22,1,.36,1)",
        boxShadow: `0 0 10px ${color}55`,
      }} />
    </div>
  </div>
);

// ── Pages ─────────────────────────────────────────────────────────────────────

// LANDING PAGE
const LandingPage = ({ t, onNavigate }) => {
  const features = [
    { icon: "🎯", title: "ATS Score",        desc: "Know how well your resume passes through Applicant Tracking Systems", page: "atsScore" },
    { icon: "⚡", title: "Skill Gap Analysis", desc: "Find missing skills based on your target role and industry",           page: null },
    { icon: "✏️", title: "Grammar Check",      desc: "Catch every typo, tone issue, and weak phrasing instantly",            page: "grammarCheck" },
    { icon: "💼", title: "Best Job Roles",    desc: "Discover which job titles match your current profile the most",       page: "bestJobRoles" },
    { icon: "🛠️", title: "Tech Stack Fit",    desc: "See how your tech skills align with real market demand",              page: null },
    { icon: "📊", title: "Full Report",       desc: "Get a complete visual breakdown of your resume strength",              page: null },
  ];

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Hero */}
      <section>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "140px 80px 80px 120px", textAlign: "center" }}>
          <div className="fade-up" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: t.accentSoft, border: `1px solid ${t.accentGlow}`,
            borderRadius: 20, padding: "6px 16px", marginBottom: 32,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: t.accent, display: "inline-block", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 12, color: t.accent, fontWeight: 600, letterSpacing: ".5px" }}>AI-POWERED RESUME INTELLIGENCE</span>
          </div>
          <h1 className="fade-up delay-1" style={{ fontSize: "clamp(48px,7vw,84px)", fontWeight: 800, color: t.text, lineHeight: 1.08, letterSpacing: "-2.5px", marginBottom: 32 }}>
            Land Your Dream Job<br />
            <span style={{ color: t.accent }}>Faster.</span>
          </h1>
          <p className="fade-up delay-2" style={{ fontSize: 18, color: t.textMuted, maxWidth: 540, margin: "0 auto 40px", lineHeight: 1.7, fontWeight: 300 }}>
            Upload your resume. Get instant ATS scores, skill gaps, grammar feedback, and the best-matched job roles — all in seconds.
          </p>
          <div className="fade-up delay-3" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="btn-primary" onClick={() => onNavigate("upload")} style={{ padding: "14px 36px", fontSize: 15 }}>
              Analyse My Resume →
            </button>
            <button className="btn-ghost" onClick={() => onNavigate("login")}>Login</button>
          </div>

          {/* Floating score preview */}
          <div className="fade-up delay-4" style={{ marginTop: 64, display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap" }}>
            {[["ATS Score","78","#6ee7b7"],["Skill Match","65","#60a5fa"],["Grammar","92","#a78bfa"]].map(([label, val, color]) => (
              <div key={label} className="card" style={{ textAlign: "center", padding: "20px 28px", animation: "float 4s ease-in-out infinite", animationDelay: Math.random()+"s" }}>
                <ScoreRing score={parseInt(val)} size={90} color={color} />
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 8, fontWeight: 600 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px 100px" }}>
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, color: t.text, letterSpacing: "-1px", marginBottom: 12 }}>
            Everything You Need
          </h2>
          <div style={{ width: 48, height: 3, borderRadius: 2, background: `linear-gradient(90deg, ${t.accent}, transparent)`, margin: "0 auto" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 20 }}>
          {features.map((f, i) => (
            <div
              key={f.title}
              id={f.page ? `landing-feature-${f.page}` : undefined}
              className={`fade-up delay-${i + 1}`}
              onClick={f.page ? () => onNavigate(f.page) : undefined}
              style={{
                cursor: f.page ? "pointer" : "default",
                background: t.cardGrad,
                border: `1px solid ${t.border}`,
                borderLeft: `3px solid ${f.page ? t.accent : t.border}`,
                borderRadius: 16,
                padding: 20,
                transition: "box-shadow .3s, transform .3s",
                position: "relative",
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 8px 32px ${t.accentGlow}`; e.currentTarget.style.transform = "translateY(-4px)"; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              {f.page && (
                <span style={{
                  position: "absolute", top: 14, right: 14,
                  fontSize: 10, fontWeight: 700, color: t.accent,
                  background: t.accentSoft, border: `1px solid ${t.accentGlow}`,
                  borderRadius: 6, padding: "2px 8px", letterSpacing: ".4px",
                }}>TRY IT →</span>
              )}
              <div style={{
                width: 44, height: 44, borderRadius: "50%",
                background: t.accentSoft,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, marginBottom: 14,
                border: `1px solid ${t.accentGlow}`,
              }}>{f.icon}</div>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: t.text, marginBottom: 8 }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: t.textMuted, lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

// AUTH PAGE
const AuthPage = ({ t, mode, onNavigate, onLogin }) => {
  const [tab, setTab] = useState(mode || "login");

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Signup state
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");

  // Forgot / Reset password state
  // loginView: "login" | "forgot" | "reset" | "resetSuccess"
  const [loginView, setLoginView] = useState("login");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMsg, setForgotMsg] = useState(null);
  const [forgotToken, setForgotToken] = useState("");       // test-mode token from API
  const [resetToken, setResetToken] = useState("");         // editable token input
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [resetMsg, setResetMsg] = useState(null);

  const [error, setError] = useState(null);
  
const handleGoogleSuccess = async (credentialResponse) => {
  setError(null);
  setSubmitting(true);

  try {
    const res = await fetch("http://localhost:5000/api/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        credential: credentialResponse.credential,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Google login failed.");
    }

    if (!data.token) {
      throw new Error("No authentication token received.");
    }

    localStorage.setItem("token", data.token);

    if (data.user) {
      localStorage.setItem("user", JSON.stringify(data.user));
    }

    if (onLogin) onLogin(data.user || {});
    onNavigate("upload");
  } catch (err) {
    setError(err.message || "Google login failed. Please try again.");
  } finally {
    setSubmitting(false);
  }
};

  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      
      const res = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `Login failed (${res.status})`);
      const token = data?.token;
      if (!token) throw new Error("Login succeeded but no token was returned by the server.");
      localStorage.setItem("token", token);
      if (data.user) localStorage.setItem("user", JSON.stringify(data.user));
      if (onLogin) onLogin(data.user || {});  // update shared auth state
      onNavigate("upload");
    } catch (err) {
      setError(String(err?.message || "Login failed. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignup = async (e) => {
    
    e.preventDefault();
    setError(null);
    if (signupPassword !== signupConfirm) {
      setError("Passwords do not match.");
      return;
    }
    if (signupPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("http://localhost:5000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: signupName, email: signupEmail, password: signupPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `Sign up failed (${res.status})`);
      const token = data?.token;
      if (!token) throw new Error("Sign up succeeded but no token was returned by the server.");
      localStorage.setItem("token", token);
      if (data.user) localStorage.setItem("user", JSON.stringify(data.user));
      if (onLogin) onLogin(data.user || {});  // update shared auth state
      onNavigate("upload");
    } catch (err) {
      setError(String(err?.message || "Sign up failed. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Forgot Password handler ──────────────────────────────────────────────────
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError(null);
    setForgotMsg(null);
    setSubmitting(true);
    try {
      const res = await fetch("http://localhost:5000/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Request failed.");
      setForgotMsg(data.message);
      if (data.resetToken) {
        setForgotToken(data.resetToken);
        setResetToken(data.resetToken); // pre-fill next form
      }
    } catch (err) {
      setError(String(err?.message || "Something went wrong. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Reset Password handler ───────────────────────────────────────────────────
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError(null);
    setResetMsg(null);
    if (newPassword !== confirmNewPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("http://localhost:5000/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetToken, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Reset failed.");
      setResetMsg(data.message);
      setLoginView("resetSuccess");
    } catch (err) {
      setError(String(err?.message || "Something went wrong. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Shared back-to-login helper ──────────────────────────────────────────────
  const goBackToLogin = () => {
    setLoginView("login");
    setError(null);
    setForgotMsg(null);
    setForgotToken("");
    setResetToken("");
    setNewPassword("");
    setConfirmNewPassword("");
    setResetMsg(null);
  };

  // ── Inline style helpers (reused across sub-views) ──────────────────────────
  const infoBox = {
    background: "rgba(96,165,250,0.1)",
    border: "1px solid rgba(96,165,250,0.3)",
    color: t.info,
    padding: "10px 12px",
    borderRadius: 10,
    fontSize: 13,
    lineHeight: 1.5,
    marginBottom: 14,
    wordBreak: "break-all",
  };
  const successBox = {
    background: "rgba(110,231,183,0.1)",
    border: `1px solid ${t.accentGlow}`,
    color: t.accent,
    padding: "10px 12px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1.4,
    marginBottom: 14,
  };
  const backLink = {
    display: "block",
    textAlign: "center",
    fontSize: 13,
    color: t.accent,
    cursor: "pointer",
    fontWeight: 600,
    marginTop: 14,
  };

  // ── Render the correct sub-view when on the Login tab ───────────────────────
  const renderLoginTab = () => {
    // ── 1. Normal login form ─────────────────────────────────────────────────
    if (loginView === "login") return (
      <>
        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <input
            className="input-field" type="email" placeholder="Email address"
            value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)}
            autoComplete="email" required
          />
          <input
            className="input-field" type="password" placeholder="Password"
            value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)}
            autoComplete="current-password" required
          />
          <button className="btn-primary" type="submit" disabled={submitting}
            style={{ width: "100%", padding: "13px", marginTop: 4, opacity: submitting ? 0.75 : 1 }}
          >
            {submitting ? "Logging in…" : "Login →"}
          </button>
        </form>
        
<div style={{ marginTop: 18, display: "flex", justifyContent: "center" }}>
  <GoogleLogin
    onSuccess={handleGoogleSuccess}
    onError={() => setError("Google login was unsuccessful. Please try again.")}
    useOneTap={false}
  />
</div>

        {/* Forgot password link */}
        <p style={{ textAlign: "center", marginTop: 14 }}>
          <span
            style={{ fontSize: 13, color: t.textMuted, cursor: "pointer" }}
            onClick={() => { setLoginView("forgot"); setError(null); }}
          >
            Forgot password?
          </span>
        </p>
      </>
    );

    // ── 2. Forgot password form ──────────────────────────────────────────────
    if (loginView === "forgot") return (
      <>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 6 }}>
          Forgot Password
        </h3>
        <p style={{ fontSize: 13, color: t.textMuted, marginBottom: 16, lineHeight: 1.6 }}>
          Enter your account email. We'll generate a reset token for you.
        </p>

        {/* Show the test-mode token once received */}
        {forgotToken && (
          <div style={infoBox}>
            <strong>🧪 TEST MODE — your reset token is:</strong>
            <br />
            <code style={{ fontSize: 11, letterSpacing: "0.5px" }}>{forgotToken}</code>
            <br /><br />
            Copy this and use it on the next screen. In production this would be emailed to you instead.
          </div>
        )}
        {forgotMsg && !forgotToken && (
          <div style={successBox}>{forgotMsg}</div>
        )}

        {!forgotToken ? (
          <form onSubmit={handleForgotPassword} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <input
              className="input-field" type="email" placeholder="Your account email"
              value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)}
              autoComplete="email" required
            />
            <button className="btn-primary" type="submit" disabled={submitting}
              style={{ width: "100%", padding: "13px", opacity: submitting ? 0.75 : 1 }}
            >
              {submitting ? "Sending…" : "Send Reset Link →"}
            </button>
          </form>
        ) : (
          <button
            className="btn-primary"
            style={{ width: "100%", padding: "13px" }}
            onClick={() => { setLoginView("reset"); setError(null); }}
          >
            I have my reset token →
          </button>
        )}

        <span style={backLink} onClick={goBackToLogin}>← Back to Login</span>
      </>
    );

    // ── 3. Reset password form ───────────────────────────────────────────────
    if (loginView === "reset") return (
      <>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 6 }}>
          Reset Password
        </h3>
        <p style={{ fontSize: 13, color: t.textMuted, marginBottom: 16, lineHeight: 1.6 }}>
          Paste your reset token and choose a new password.
        </p>
        <form onSubmit={handleResetPassword} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <input
            className="input-field" placeholder="Reset token"
            value={resetToken} onChange={(e) => setResetToken(e.target.value)}
            required style={{ fontFamily: "monospace", fontSize: 12 }}
          />
          <input
            className="input-field" type="password" placeholder="New password (min 6 chars)"
            value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password" required
          />
          <input
            className="input-field" type="password" placeholder="Confirm new password"
            value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)}
            autoComplete="new-password" required
          />
          <button className="btn-primary" type="submit" disabled={submitting}
            style={{ width: "100%", padding: "13px", opacity: submitting ? 0.75 : 1 }}
          >
            {submitting ? "Resetting…" : "Reset Password →"}
          </button>
        </form>
        <span style={backLink} onClick={goBackToLogin}>← Back to Login</span>
      </>
    );

    // ── 4. Success screen ────────────────────────────────────────────────────
    if (loginView === "resetSuccess") return (
      <>
        <div style={successBox}>
          ✅ {resetMsg || "Password reset successful. You can now log in."}
        </div>
        <button
          className="btn-primary"
          style={{ width: "100%", padding: "13px" }}
          onClick={goBackToLogin}
        >
          Back to Login →
        </button>
      </>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: t.gradient, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="card fade-up" style={{ width: "100%", maxWidth: 420 }}>
        {/* Tab switcher — only show when not in a sub-view */}
        <div style={{ display: "flex", marginBottom: 28, background: t.surfaceAlt, borderRadius: 10, padding: 4 }}>
          {["login", "signup"].map((m) => (
            <button
              key={m}
              onClick={() => { setTab(m); setError(null); goBackToLogin(); }}
              style={{
                flex: 1, padding: "9px 0", border: "none", borderRadius: 8, cursor: "pointer",
                background: tab === m ? t.accent : "transparent",
                color: tab === m ? "#000" : t.textMuted,
                fontFamily: "Syne,sans-serif", fontWeight: 700, fontSize: 14, transition: "all .2s",
              }}
            >
              {m === "login" ? "Login" : "Sign Up"}
            </button>
          ))}
        </div>

        {/* Heading — adapts to sub-view */}
        {loginView === "login" && (
          <>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: t.text, marginBottom: 6 }}>
              {tab === "login" ? "Welcome back" : "Create account"}
            </h2>
            <p style={{ fontSize: 13, color: t.textMuted, marginBottom: 24 }}>
              {tab === "login" ? "Sign in to access your resume history" : "Start analysing your resume for free"}
            </p>
          </>
        )}

        {/* Global error banner */}
        {error && (
          <div style={{
            background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)",
            color: t.danger, padding: "10px 12px", borderRadius: 10,
            fontSize: 13, fontWeight: 600, lineHeight: 1.4, marginBottom: 14,
          }}>
            {error}
          </div>
        )}

        {/* Main content area */}
        {tab === "login" ? renderLoginTab() : (
          <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <input
              className="input-field" placeholder="Full Name"
              value={signupName} onChange={(e) => setSignupName(e.target.value)} required
            />
            <input
              className="input-field" type="email" placeholder="Email address"
              value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)}
              autoComplete="email" required
            />
            <input
              className="input-field" type="password" placeholder="Password (min 6 chars)"
              value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)}
              autoComplete="new-password" required
            />
            <input
              className="input-field" type="password" placeholder="Confirm Password"
              value={signupConfirm} onChange={(e) => setSignupConfirm(e.target.value)}
              autoComplete="new-password" required
            />
            <button className="btn-primary" type="submit" disabled={submitting}
              style={{ width: "100%", padding: "13px", marginTop: 4, opacity: submitting ? 0.75 : 1 }}
            >
              {submitting ? "Creating account…" : "Create Account →"}
            </button>
          </form>
        )}

        {/* Bottom tab-switch link — only show on root views */}
        {loginView === "login" && (
          <p style={{ textAlign: "center", fontSize: 13, color: t.textMuted, marginTop: 20 }}>
            {tab === "login" ? "Don't have an account? " : "Already have an account? "}
            <span
              style={{ color: t.accent, cursor: "pointer", fontWeight: 600 }}
              onClick={() => { setTab(tab === "login" ? "signup" : "login"); setError(null); }}
            >
              {tab === "login" ? "Sign Up" : "Login"}
            </span>
          </p>
        )}
      </div>
    </div>
  );
};


// UPLOAD PAGE
const UploadPage = ({ t, onAnalyse, onNavigate, mode }) => {
  const [file, setFile] = useState(null);
  const [jd, setJd] = useState("");
  const [role, setRole] = useState("");
  const [dragging, setDragging] = useState(false);
  const [backHover, setBackHover] = useState(false);
  const inputRef = useRef();

  const token = localStorage.getItem("token");
  const isAuthed = Boolean(token);
  const isBestJobRolesMode = mode === "bestJobRoles";


  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  if (!isAuthed) {
    return (
      <div style={{ minHeight: "100vh", background: t.gradient, padding: "60px 24px", display: "flex", alignItems: "center" }}>
        <div style={{ maxWidth: 680, margin: "0 auto", width: "100%" }}>
          <h1 className="fade-up" style={{ fontSize: 36, fontWeight: 800, color: t.text, letterSpacing: "-1.5px", marginBottom: 12 }}>
            Sign in to analyse your resume
          </h1>
          <p className="fade-up delay-1" style={{ color: t.textMuted, marginBottom: 28, fontSize: 15, lineHeight: 1.7 }}>
            Your analysis is saved to history only for signed-in users.
          </p>
          <button
            className="btn-primary"
            onClick={() => {
              console.log("Login button clicked");
              onNavigate("login");
            }}
            style={{ padding: "12px 24px", fontSize: 14 }}
          >
            Login →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: t.gradient, padding: "60px 24px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>


        {/* Back Button */}
        <button
          className="fade-up"
          onClick={() => onNavigate("home")}
          onMouseEnter={() => setBackHover(true)}
          onMouseLeave={() => setBackHover(false)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: backHover ? t.accentSoft : "transparent",
            border: `1px solid ${backHover ? t.accentGlow : t.border}`,
            borderRadius: 10, padding: "8px 16px",
            color: backHover ? t.accent : t.textMuted,
            fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500,
            cursor: "pointer", marginBottom: 28,
            transition: "all .25s ease",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back to Home
        </button>

        {isBestJobRolesMode ? (
          /* ── Best Job Roles mode header ──────────────────────────────── */
          <>
            <div className="fade-up" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.3)",
              borderRadius: 20, padding: "5px 14px", marginBottom: 20,
            }}>
              <span style={{ fontSize: 12, color: "#60a5fa", fontWeight: 700, letterSpacing: ".5px" }}>💼 BEST JOB ROLES</span>
            </div>
            <h1 className="fade-up" style={{ fontSize: 36, fontWeight: 800, color: t.text, letterSpacing: "-1.5px", marginBottom: 8 }}>
              Find Your Best Job Roles
            </h1>
            <p className="fade-up delay-1" style={{ color: t.textMuted, marginBottom: 36, fontSize: 15, lineHeight: 1.7 }}>
              Upload your resume and our AI will match it against your strongest job roles — then show you real live job listings.
            </p>
          </>
        ) : (
          /* ── Normal upload mode header ────────────────────────────────── */
          <>
            <h1 className="fade-up" style={{ fontSize: 36, fontWeight: 800, color: t.text, letterSpacing: "-1.5px", marginBottom: 8 }}>
              Upload Resume
            </h1>
            <p className="fade-up delay-1" style={{ color: t.textMuted, marginBottom: 36, fontSize: 15 }}>
              Drop your resume and we'll run a full AI-powered analysis
            </p>
          </>
        )}

        {/* Drop Zone — identical in both modes */}
        <div
          className="fade-up delay-2"
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current.click()}
          style={{
            border: `2px dashed ${dragging ? t.accent : t.border}`,
            borderRadius: 16, padding: "48px 32px", textAlign: "center",
            cursor: "pointer", marginBottom: 24,
            background: dragging ? t.accentSoft : t.surfaceAlt,
            transition: "all .2s",
          }}
        >
          <input ref={inputRef} type="file" accept=".pdf,.docx,.jpg,.jpeg,.png" style={{ display: "none" }}
            onChange={e => setFile(e.target.files[0])} />
          <div style={{ fontSize: 40, marginBottom: 12 }}>{file ? "📄" : "☁️"}</div>
          {file ? (
            <>
              <p style={{ fontWeight: 700, color: t.text, fontSize: 16 }}>{file.name}</p>
              <p style={{ color: t.accent, fontSize: 13, marginTop: 4 }}>✓ File ready</p>
            </>
          ) : (
            <>
              <p style={{ fontWeight: 700, color: t.text, fontSize: 16 }}>Drag & drop your resume</p>
              <p style={{ color: t.textMuted, fontSize: 13, marginTop: 4 }}>Supports PDF, DOCX and Images • Max 5MB</p>
            </>
          )}
        </div>

        {/* Job Role + JD inputs — hidden in Best Job Roles mode */}
        {!isBestJobRolesMode && (
          <>
            {/* Job Role Input */}
            <div className="fade-up delay-3" style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: t.textMuted, marginBottom: 8 }}>
                TARGET JOB ROLE (optional)
              </label>
              <input className="input-field" placeholder="e.g. Frontend Developer, Data Scientist..."
                value={role} onChange={e => setRole(e.target.value)} />
            </div>

            {/* JD Input */}
            <div className="fade-up delay-4" style={{ marginBottom: 28 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: t.textMuted, marginBottom: 8 }}>
                JOB DESCRIPTION (optional but recommended)
              </label>
              <textarea className="input-field" rows={5}
                placeholder="Paste the job description here for more accurate ATS scoring..."
                value={jd} onChange={e => setJd(e.target.value)}
                style={{ resize: "vertical" }} />
            </div>
          </>
        )}

        {isBestJobRolesMode && <div style={{ marginBottom: 28 }} />}

        <button className="btn-primary fade-up delay-5"
          style={{ width: "100%", padding: "15px", fontSize: 16 }}
          onClick={() => onAnalyse({ file, jd: isBestJobRolesMode ? "" : jd, role: isBestJobRolesMode ? "" : role })}
          disabled={!file}
        >
          {isBestJobRolesMode
            ? (file ? "Find My Best Job Roles →" : "Upload a Resume First")
            : (file ? "Run AI Analysis →" : "Upload a Resume First")}
        </button>
      </div>
    </div>
  );
};

// LOADING SCREEN
const LoadingScreen = ({ t }) => {
  const steps = ["Parsing resume content...", "Running ATS simulation...", "Checking grammar & tone...", "Analysing skill gaps...", "Matching job roles...", "Generating full report..."];
  const [step, setStep] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setStep((s) => (s + 1) % steps.length), 900);
    return () => clearInterval(iv);
  }, [steps.length]);
  return (
    <div style={{ minHeight: "100vh", background: t.gradient, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24 }}>
      <div style={{ width: 56, height: 56, border: `3px solid ${t.border}`, borderTopColor: t.accent, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 18, fontWeight: 700, color: t.text, fontFamily: "Syne,sans-serif" }}>Analysing your resume</p>
        <p style={{ fontSize: 14, color: t.accent, marginTop: 8, animation: "pulse 1.5s infinite" }}>{steps[step]}</p>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        {steps.map((_, i) => (
          <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: i <= step ? t.accent : t.border, transition: "background .3s" }} />
        ))}
      </div>
    </div>
  );
};

// ── Resume X-Ray View (reusable — renders as page content, not an overlay) ──
// Used by both ATSScorePage and the legacy modal wrapper below.
const ResumeXRayView = ({ t, result, onBack, backLabel = "← Back to Results" }) => {
  const checklist = result.atsChecklist || [];
  const rawText = result.rawExtractedText || "(No raw text available — this may be an older analysis record.)";
  const fileName = result.fileName || "resume";

  return (
    <div className="fade-up" style={{ width: "100%" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8,
            background: t.accentSoft, border: `1px solid ${t.accentGlow}`,
            borderRadius: 20, padding: "4px 14px", marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: t.accent, fontWeight: 700, letterSpacing: ".5px" }}>🔍 RESUME X-RAY</span>
          </div>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: t.text, letterSpacing: "-1px", margin: 0 }}>
            What the ATS Bot Actually Sees
          </h2>
          <p style={{ fontSize: 13, color: t.textMuted, marginTop: 8, lineHeight: 1.6 }}>
            This is the raw text a machine reads — no formatting, no design, no fonts.
          </p>
        </div>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              background: t.surfaceAlt, border: `1px solid ${t.border}`,
              borderRadius: 10, padding: "8px 18px",
              color: t.textMuted, fontSize: 13, fontWeight: 600,
              cursor: "pointer", flexShrink: 0, transition: "all .2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = t.accent; e.currentTarget.style.color = t.accent; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textMuted; }}
          >
            {backLabel}
          </button>
        )}
      </div>

      {/* ── Side-by-side comparison ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 32 }}>

        {/* Left — What You See */}
        <div style={{
          background: t.surfaceAlt, border: `1px solid ${t.border}`,
          borderRadius: 16, padding: 20,
          display: "flex", flexDirection: "column", gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>👁️</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>What You See</span>
          </div>
          <div style={{
            flex: 1, borderRadius: 12,
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${t.border}`,
            padding: 20,
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", gap: 14, minHeight: 200,
            textAlign: "center",
          }}>
            <span style={{ fontSize: 48 }}>📄</span>
            <div>
              <p style={{ fontWeight: 700, color: t.text, fontSize: 14, marginBottom: 4 }}>{fileName}</p>
              <p style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.6 }}>
                Your beautifully designed resume — with fonts, colours, icons, and layout.
              </p>
            </div>
            <div style={{
              background: t.accentSoft, border: `1px solid ${t.accentGlow}`,
              borderRadius: 8, padding: "6px 14px",
              fontSize: 12, color: t.accent, fontWeight: 600,
            }}>
              Human-readable ✓
            </div>
          </div>
        </div>

        {/* Right — What the ATS Sees */}
        <div style={{
          background: t.surfaceAlt, border: `1px solid ${t.border}`,
          borderRadius: 16, padding: 20,
          display: "flex", flexDirection: "column", gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>🤖</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>What the ATS Sees</span>
          </div>
          <div style={{
            flex: 1, borderRadius: 12,
            background: "#0d0d0d",
            border: "1px solid #2a2a2a",
            padding: 16,
            overflowY: "auto",
            maxHeight: 320,
            minHeight: 200,
          }}>
            <pre style={{
              fontFamily: "'Courier New', Courier, monospace",
              fontSize: 11,
              color: "#a0a0a0",
              lineHeight: 1.8,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              margin: 0,
            }}>{
              (rawText || '')
                .replace(/([a-z])([A-Z])/g, '$1 $2')
                .replace(/([a-zA-Z])([0-9])/g, '$1 $2')
                .replace(/([0-9])([a-zA-Z])/g, '$1 $2')
                .replace(/([.,!?;:])([a-zA-Z])/g, '$1 $2')
                .replace(/([a-zA-Z])([@#])/g, '$1 $2')
            }</pre>
          </div>
          <p style={{ fontSize: 11, color: t.textDim, lineHeight: 1.5 }}>
            ⚠ No styling, no columns, no icons — just plain text. This is what every ATS bot processes.
          </p>
        </div>
      </div>

      {/* ── ATS Parsability Checklist ── */}
      <div>
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: t.text, marginBottom: 6, display: "flex", alignItems: "center", gap: 10 }}>
            🛡️ Structural Parsability Checklist
            <span className="tag" style={{
              background: t.accentSoft, color: t.accent,
              border: `1px solid ${t.accentGlow}`, fontSize: 11,
            }}>
              {checklist.filter(c => c.passed).length}/{checklist.length} passed
            </span>
          </h3>
          <p style={{ fontSize: 12, color: t.textMuted }}>
            Structure-only checks — same logic applies to any resume, any profession.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14 }}>
          {checklist.map((item, i) => {
            const passed = item.passed;
            const passedColors = { bg: "rgba(110,231,183,0.1)", color: "#6ee7b7", border: "rgba(110,231,183,0.3)" };
            const failedColors = { bg: "rgba(248,113,113,0.08)", color: "#f87171", border: "rgba(248,113,113,0.28)" };
            const c = passed ? passedColors : failedColors;
            return (
              <div
                key={i}
                style={{
                  padding: 16, borderRadius: 14,
                  background: t.surfaceAlt,
                  border: `1px solid ${c.border}`,
                  display: "flex", flexDirection: "column", gap: 10,
                  transition: "transform .2s, box-shadow .2s",
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 6px 20px ${c.border}`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: c.bg, border: `1px solid ${c.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16, flexShrink: 0, fontWeight: 700,
                  }}>
                    {passed ? "✓" : "✗"}
                  </span>
                  <p style={{ fontWeight: 700, color: t.text, fontSize: 14, flex: 1, margin: 0 }}>
                    {item.check}
                  </p>
                  <span className="tag" style={{
                    background: c.bg, color: c.color,
                    border: `1px solid ${c.border}`, fontSize: 11,
                  }}>
                    {passed ? "Pass" : "Fail"}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.7, margin: 0 }}>
                  {item.detail}
                </p>
              </div>
            );
          })}
          {checklist.length === 0 && (
            <div style={{ gridColumn: "1 / -1", padding: 24, textAlign: "center" }}>
              <p style={{ fontSize: 14, color: t.textDim }}>
                No checklist data available — re-analyse this resume to generate X-Ray results.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Resume X-Ray Modal (thin wrapper around ResumeXRayView for legacy compat) ─
const ResumeXRayModal = ({ t, result, onClose }) => {
  const checklist = result.atsChecklist || [];
  const rawText = result.rawExtractedText || "(No raw text available — this may be an older analysis record.)";
  const fileName = result.fileName || "resume";

  return (
    <div
      id="resume-xray-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.82)",
        backdropFilter: "blur(8px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "32px 16px",
        overflowY: "auto",
        animation: "fadeUp .35s cubic-bezier(.22,1,.36,1) both",
      }}
    >
      <div style={{
        width: "100%", maxWidth: 900,
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: 20,
        padding: 32,
        boxShadow: `0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px ${t.border}`,
      }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, gap: 16 }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8,
              background: t.accentSoft, border: `1px solid ${t.accentGlow}`,
              borderRadius: 20, padding: "4px 14px", marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: t.accent, fontWeight: 700, letterSpacing: ".5px" }}>🔍 RESUME X-RAY</span>
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: t.text, letterSpacing: "-0.8px", margin: 0 }}>
              What the ATS Bot Actually Sees
            </h2>
            <p style={{ fontSize: 13, color: t.textMuted, marginTop: 6, lineHeight: 1.6 }}>
              This is the raw text a machine reads — no formatting, no design, no fonts.
            </p>
          </div>
          <button
            id="xray-close-btn"
            onClick={onClose}
            style={{
              background: t.surfaceAlt, border: `1px solid ${t.border}`,
              borderRadius: 10, padding: "8px 16px",
              color: t.textMuted, fontSize: 13, fontWeight: 600,
              cursor: "pointer", flexShrink: 0,
              transition: "all .2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = t.danger; e.currentTarget.style.color = t.danger; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textMuted; }}
          >
            ✕ Close
          </button>
        </div>

        {/* ── Side-by-side comparison ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 32 }}>

          {/* Left — What You See */}
          <div style={{
            background: t.surfaceAlt,
            border: `1px solid ${t.border}`,
            borderRadius: 16,
            padding: 20,
            display: "flex", flexDirection: "column", gap: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 20 }}>👁️</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>What You See</span>
            </div>
            <div style={{
              flex: 1, borderRadius: 12,
              background: "rgba(255,255,255,0.05)",
              border: `1px solid ${t.border}`,
              padding: 20,
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: 14, minHeight: 200,
              textAlign: "center",
            }}>
              <span style={{ fontSize: 48 }}>📄</span>
              <div>
                <p style={{ fontWeight: 700, color: t.text, fontSize: 14, marginBottom: 4 }}>{fileName}</p>
                <p style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.6 }}>
                  Your beautifully designed resume — with fonts,
                  colours, icons, and layout.
                </p>
              </div>
              <div style={{
                background: t.accentSoft, border: `1px solid ${t.accentGlow}`,
                borderRadius: 8, padding: "6px 14px",
                fontSize: 12, color: t.accent, fontWeight: 600,
              }}>
                Human-readable ✓
              </div>
            </div>
          </div>

          {/* Right — What the ATS Sees */}
          <div style={{
            background: t.surfaceAlt,
            border: `1px solid ${t.border}`,
            borderRadius: 16,
            padding: 20,
            display: "flex", flexDirection: "column", gap: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 20 }}>🤖</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>What the ATS Sees</span>
            </div>
            <div style={{
              flex: 1, borderRadius: 12,
              background: "#0d0d0d",
              border: "1px solid #2a2a2a",
              padding: 16,
              overflowY: "auto",
              maxHeight: 280,
              minHeight: 200,
            }}>
              <pre style={{
                fontFamily: "'Courier New', Courier, monospace",
                fontSize: 11,
                color: "#a0a0a0",
                lineHeight: 1.8,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                margin: 0,
              }}>{rawText}</pre>
            </div>
            <p style={{ fontSize: 11, color: t.textDim, lineHeight: 1.5 }}>
              ⚠ No styling, no columns, no icons — just plain text. This is what every ATS bot processes.
            </p>
          </div>
        </div>

        {/* ── ATS Parsability Checklist ── */}
        <div>
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: t.text, marginBottom: 6, display: "flex", alignItems: "center", gap: 10 }}>
              🛡️ Structural Parsability Checklist
              <span className="tag" style={{
                background: t.accentSoft, color: t.accent,
                border: `1px solid ${t.accentGlow}`, fontSize: 11,
              }}>
                {checklist.filter(c => c.passed).length}/{checklist.length} passed
              </span>
            </h3>
            <p style={{ fontSize: 12, color: t.textMuted }}>
              Structure-only checks — same logic applies to any resume, any profession.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14 }}>
            {checklist.map((item, i) => {
              const passed = item.passed;
              const passedColors = { bg: "rgba(110,231,183,0.1)", color: "#6ee7b7", border: "rgba(110,231,183,0.3)" };
              const failedColors = { bg: "rgba(248,113,113,0.08)", color: "#f87171", border: "rgba(248,113,113,0.28)" };
              const c = passed ? passedColors : failedColors;

              return (
                <div
                  key={i}
                  style={{
                    padding: 16, borderRadius: 14,
                    background: t.surfaceAlt,
                    border: `1px solid ${c.border}`,
                    display: "flex", flexDirection: "column", gap: 10,
                    transition: "transform .2s, box-shadow .2s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 6px 20px ${c.border}`; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {/* Status icon */}
                    <span style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: c.bg, border: `1px solid ${c.border}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 16, flexShrink: 0,
                      fontWeight: 700,
                    }}>
                      {passed ? "✓" : "✗"}
                    </span>
                    {/* Check name */}
                    <p style={{ fontWeight: 700, color: t.text, fontSize: 14, flex: 1, margin: 0 }}>
                      {item.check}
                    </p>
                    {/* Passed badge */}
                    <span className="tag" style={{
                      background: c.bg, color: c.color,
                      border: `1px solid ${c.border}`, fontSize: 11,
                    }}>
                      {passed ? "Pass" : "Fail"}
                    </span>
                  </div>
                  {/* Detail */}
                  <p style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.7, margin: 0 }}>
                    {item.detail}
                  </p>
                </div>
              );
            })}

            {/* Empty state */}
            {checklist.length === 0 && (
              <div style={{ gridColumn: "1 / -1", padding: 24, textAlign: "center" }}>
                <p style={{ fontSize: 14, color: t.textDim }}>
                  No checklist data available — re-analyse this resume to generate X-Ray results.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer close */}
        <div style={{ marginTop: 28, display: "flex", justifyContent: "center" }}>
          <button
            className="btn-ghost"
            onClick={onClose}
            style={{ padding: "10px 32px", fontSize: 14 }}
          >
            ← Back to Results
          </button>
        </div>
      </div>
    </div>
  );
};

const ATSScorePage = ({ t, onNavigate, onAnalyse, passedResult }) => {
  const [modeError, setModeError] = useState(null);

  // State (b): analysis data exists -> show ATS Score breakdown + X-Ray view
  if (passedResult) {
    console.log("[ATSScorePage] passedResult:", passedResult);
    console.log("[ATSScorePage] atsScore=%o sectionsAnalysis=%o",
      passedResult.atsScore, passedResult.sectionsAnalysis);
    const ats = passedResult.atsScore ?? 0;
    const sectionsAnalysis = passedResult.sectionsAnalysis || [];
    const scoreColor = (v) => v >= 80 ? "#6ee7b7" : v >= 60 ? "#fbbf24" : "#f87171";
    const atsColor = scoreColor(ats);

    const getIcon = (name) => {
      const n = name.toLowerCase();
      if (n.includes("contact") || n.includes("personal")) return "📇";
      if (n.includes("summary") || n.includes("profile") || n.includes("objective") || n.includes("about")) return "👤";
      if (n.includes("experience") || n.includes("employment") || n.includes("work") || n.includes("internship")) return "💼";
      if (n.includes("education") || n.includes("academic") || n.includes("degree")) return "🎓";
      if (n.includes("skill") || n.includes("tech") || n.includes("competenc")) return "⚡";
      if (n.includes("project") || n.includes("portfolio") || n.includes("case stud")) return "🛠️";
      if (n.includes("certif") || n.includes("licen") || n.includes("credential")) return "🏅";
      if (n.includes("award") || n.includes("achiev") || n.includes("honor")) return "🏆";
      if (n.includes("publication") || n.includes("research") || n.includes("paper")) return "📑";
      if (n.includes("volunteer") || n.includes("community") || n.includes("pro bono")) return "🤝";
      if (n.includes("language")) return "🌐";
      if (n.includes("reference") || n.includes("recommend")) return "📋";
      if (n.includes("hobby") || n.includes("interest")) return "🎯";
      if (n.includes("extra") || n.includes("activit") || n.includes("club")) return "⭐";
      if (n.includes("training") || n.includes("workshop") || n.includes("course")) return "📚";
      if (n.includes("leadership") || n.includes("position") || n.includes("committee")) return "👑";
      if (n.includes("affiliation") || n.includes("membership") || n.includes("society")) return "🔗";
      if (n.includes("declaration") || n.includes("statement")) return "📝";
      if (n.includes("link") || n.includes("github") || n.includes("linkedin") || n.includes("website")) return "🔗";
      return "📄";
    };

    const qualityColors = {
      Strong:   { bg: "rgba(110,231,183,0.1)", color: "#6ee7b7", border: "rgba(110,231,183,0.3)" },
      Adequate: { bg: "rgba(96,165,250,0.1)",  color: "#60a5fa", border: "rgba(96,165,250,0.3)" },
      Weak:     { bg: "rgba(251,191,36,0.1)",  color: "#fbbf24", border: "rgba(251,191,36,0.3)" },
      Minimal:  { bg: "rgba(248,113,113,0.1)", color: "#f87171", border: "rgba(248,113,113,0.3)" },
    };

    const maxAts = Math.max(...sectionsAnalysis.map(s => s.atsContribution || 0), 1);
    const totalContrib = sectionsAnalysis.reduce((sum, s) => sum + (s.atsContribution || 0), 0);

    const atsGrade = ats >= 80 ? { label: "Excellent", desc: "Your resume is well-optimised for ATS systems." }
      : ats >= 60 ? { label: "Good", desc: "A few improvements will significantly boost your ATS score." }
      : ats >= 40 ? { label: "Fair", desc: "Several key areas need attention to pass ATS filters." }
      : { label: "Needs Work", desc: "Your resume may be filtered out by most ATS systems." };

    return (
      <div style={{ minHeight: "100vh", background: t.gradient, padding: "40px 24px 80px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>

          {/* ── Top navigation bar: Home left | Full Report right ── */}
          <div className="fade-up" style={{ marginBottom: 28, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button
              className="btn-ghost"
              onClick={() => onNavigate("home")}
              style={{ padding: "9px 20px", fontSize: 14, display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              ← Back to Home
            </button>
            <button
              className="btn-ghost"
              onClick={() => onNavigate("results")}
              style={{ padding: "9px 20px", fontSize: 14, display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              Back to Full Report →
            </button>
          </div>

          {/* ── Page header ── */}
          <div className="fade-up" style={{ marginBottom: 32 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8,
              background: t.accentSoft, border: `1px solid ${t.accentGlow}`,
              borderRadius: 20, padding: "4px 14px", marginBottom: 10 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: t.accent, display: "inline-block", animation: "pulse 2s infinite" }} />
              <span style={{ fontSize: 12, color: t.accent, fontWeight: 700, letterSpacing: ".5px" }}>ATS SCORE ANALYSIS</span>
            </div>
            <h1 style={{ fontSize: 32, fontWeight: 800, color: t.text, letterSpacing: "-1.5px", marginBottom: 8 }}>
              ATS Score Breakdown
            </h1>
            <p style={{ fontSize: 14, color: t.textMuted }}>
              {passedResult.fileName || "resume"} — how your resume performs against Applicant Tracking Systems
            </p>
          </div>

          {/* ── Overall ATS Score hero card ── */}
          <div className="fade-up delay-1" style={{
            background: t.cardGrad,
            border: `1px solid ${t.accentGlow}`,
            borderRadius: 20, padding: "32px 36px",
            marginBottom: 24,
            display: "flex", alignItems: "center", gap: 32, flexWrap: "wrap",
            boxShadow: `0 0 40px ${t.accentGlow}`,
          }}>
            <div style={{ flexShrink: 0 }}>
              <ScoreRing score={ats} size={140} color={atsColor} />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <p style={{ fontSize: 12, color: t.textDim, fontWeight: 600, letterSpacing: ".5px", marginBottom: 6 }}>OVERALL ATS SCORE</p>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <h2 style={{ fontSize: 40, fontWeight: 800, color: atsColor, letterSpacing: "-2px", margin: 0 }}>{ats}</h2>
                <span style={{ fontSize: 20, color: t.textDim, fontWeight: 400 }}>/100</span>
                <span className="tag" style={{
                  background: scoreColor(ats) === "#6ee7b7" ? "rgba(110,231,183,0.12)" : scoreColor(ats) === "#fbbf24" ? "rgba(251,191,36,0.12)" : "rgba(248,113,113,0.12)",
                  color: atsColor,
                  border: `1px solid ${atsColor}44`,
                  fontSize: 13, fontWeight: 700,
                }}>
                  {atsGrade.label}
                </span>
              </div>
              <p style={{ fontSize: 14, color: t.textMuted, lineHeight: 1.7 }}>{atsGrade.desc}</p>
              {/* Progress bar */}
              <div style={{ marginTop: 14 }}>
                <div style={{ height: 8, borderRadius: 10, background: t.surfaceAlt, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 10,
                    background: `linear-gradient(90deg, ${atsColor}, ${t.accent})`,
                    width: `${ats}%`,
                    transition: "width 1.4s cubic-bezier(.22,1,.36,1)",
                    boxShadow: `0 0 12px ${atsColor}66`,
                  }} />
                </div>
              </div>
            </div>
            {/* Quick stats */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 160 }}>
              {[
                { label: "Sections Analysed", value: sectionsAnalysis.length, color: t.info },
                { label: "Total ATS Points", value: `${totalContrib} pts`, color: t.accent },
                { label: "Top Section", value: sectionsAnalysis.sort((a,b) => (b.atsContribution||0)-(a.atsContribution||0))[0]?.section || "—", color: t.warning },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ padding: "10px 14px", borderRadius: 10, background: t.surfaceAlt, border: `1px solid ${t.border}` }}>
                  <p style={{ fontSize: 10, color: t.textDim, fontWeight: 600, letterSpacing: ".4px", marginBottom: 3 }}>{label.toUpperCase()}</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color }}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Per-section ATS Score breakdown ── */}
          {sectionsAnalysis.length > 0 && (
            <div className="fade-up delay-2" style={{
              background: t.cardGrad,
              border: `1px solid ${t.border}`,
              borderRadius: 20, padding: "28px 28px",
              marginBottom: 24,
            }}>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: t.text, letterSpacing: "-0.5px", marginBottom: 6 }}>
                  🎯 Section-by-Section ATS Score
                </h2>
                <p style={{ fontSize: 13, color: t.textMuted }}>
                  Each section's contribution to your overall ATS score — sorted by impact
                </p>
              </div>

              {/* Sorted by atsContribution descending */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[...sectionsAnalysis]
                  .sort((a, b) => (b.atsContribution || 0) - (a.atsContribution || 0))
                  .map((s, i) => {
                    const qc = qualityColors[s.quality] || qualityColors.Adequate;
                    const atsVal = s.atsContribution || 0;
                    const barPct = maxAts > 0 ? Math.round((atsVal / maxAts) * 100) : 0;
                    return (
                      <div key={i} style={{
                        padding: "14px 18px",
                        borderRadius: 14,
                        background: t.surfaceAlt,
                        border: `1px solid ${qc.border}`,
                        transition: "transform .2s, box-shadow .2s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = "translateX(4px)"; e.currentTarget.style.boxShadow = `0 4px 18px ${qc.border}`; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = "translateX(0)"; e.currentTarget.style.boxShadow = "none"; }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                          {/* Rank */}
                          <span style={{
                            width: 28, height: 28, borderRadius: "50%",
                            background: i === 0 ? t.accentSoft : t.surfaceAlt,
                            border: `1px solid ${i === 0 ? t.accentGlow : t.border}`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 11, fontWeight: 800, color: i === 0 ? t.accent : t.textDim,
                            flexShrink: 0,
                          }}>#{i + 1}</span>
                          {/* Icon + section name */}
                          <span style={{ fontSize: 18 }}>{getIcon(s.section)}</span>
                          <p style={{ fontWeight: 700, color: t.text, fontSize: 14, flex: 1, margin: 0 }}>{s.section}</p>
                          {/* Quality badge */}
                          <span className="tag" style={{
                            background: qc.bg, color: qc.color,
                            border: `1px solid ${qc.border}`, fontSize: 11,
                          }}>{s.quality}</span>
                          {/* ATS score chip */}
                          <span style={{
                            padding: "4px 12px", borderRadius: 20,
                            background: atsVal > 0 ? qc.bg : "rgba(128,128,160,0.08)",
                            border: `1px solid ${atsVal > 0 ? qc.border : t.border}`,
                            fontSize: 13, fontWeight: 800,
                            color: atsVal > 0 ? qc.color : t.textDim,
                            minWidth: 64, textAlign: "center",
                            fontFamily: "Syne, sans-serif",
                          }}>
                            {atsVal > 0 ? `+${atsVal}` : "0"} <span style={{ fontSize: 10, fontWeight: 500, opacity: 0.7 }}>pts</span>
                          </span>
                        </div>
                        {/* Note */}
                        <p style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.6, marginBottom: atsVal > 0 ? 10 : 0, paddingLeft: 40 }}>
                          {s.note}
                        </p>
                        {/* ATS contribution bar */}
                        {atsVal > 0 && (
                          <div style={{ paddingLeft: 40 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                              <span style={{ fontSize: 11, color: t.textDim, fontWeight: 500 }}>ATS Contribution</span>
                              <span style={{ fontSize: 11, color: qc.color, fontWeight: 700 }}>{atsVal} pts ({barPct}% of top)</span>
                            </div>
                            <div style={{ height: 6, borderRadius: 10, background: t.border, overflow: "hidden" }}>
                              <div style={{
                                height: "100%", borderRadius: 10,
                                background: `linear-gradient(90deg, ${qc.color}, ${t.accent})`,
                                width: `${barPct}%`,
                                transition: "width 1.2s cubic-bezier(.22,1,.36,1)",
                                boxShadow: `0 0 8px ${qc.color}55`,
                              }} />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>

              {/* Total row */}
              <div style={{
                marginTop: 16, padding: "14px 18px", borderRadius: 14,
                background: t.accentSoft, border: `1px solid ${t.accentGlow}`,
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Total ATS Points Across All Sections</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: t.accent, fontFamily: "Syne, sans-serif" }}>
                  {totalContrib} pts
                </span>
              </div>
            </div>
          )}

          {/* ── Divider ── */}
          <div className="fade-up delay-3" style={{ margin: "32px 0 24px", display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ flex: 1, height: 1, background: t.border }} />
            <span style={{
              fontSize: 12, color: t.textMuted, fontWeight: 600, letterSpacing: ".5px",
              padding: "4px 16px", borderRadius: 20,
              background: t.surfaceAlt, border: `1px solid ${t.border}`,
            }}>🔍 RESUME X-RAY</span>
            <div style={{ flex: 1, height: 1, background: t.border }} />
          </div>

          {/* ── X-Ray view (what the ATS bot sees) ── */}
          <div className="fade-up delay-4">
            <ResumeXRayView
              t={t}
              result={passedResult}
              onBack={null}
              backLabel="← Back to Full Report"
            />
          </div>


        </div>
      </div>
    );
  }

  // State (a): no analysis data -> show upload prompt; after analysis show ONLY X-Ray
  return (
    <div style={{ minHeight: "100vh", background: t.gradient }}>
      {/* ── Back button (top-left) so users can navigate back without analysing ── */}
      <div style={{ position: "absolute", top: 20, left: 20, zIndex: 10 }}>
        <button
          className="btn-ghost"
          onClick={() => onNavigate("home")}
          style={{ padding: "9px 20px", fontSize: 14, display: "inline-flex", alignItems: "center", gap: 8 }}
        >
          ← Back
        </button>
      </div>

      {/* Reuse the existing UploadPage UI/logic by delegating to it. */}
      <UploadPage
        t={t}
        onAnalyse={async (payload) => {
          try {
            setModeError(null);
            // Run the same analysis API call; then immediately store it for the ATS page.
            await onAnalyse(payload);
          } catch (e) {
            setModeError(String(e?.message || "Analysis failed. Please try again."));
          }
        }}
        onNavigate={onNavigate}
      />
      {modeError && (
        <div style={{ position: "fixed", bottom: 20, left: 0, right: 0, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ pointerEvents: "auto", maxWidth: 720, width: "calc(100% - 32px)", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: t.danger, padding: "12px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600 }}>
            {modeError}
          </div>
        </div>
      )}
    </div>
  );
};

// ── GRAMMAR CHECK PAGE ────────────────────────────────────────────────────────
const GrammarCheckPage = ({ t, onNavigate, onAnalyse, passedResult, setPassedGrammarResult }) => {
  const [grammarData, setGrammarData] = useState(passedResult?.grammarAnalysis || null);
  const [loadingGrammar, setLoadingGrammar] = useState(false);
  const [grammarError, setGrammarError] = useState(null);
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [appliedRewrites, setAppliedRewrites] = useState({}); // {sentenceIdx: true}
  const [modeError, setModeError] = useState(null);
  const [liveImpactScore, setLiveImpactScore] = useState(null);

  // Fix spacing lost during PDF extraction (camelCase merges, digit/letter, punctuation boundaries)
  const fixSpacing = (text) => {
    if (!text) return '';
    return text
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([a-zA-Z])([0-9])/g, '$1 $2')
      .replace(/([0-9])([a-zA-Z])/g, '$1 $2')
      .replace(/([.,!?;:])([a-zA-Z])/g, '$1 $2')
      .replace(/([a-zA-Z])([@#])/g, '$1 $2')
      .trim();
  };

  const token = localStorage.getItem("token");
  const isPassedIn = Boolean(passedResult);

  // Auto-fetch grammar analysis if passed result has no grammarAnalysis yet
  useEffect(() => {
    if (!isPassedIn || grammarData) return;
    const resumeId = passedResult?._id;
    if (!resumeId) return;
    setLoadingGrammar(true);
    setGrammarError(null);
    fetch("http://localhost:5000/api/resume/grammar-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ resumeId }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.grammarAnalysis) {
          setGrammarData(d.grammarAnalysis);
          // propagate back so ResultsPage also sees it
          if (setPassedGrammarResult) setPassedGrammarResult(d.grammarAnalysis);
        } else {
          setGrammarError(d.message || "Grammar analysis failed.");
        }
      })
      .catch(e => setGrammarError(e.message || "Failed to reach server."))
      .finally(() => setLoadingGrammar(false));
  }, [isPassedIn, grammarData, passedResult, token, setPassedGrammarResult]);

  // Recalculate live impact score whenever rewrites change
  useEffect(() => {
    if (!grammarData?.sentences) return;
    const sents = grammarData.sentences;
    const total = sents.reduce((acc, s, i) => {
      const base = s.impactScore ?? 0;
      if (appliedRewrites[i] && s.powerRewrite) return acc + Math.min(10, base + 3);
      return acc + base;
    }, 0);
    setLiveImpactScore(parseFloat((total / Math.max(sents.length, 1)).toFixed(1)));
  }, [appliedRewrites, grammarData]);

  const impactLabel = (score) => score >= 7.5 ? "Strong 💪" : score >= 5 ? "Good 👍" : "Needs Work ⚠️";
  const impactLabelColor = (score) => score >= 7.5 ? "#6ee7b7" : score >= 5 ? "#fbbf24" : "#f87171";
  const levelColors = {
    weak:   { bg: "rgba(248,113,113,0.14)", border: "rgba(248,113,113,0.35)", color: "#f87171" },
    medium: { bg: "rgba(251,191,36,0.14)",  border: "rgba(251,191,36,0.35)",  color: "#fbbf24" },
    strong: { bg: "rgba(110,231,183,0.14)", border: "rgba(110,231,183,0.35)", color: "#6ee7b7" },
  };
  const issueTypeColors = {
    spelling:     { bg: "rgba(248,113,113,0.1)", color: "#f87171" },
    punctuation:  { bg: "rgba(251,191,36,0.1)",  color: "#fbbf24" },
    tense:        { bg: "rgba(167,139,250,0.1)",  color: "#a78bfa" },
    passive_voice:{ bg: "rgba(96,165,250,0.1)",   color: "#60a5fa" },
    filler_phrase:{ bg: "rgba(251,146,60,0.1)",   color: "#fb923c" },
    weak_verb:    { bg: "rgba(248,113,113,0.1)", color: "#f87171" },
    missing_metrics:{ bg: "rgba(167,139,250,0.1)", color: "#a78bfa" },
  };

  // Apply all rewrites at once
  const applyAllRewrites = () => {
    if (!grammarData?.sentences) return;
    const newApplied = {};
    grammarData.sentences.forEach((s, i) => { if (s.powerRewrite) newApplied[i] = true; });
    setAppliedRewrites(newApplied);
  };

  // Build corrected resume text
  const buildCorrectedText = () => {
    if (!grammarData?.sentences) return passedResult?.rawExtractedText || "";
    let text = passedResult?.rawExtractedText || "";
    grammarData.sentences.forEach((s, i) => {
      if (appliedRewrites[i] && s.powerRewrite && s.original) {
        text = text.replace(s.original, s.powerRewrite);
      }
    });
    return text;
  };

  // Download corrected resume as DOCX
  const downloadDocx = async () => {
    try {
      const { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer } = await import("docx");
      const correctedText = buildCorrectedText();
      const lines = correctedText.split("\n").filter(l => l.trim().length > 0);
      const children = lines.map((line, i) => {
        const trimmed = line.trim();
   const isHeading =
  (i === 0) || ((trimmed === trimmed.toUpperCase()) && (trimmed.length < 60));
        if (isHeading && i === 0) {

          return new Paragraph({ text: trimmed, heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER });
        }
        if (isHeading && i > 0) {
          return new Paragraph({ children: [new TextRun({ text: trimmed, bold: true, size: 26 })], spacing: { before: 200 } });
        }
        const isBullet = trimmed.startsWith("•") || trimmed.startsWith("-") || trimmed.startsWith("*");
        return new Paragraph({
          children: [new TextRun({ text: isBullet ? trimmed.replace(/^[•\-*]\s*/, "") : trimmed, size: 22 })],
          bullet: isBullet ? { level: 0 } : undefined,
          spacing: { after: 80 },
        });
      });
      children.push(new Paragraph({
        children: [new TextRun({ text: "Content corrected and impact-optimized • Apply your preferred styling", size: 18, italics: true, color: "888888" })],
        spacing: { before: 400 },
      }));
      const doc = new Document({ sections: [{ children }] });
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "Resume_Grammar_Corrected.docx"; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("DOCX generation failed: " + e.message);
    }
  };

  // ── STATE A: no passed data — upload first ──────────────────────────────────
  if (!isPassedIn) {
    return (
      <div style={{ minHeight: "100vh", background: t.gradient }}>
        <div style={{ position: "absolute", top: 20, left: 20, zIndex: 10 }}>
          <button className="btn-ghost" onClick={() => onNavigate("home")} style={{ padding: "9px 20px", fontSize: 14, display: "inline-flex", alignItems: "center", gap: 8 }}>← Back</button>
        </div>
        <UploadPage t={t} onAnalyse={async (payload) => {
          try { setModeError(null); await onAnalyse(payload); }
          catch (e) { setModeError(String(e?.message || "Analysis failed.")); }
        }} onNavigate={onNavigate} />
        {modeError && (
          <div style={{ position: "fixed", bottom: 20, left: 0, right: 0, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{ pointerEvents: "auto", maxWidth: 720, width: "calc(100% - 32px)", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: t.danger, padding: "12px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600 }}>{modeError}</div>
          </div>
        )}
      </div>
    );
  }

  // ── STATE B loading (fetching grammar analysis) ─────────────────────────────
  if (loadingGrammar) {
    return (
      <div style={{ minHeight: "100vh", background: t.gradient, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
        <div style={{ width: 52, height: 52, border: `3px solid ${t.border}`, borderTopColor: t.accent, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        <p style={{ fontSize: 16, fontWeight: 700, color: t.text, fontFamily: "Syne,sans-serif" }}>Running Grammar & Impact Analysis…</p>
        <p style={{ fontSize: 13, color: t.textMuted }}>This may take 15–30 seconds</p>
      </div>
    );
  }

  // ── STATE B error ───────────────────────────────────────────────────────────
  if (grammarError && !grammarData) {
    return (
      <div style={{ minHeight: "100vh", background: t.gradient, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div className="card fade-up" style={{ maxWidth: 480, textAlign: "center", padding: "40px 32px" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: t.text, marginBottom: 10 }}>Grammar Analysis Failed</h2>
          <p style={{ fontSize: 14, color: t.textMuted, marginBottom: 24 }}>{grammarError}</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button className="btn-primary" onClick={() => { setGrammarError(null); setLoadingGrammar(true); }}>Retry</button>
            <button className="btn-ghost" onClick={() => onNavigate("results")}>← Back to Report</button>
          </div>
        </div>
      </div>
    );
  }

  // ── STATE B with data ───────────────────────────────────────────────────────
  const ga = grammarData || {};
  const sentences = ga.sentences || [];
  const grammarIssues = ga.grammarIssues || [];
  const wp = ga.weakPatterns || {};
  const baseImpact = ga.overallImpactScore ?? 0;
  const currentImpact = liveImpactScore ?? baseImpact;
  const rewritesAppliedCount = Object.keys(appliedRewrites).length;
  const totalRewrites = sentences.filter(s => s.powerRewrite).length;

  // Group grammar issues by type
  const issueGroups = grammarIssues.reduce((acc, issue) => {
    const key = issue.type || "other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(issue);
    return acc;
  }, {});

  return (
    <div style={{ minHeight: "100vh", background: t.gradient, padding: "40px 24px 80px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* ── Top nav ── */}
        <div className="fade-up" style={{ marginBottom: 28, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button className="btn-ghost" onClick={() => onNavigate("home")} style={{ padding: "9px 20px", fontSize: 14, display: "inline-flex", alignItems: "center", gap: 8 }}>← Back to Home</button>
          <button className="btn-ghost" onClick={() => onNavigate("results")} style={{ padding: "9px 20px", fontSize: 14, display: "inline-flex", alignItems: "center", gap: 8 }}>Back to Full Report →</button>
        </div>

        {/* ── Page header ── */}
        <div className="fade-up" style={{ marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: t.accentSoft, border: `1px solid ${t.accentGlow}`, borderRadius: 20, padding: "4px 14px", marginBottom: 10 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: t.accent, display: "inline-block", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 12, color: t.accent, fontWeight: 700, letterSpacing: ".5px" }}>GRAMMAR & IMPACT ANALYSIS</span>
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: t.text, letterSpacing: "-1.5px", marginBottom: 8 }}>Grammar Check</h1>
          <p style={{ fontSize: 14, color: t.textMuted }}>{passedResult?.fileName || "resume"} — sentence-by-sentence impact analysis</p>
        </div>

        {/* ── (a) TOP SCORE SECTION ── */}
        <div className="fade-up delay-1" style={{ background: t.cardGrad, border: `1px solid ${t.accentGlow}`, borderRadius: 20, padding: "28px 32px", marginBottom: 24, boxShadow: `0 0 40px ${t.accentGlow}` }}>
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap", alignItems: "center" }}>
            {/* Grammar score ring */}
            <div style={{ flexShrink: 0, textAlign: "center" }}>
              <ScoreRing score={ga.grammarScore ?? 0} size={130} color={ga.grammarScore >= 80 ? "#6ee7b7" : ga.grammarScore >= 60 ? "#fbbf24" : "#f87171"} />
              <p style={{ fontSize: 12, color: t.textMuted, fontWeight: 600, marginTop: 6, letterSpacing: ".4px" }}>GRAMMAR SCORE</p>
              <p style={{ fontSize: 11, color: t.textDim, marginTop: 2 }}>from {ga.totalIssues ?? 0} issues</p>
            </div>

            {/* Issues badge + impact score */}
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                <span style={{ padding: "6px 18px", borderRadius: 20, background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.35)", color: "#f87171", fontWeight: 700, fontSize: 14 }}>
                  {ga.totalIssues ?? grammarIssues.length} Issues Found
                </span>
                <span style={{ padding: "6px 18px", borderRadius: 20, background: t.accentSoft, border: `1px solid ${t.accentGlow}`, color: t.accent, fontWeight: 700, fontSize: 14 }}>
                  Impact: {currentImpact}/10
                  {rewritesAppliedCount > 0 && <span style={{ fontSize: 11, marginLeft: 6, opacity: 0.8 }}>({rewritesAppliedCount} rewrite{rewritesAppliedCount !== 1 ? "s" : ""} applied)</span>}
                </span>
              </div>
              <div style={{ marginBottom: 8 }}>
                <p style={{ fontSize: 24, fontWeight: 800, color: impactLabelColor(currentImpact), fontFamily: "Syne,sans-serif", marginBottom: 2 }}>
                  {impactLabel(currentImpact)}
                </p>
                <p style={{ fontSize: 13, color: t.textMuted }}>Overall impact score across all resume sentences</p>
              </div>
              {/* Impact progress bar */}
              <div style={{ height: 8, borderRadius: 10, background: t.surfaceAlt, overflow: "hidden", maxWidth: 360 }}>
                <div style={{ height: "100%", borderRadius: 10, background: `linear-gradient(90deg, ${impactLabelColor(currentImpact)}, ${t.accent})`, width: `${(currentImpact / 10) * 100}%`, transition: "width 1s cubic-bezier(.22,1,.36,1)", boxShadow: `0 0 12px ${impactLabelColor(currentImpact)}66` }} />
              </div>
            </div>

            {/* Quick stat boxes */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, minWidth: 200 }}>
              {[
                ["Passive Voice", wp.passiveVoiceCount ?? 0, "#60a5fa"],
                ["Filler Phrases", wp.fillerPhraseCount ?? 0, "#fb923c"],
                ["Weak Verbs", wp.weakVerbCount ?? 0, "#f87171"],
                ["No Metrics", wp.missingMetricsCount ?? 0, "#a78bfa"],
              ].map(([label, val, color]) => (
                <div key={label} style={{ padding: "10px 12px", borderRadius: 12, background: t.surfaceAlt, border: `1px solid ${t.border}`, textAlign: "center" }}>
                  <p style={{ fontSize: 22, fontWeight: 800, color, fontFamily: "Syne,sans-serif" }}>{val}</p>
                  <p style={{ fontSize: 10, color: t.textMuted, marginTop: 2, fontWeight: 600 }}>{label.toUpperCase()}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Score Breakdown ── */}
          {grammarIssues.length > 0 && (() => {
            const byType = grammarIssues.reduce((acc, iss) => { const k = iss.type || "other"; acc[k] = (acc[k]||0)+1; return acc; }, {});
            const rows = [
              byType.spelling        && { label: `${byType.spelling} spelling error${byType.spelling>1?"s":""}`,        pts: byType.spelling*5,      color: "#f87171" },
              byType.tense           && { label: `${byType.tense} tense issue${byType.tense>1?"s":""}`,                 pts: byType.tense*5,          color: "#a78bfa" },
              byType.passive_voice   && { label: `${byType.passive_voice} passive voice`,                               pts: byType.passive_voice*3,  color: "#60a5fa" },
              byType.missing_metrics && { label: `${byType.missing_metrics} missing metric${byType.missing_metrics>1?"s":""}`, pts: byType.missing_metrics*3, color: "#a78bfa" },
              byType.punctuation     && { label: `${byType.punctuation} punctuation error${byType.punctuation>1?"s":""}`, pts: byType.punctuation*2,  color: "#fbbf24" },
              byType.filler_phrase   && { label: `${byType.filler_phrase} filler phrase${byType.filler_phrase>1?"s":""}`, pts: byType.filler_phrase*2, color: "#fb923c" },
              byType.weak_verb       && { label: `${byType.weak_verb} weak verb${byType.weak_verb>1?"s":""}`,          pts: byType.weak_verb*2,      color: "#f87171" },
              byType.other           && { label: `${byType.other} other`,                                               pts: byType.other*3,          color: t.textMuted },
            ].filter(Boolean);
            return (
              <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${t.border}` }}>
                <p style={{ fontSize: 11, color: t.textDim, fontWeight: 700, letterSpacing: ".5px", marginBottom: 10 }}>HOW YOUR SCORE WAS CALCULATED</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: t.textMuted }}>100</span>
                  {rows.map(({ label, pts, color }) => (
                    <span key={label} style={{ padding: "3px 10px", borderRadius: 20, background: `${color}18`, border: `1px solid ${color}44`, fontSize: 12, color, fontWeight: 600 }}>
                      −{pts} ({label})
                    </span>
                  ))}
                  <span style={{ fontSize: 13, color: t.textMuted }}>+ pattern penalties</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: ga.grammarScore >= 80 ? "#6ee7b7" : ga.grammarScore >= 60 ? "#fbbf24" : "#f87171" }}>= {ga.grammarScore ?? 0}</span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* ── (b) SENTENCE HEAT MAP ── */}
        {sentences.length > 0 && (
          <div className="fade-up delay-2" style={{ background: t.cardGrad, border: `1px solid ${t.border}`, borderRadius: 20, padding: "24px 28px", marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: t.text, letterSpacing: "-0.5px", marginBottom: 4 }}>🌡️ Sentence Impact Heat Map</h2>
                <p style={{ fontSize: 13, color: t.textMuted }}>Click any sentence to see issues &amp; power rewrites</p>
              </div>
              <div style={{ display: "flex", gap: 4, background: t.surfaceAlt, borderRadius: 10, padding: 4 }}>
                {[["All", null], ["Weak", "weak"], ["Medium", "medium"], ["Strong", "strong"]].map(([label, lv]) => {
                  const colors = { weak: "#f87171", medium: "#fbbf24", strong: "#6ee7b7" };
                  const c = lv ? colors[lv] : t.textMuted;
                  const isActive = lv ? expandedIdx === lv : typeof expandedIdx !== "string";
                  return (
                    <button key={label} onClick={() => setExpandedIdx(isActive ? null : lv)}
                      style={{ padding: "5px 10px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "Syne,sans-serif",
                        background: isActive ? `${c}22` : "transparent", color: isActive ? c : t.textDim, transition: "all .15s" }}>
                      {label}{lv ? ` (${sentences.filter(s => s.level === lv).length})` : ` (${sentences.length})`}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
              {[["weak", "#f87171", "0–4"], ["medium", "#fbbf24", "5–7"], ["strong", "#6ee7b7", "8–10"]].map(([lv, color, range]) => (
                <div key={lv} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: color, opacity: .7, display: "inline-block" }} />
                  <span style={{ fontSize: 11, color: t.textMuted, textTransform: "capitalize" }}>{lv} <span style={{ color: t.textDim }}>({range} pts)</span></span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {sentences
                .map((s, i) => ({ ...s, _i: i }))
                .filter(s => !expandedIdx || typeof expandedIdx === "number" || s.level === expandedIdx)
                .map((s) => {
                const i = s._i;
                const lc = levelColors[s.level] || levelColors.weak;
                const isExpanded = expandedIdx === i;
                const isApplied = appliedRewrites[i];
                return (
                  <div key={i} style={{ borderRadius: 14, background: lc.bg, border: `1px solid ${lc.border}`, overflow: "hidden", transition: "box-shadow .2s" }}
                    onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.boxShadow = `0 4px 20px ${lc.border}`; }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; }}>
                    {/* Sentence row (always visible) */}
                    <div
                      onClick={() => setExpandedIdx(isExpanded ? null : i)}
                      style={{ padding: "12px 16px", cursor: s.level !== "strong" ? "pointer" : "default", display: "flex", alignItems: "flex-start", gap: 12 }}>
                      {/* Impact score badge */}
                      <span style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 10, background: lc.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#000", fontFamily: "Syne,sans-serif" }}>{s.impactScore}</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, color: t.text, lineHeight: 1.6, textDecoration: isApplied && s.powerRewrite ? "line-through" : "none", opacity: isApplied && s.powerRewrite ? 0.5 : 1 }}>
                          {fixSpacing(s.original)}
                        </p>
                        {isApplied && s.powerRewrite && (
                          <p style={{ fontSize: 13, color: "#6ee7b7", lineHeight: 1.6, marginTop: 4 }}>⚡ {fixSpacing(s.powerRewrite)}</p>
                        )}
                      </div>
                      <span style={{ flexShrink: 0, padding: "3px 10px", borderRadius: 20, background: "rgba(0,0,0,0.2)", color: lc.color, fontSize: 11, fontWeight: 700, textTransform: "capitalize" }}>{s.level}</span>
                      {s.level !== "strong" && (
                        <span style={{ flexShrink: 0, fontSize: 16, opacity: 0.6 }}>{isExpanded ? "▲" : "▼"}</span>
                      )}
                    </div>
                    {/* Expanded detail panel */}
                    {isExpanded && s.level !== "strong" && (
                      <div style={{ padding: "0 16px 16px 64px", borderTop: `1px solid ${lc.border}`, paddingTop: 14 }}>
                        {/* Issues list */}
                        {s.issues && s.issues.length > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            <p style={{ fontSize: 11, color: t.textDim, fontWeight: 600, letterSpacing: ".4px", marginBottom: 6 }}>ISSUES FOUND</p>
                            {s.issues.map((iss, ii) => (
                              <p key={ii} style={{ fontSize: 12, color: lc.color, lineHeight: 1.6 }}>• {iss}</p>
                            ))}
                          </div>
                        )}
                        {/* Power rewrite box */}
                        {s.powerRewrite && !isApplied && (
                          <div style={{ background: "rgba(110,231,183,0.1)", border: "1px solid rgba(110,231,183,0.3)", borderRadius: 12, padding: "14px 16px", marginBottom: 12 }}>
                            <p style={{ fontSize: 11, color: "#6ee7b7", fontWeight: 700, letterSpacing: ".4px", marginBottom: 6 }}>⚡ POWER REWRITE</p>
                            <p style={{ fontSize: 13, color: t.text, lineHeight: 1.7 }}>{fixSpacing(s.powerRewrite)}</p>
                          </div>
                        )}
                        {s.powerRewrite && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setAppliedRewrites(prev => ({ ...prev, [i]: !prev[i] })); }}
                            className="btn-primary"
                            style={{ fontSize: 12, padding: "7px 18px", background: isApplied ? t.surfaceAlt : undefined, color: isApplied ? t.textMuted : undefined, border: isApplied ? `1px solid ${t.border}` : undefined }}>
                            {isApplied ? "✓ Applied — Undo" : "Apply This Rewrite"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── (c) GRAMMAR ISSUES SECTION ── */}
        {grammarIssues.length > 0 && (
          <div className="fade-up delay-3" style={{ background: t.cardGrad, border: `1px solid ${t.border}`, borderRadius: 20, padding: "24px 28px", marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: t.text, letterSpacing: "-0.5px" }}>📝 Grammar Issues</h2>
              <span style={{ padding: "4px 14px", borderRadius: 20, background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.35)", color: "#f87171", fontWeight: 700, fontSize: 13 }}>
                {grammarIssues.length} found
              </span>
            </div>
            <p style={{ fontSize: 13, color: t.textMuted, marginBottom: 20 }}>Grouped by type — before / after comparison</p>
            {Object.entries(issueGroups).map(([type, issues]) => {
              const tc = issueTypeColors[type] || { bg: "rgba(128,128,160,0.1)", color: t.textMuted };
              const icon = { spelling: "🔤", punctuation: "✏️", tense: "⏱", passive_voice: "💬", filler_phrase: "🗑️", weak_verb: "⚡", missing_metrics: "📊" }[type] || "⚠️";
              const deductPer = { spelling: 5, tense: 5, passive_voice: 3, missing_metrics: 3, punctuation: 2, filler_phrase: 2, weak_verb: 2, other: 3 }[type] || 3;
              return (
                <div key={type} style={{ marginBottom: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 15 }}>{icon}</span>
                    <span style={{ fontSize: 12, color: tc.color, fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase" }}>{type.replace(/_/g, " ")}</span>
                    <span style={{ padding: "2px 8px", borderRadius: 20, background: `${tc.color}18`, color: tc.color, fontSize: 11, fontWeight: 700 }}>{issues.length}</span>
                    <span style={{ fontSize: 11, color: t.textDim, marginLeft: 4 }}>(−{deductPer} pts each)</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {issues.map((g, i) => (
                      <div key={i} style={{ padding: "12px 16px", borderRadius: 12, background: t.surfaceAlt, border: `1px solid ${t.border}`, borderLeft: `3px solid ${tc.color}` }}>
                        <div style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "flex-start" }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: t.danger, flexShrink: 0, marginTop: 3 }}>BEFORE</span>
                          <p style={{ fontSize: 13, color: t.danger, lineHeight: 1.5, opacity: 0.85 }}>{g.original || g.text}</p>
                        </div>
                        <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: t.accent, flexShrink: 0, marginTop: 3 }}>AFTER</span>
                          <p style={{ fontSize: 13, color: t.accent, lineHeight: 1.5 }}>{g.corrected || g.fix}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── (d) ACTION BUTTONS ── */}
        <div className="fade-up delay-4" style={{ background: t.cardGrad, border: `1px solid ${t.border}`, borderRadius: 20, padding: "24px 28px" }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: t.text, marginBottom: 4 }}>🛠️ Apply Improvements</h2>
          <p style={{ fontSize: 13, color: t.textMuted, marginBottom: 16 }}>Apply power rewrites and download a corrected DOCX resume.</p>
          {rewritesAppliedCount > 0 && (
            <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 12, background: t.accentSoft, border: `1px solid ${t.accentGlow}` }}>
              <p style={{ fontSize: 14, color: t.accent, fontWeight: 700 }}>
                ✓ {rewritesAppliedCount} of {totalRewrites} rewrites applied — Impact score: {baseImpact} → <span style={{ color: "#6ee7b7" }}>{currentImpact}/10</span>
              </p>
            </div>
          )}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {totalRewrites > 0 && (
              <button className="btn-primary" onClick={applyAllRewrites} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                ⚡ Apply All Rewrites ({totalRewrites})
              </button>
            )}
            <button className="btn-ghost" onClick={downloadDocx} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              📄 Download Corrected Resume
            </button>
            {rewritesAppliedCount > 0 && (
              <button className="btn-ghost" onClick={() => setAppliedRewrites({})} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: t.textMuted }}>
                Reset All
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

// RESULTS DASHBOARD
const ResultsPage = ({ t, onNavigate, onBestJobRoles, result, error }) => {
  const scoreColor = (v) => v >= 80 ? "#6ee7b7" : v >= 60 ? "#fbbf24" : "#f87171";
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showXRay, setShowXRay] = useState(false);
  const [atsCardHover, setAtsCardHover] = useState(false);
  const contentRef = useRef(null);

  // ── PDF Generation (html2canvas → exact visual replica) ────────────────────
  const generatePDF = useCallback(async () => {
    if (!contentRef.current || !result) return;
    setPdfLoading(true);

    // Snapshot current UI state so we can restore it even if something fails.
    const el = contentRef.current;

    // Disable background effects while capturing to avoid subtle visual differences.
    const prevCanvasFilter = [];
    const particleCanvas = document.querySelector('canvas') || null;
    if (particleCanvas) {
      prevCanvasFilter.push({
        node: particleCanvas,
        filter: particleCanvas.style.filter,
        opacity: particleCanvas.style.opacity,
      });
      particleCanvas.style.filter = 'none';
      particleCanvas.style.opacity = '0';
    }


    const prevDisplay = [];
    const hiddenNodes = Array.from(el.querySelectorAll('[data-pdf-hide]'));

    // Temporarily disable animations/transitions on the live DOM.
    const nodes = Array.from(el.querySelectorAll('*'));
    const prevStyles = new Map();

    try {
      // Hide header buttons ONLY for the capture
      hiddenNodes.forEach((n) => {
        prevDisplay.push({ node: n, display: n.style.display });
        n.style.display = 'none';
      });

      // Disable animations/transitions on the live DOM so html2canvas produces
      // a stable frame that matches what the user sees.
      nodes.forEach((n) => {
        prevStyles.set(n, { animation: n.style.animation, transition: n.style.transition });
        n.style.animation = 'none';
        n.style.transition = 'none';
      });

      // Ensure layout is settled.
      await new Promise((r) => setTimeout(r, 250));

      // Measure live element so PDF width matches screen layout.
      const rect = el.getBoundingClientRect();
      const widthPx = Math.max(300, Math.round(rect.width));
      const heightPx = Math.max(1, Math.ceil(el.scrollHeight));

      const scale = 2;

      const canvas = await html2canvas(el, {
        scale,
        useCORS: true,
        allowTaint: true,
        backgroundColor: t.bg,
        logging: false,
        width: widthPx,
        height: heightPx,
        windowWidth: widthPx,
        windowHeight: heightPx,
      });

      // A4 dimensions in mm: 210 × 297
      const a4W = 210;
      const a4H = 297;
      const jsPDF = await getJsPDF();
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const imgW = canvas.width;
      const imgH = canvas.height;

      // Slice by pixel height so each slice maps cleanly to a4H in jsPDF.
      // px-per-mm for X/Y mapping depends on jsPDF scale; use a stable approach.
      const mmToPxY = (a4H * imgW) / a4W; // total image px height that corresponds to full A4 when scaled
      const pagePxH = Math.floor(mmToPxY);
      const totalPages = Math.max(1, Math.ceil(imgH / pagePxH));

      // Avoid zero-height/rounding artifacts at page boundaries.
      const pagePxHSafe = pagePxH > 0 ? pagePxH : imgH;

      for (let p = 0; p < totalPages; p++) {
        if (p > 0) doc.addPage();

        const sliceY = p * pagePxH;
        const sliceH = Math.min(pagePxHSafe, imgH - sliceY);
        if (sliceH <= 0) continue;

        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = imgW;
        pageCanvas.height = sliceH;
        const pCtx = pageCanvas.getContext('2d');

        pCtx.fillStyle = t.bg;
        pCtx.fillRect(0, 0, imgW, sliceH);

        pCtx.drawImage(
          canvas,
          0,
          sliceY,
          imgW,
          sliceH,
          0,
          0,
          imgW,
          sliceH
        );

        const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.95);

        // Map slice height to A4 millimeters based on how we scale X.
        // Since we render at width=a4W with the full image width, mm per image pixel is:
        // mmPerPxY = a4W / imgW
        const mmPerPxY = a4W / imgW;
        const renderMmH = Math.min(a4H, sliceH * mmPerPxY);

        doc.addImage(pageImgData, 'JPEG', 0, 0, a4W, renderMmH);
      }

      const fName = (result.fileName || 'resume').replace(/\.[^.]+$/, '');
      doc.save(`${fName}_analysis_report.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      // Restore hidden elements and prior inline animation/transition styles.
      hiddenNodes.forEach((n) => {
        const prev = prevDisplay.find((x) => x.node === n);
        if (prev) n.style.display = prev.display;
      });

      nodes.forEach((n) => {
        const prev = prevStyles.get(n);
        if (prev) {
          n.style.animation = prev.animation;
          n.style.transition = prev.transition;
        }
      });

      prevCanvasFilter.forEach(({ node, filter, opacity }) => {
        if (!node) return;
        node.style.filter = filter;
        node.style.opacity = opacity;
      });

      setPdfLoading(false);
    }
  }, [result, t.bg]);

  // ── Error State ──
  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: t.gradient, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div className="card fade-up" style={{ maxWidth: 520, textAlign: "center", padding: "48px 36px" }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>⚠️</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: t.text, marginBottom: 12 }}>Analysis Failed</h2>
          <p style={{ fontSize: 15, color: t.textMuted, lineHeight: 1.7, marginBottom: 28 }}>{error}</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="btn-primary" onClick={() => onNavigate("upload")}>← Try Again</button>
            <button className="btn-ghost" onClick={() => onNavigate("home")}>Go Home</button>
          </div>
        </div>
      </div>
    );
  }

  // ── No Data State ──
  if (!result) {
    return (
      <div style={{ minHeight: "100vh", background: t.gradient, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div className="card fade-up" style={{ maxWidth: 480, textAlign: "center", padding: "48px 36px" }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>📄</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: t.text, marginBottom: 12 }}>No Results Yet</h2>
          <p style={{ fontSize: 15, color: t.textMuted, lineHeight: 1.7, marginBottom: 28 }}>Upload and analyse a resume to see your report here.</p>
          <button className="btn-primary" onClick={() => onNavigate("upload")}>Upload Resume →</button>
        </div>
      </div>
    );
  }

  // ── Safe data extraction with fallbacks ──
  const ats = result.atsScore ?? 0;
  // Use the deterministic grammar score from the dedicated grammar analysis when available.
  // The root-level result.grammarScore is an AI estimate from the quick scan — it is NOT
  // the same formula as the Grammar Check page uses, so we must prefer grammarAnalysis.grammarScore.
  const grammarAnalysed = Boolean(result.grammarAnalysis?.grammarScore);
  const grammar = grammarAnalysed
    ? result.grammarAnalysis.grammarScore          // real deterministic score
    : (result.grammarScore ?? 0);                  // AI estimate (shown as EST)
  const skillMatch = result.skillMatch ?? 0;
  const overall = result.overallScore ?? 0;
  const normalizeArray = (arr) => {
    if (!arr) return [];
    return arr.map(item =>
      typeof item === 'string' ? item :
      item.name || item.skill || item.technology ||
      JSON.stringify(item)
    );
  };
  const presentSkills = normalizeArray(result.presentSkills);
  const missingSkills = normalizeArray(result.missingSkills);
  const grammarIssues = result.grammarIssues || [];
  const jobRoles = [...(result.jobRoles || [])].sort((a, b) => (b.match || 0) - (a.match || 0));
  const suggestions = result.suggestions || [];
  const sectionsAnalysis = result.sectionsAnalysis || [];
  const fileName = result.fileName || "resume.pdf";
  const topRole = jobRoles.length > 0 ? jobRoles[0].title : "General";

  // ── Diagnostic: print exactly what the page received ──
  console.log("[ResultsPage] Props result:", result);
  console.log("[ResultsPage] Dashboard input: ats=%o grammar=%o skillMatch=%o overall=%o",
    ats, grammar, skillMatch, overall);
  console.log("[ResultsPage] Arrays: presentSkills=%o missingSkills=%o jobRoles=%o grammarIssues=%o",
    presentSkills, missingSkills, jobRoles, grammarIssues);

  // ── Build tech stack bars from present skills (API doesn't return techStack) ──
  const techStack = presentSkills.slice(0, 6).map((skill) => {
    // Deterministic “level” so the PDF matches the on-screen values exactly.
    // Derive a stable pseudo-score from the skill name + skillMatch.
    let hash = 0;
    for (let i = 0; i < skill.length; i++) hash = (hash * 31 + skill.charCodeAt(i)) >>> 0;
    const delta = (hash % 21) - 10; // [-10..10]
    return {
      name: skill,
      level: Math.max(50, Math.min(100, Math.round(skillMatch + delta))),
    };
  });

  return (
    <div style={{ minHeight: "100vh", background: t.gradient, padding: "40px 24px 80px" }}>
      <div ref={contentRef} style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Header */}
        <div className="fade-up" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 36, flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 800, color: t.text, letterSpacing: "-1.5px" }}>Analysis Report</h1>
            <p style={{ color: t.textMuted, fontSize: 14, marginTop: 4 }}>{fileName} — {topRole}</p>
          </div>
          <div data-pdf-hide style={{ display: "flex", gap: 10 }}>
            <button className="btn-ghost" onClick={() => onNavigate("upload")}>↑ New Analysis</button>
            <button className="btn-primary" onClick={generatePDF} disabled={pdfLoading}
              style={{ opacity: pdfLoading ? 0.7 : 1, position: "relative" }}
            >
              {pdfLoading ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 14, height: 14, border: "2px solid rgba(0,0,0,0.2)", borderTopColor: "#000", borderRadius: "50%", display: "inline-block", animation: "spin 1s linear infinite" }} />
                  Generating…
                </span>
              ) : "⬇ Download PDF"}
            </button>
          </div>
        </div>

        {/* Score Cards — ATS Score navigates to ATS page, Grammar navigates to Grammar Check page */}
        <div className="fade-up delay-1" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16, marginBottom: 28 }}>
          {[
            ["ATS Score", ats, "Passes tracking systems", "ats"],
            ["Grammar", grammar, grammarAnalysed ? "Full analysis score" : "Quick scan — click for full", "grammar"],
            ["Skill Match", skillMatch, "Vs job requirements", "none"],
            ["Overall", overall, "Resume strength", "none"],
          ].map(([label, val, sub, clickType]) => (
            <div
              key={label}
              id={clickType === "ats" ? "ats-score-card" : clickType === "grammar" ? "grammar-score-card" : undefined}
              className="card"
              onClick={clickType === "ats" ? () => onNavigate("atsScore") : clickType === "grammar" ? () => onNavigate("grammarCheck") : undefined}
              onMouseEnter={clickType !== "none" ? () => setAtsCardHover(clickType) : undefined}
              onMouseLeave={clickType !== "none" ? () => setAtsCardHover(null) : undefined}
              style={{
                textAlign: "center",
                background: t.scoreBg,
                cursor: clickType !== "none" ? "pointer" : "default",
                transition: "all .25s",
                position: "relative",
                ...(clickType !== "none" && atsCardHover === clickType ? {
                  boxShadow: `0 8px 32px ${t.accentGlow}`,
                  transform: "translateY(-3px)",
                  border: `1px solid ${t.accentGlow}`,
                } : {}),
              }}
            >
              {/* Badge: show if grammar is estimated vs analysed */}
              {clickType === "grammar" && (
                <span style={{
                  position: "absolute", top: 8, right: 8,
                  fontSize: 9, fontWeight: 700, letterSpacing: ".3px",
                  padding: "2px 6px", borderRadius: 6,
                  background: grammarAnalysed ? "rgba(110,231,183,0.15)" : "rgba(251,191,36,0.15)",
                  color: grammarAnalysed ? t.accent : t.warning,
                  border: `1px solid ${grammarAnalysed ? t.accentGlow : "rgba(251,191,36,0.3)"}`
                }}>
                  {grammarAnalysed ? "FULL" : "EST"}
                </span>
              )}
              <ScoreRing score={val} color={scoreColor(val)} />
              <p style={{ fontWeight: 700, color: t.text, fontSize: 15, marginTop: 8 }}>{label}</p>
              <p style={{ color: t.textMuted, fontSize: 12, marginTop: 3 }}>{sub}</p>
              {clickType !== "none" && (
                <p style={{
                  fontSize: 11, marginTop: 8, fontWeight: 600,
                  color: atsCardHover === clickType ? t.accent : t.textDim,
                  transition: "color .2s",
                  letterSpacing: ".3px",
                }}>
                  {clickType === "ats" ? (atsCardHover === "ats" ? "🔍 View X-Ray →" : "View X-Ray →") : (atsCardHover === "grammar" ? "✏️ Full Analysis →" : "View Analysis →")}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Two column layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>

          {/* Skills */}
          <div className="card fade-up delay-2">
            <h3 style={{ fontSize: 17, fontWeight: 700, color: t.text, marginBottom: 16 }}>Skill Analysis</h3>
            <p style={{ fontSize: 12, color: t.accent, fontWeight: 600, marginBottom: 10, letterSpacing: ".5px" }}>PRESENT</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {presentSkills.length > 0 ? presentSkills.map(s => <SkillTag key={s} label={s} present t={t} />) : <span style={{ fontSize: 13, color: t.textDim }}>None detected</span>}
            </div>
            <p style={{ fontSize: 12, color: t.danger, fontWeight: 600, marginBottom: 10, letterSpacing: ".5px" }}>MISSING</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {missingSkills.length > 0 ? missingSkills.map(s => <SkillTag key={s} label={s} present={false} t={t} />) : <span style={{ fontSize: 13, color: t.textDim }}>None — great job!</span>}
            </div>
          </div>

          {/* Tech Stack */}
          <div className="card fade-up delay-2">
            <h3 style={{ fontSize: 17, fontWeight: 700, color: t.text, marginBottom: 20 }}>Tech Stack Proficiency</h3>
            {techStack.length > 0 ? techStack.map(ts => (
              <Bar key={ts.name} label={ts.name} value={ts.level}
                color={`linear-gradient(90deg,${t.accent},#60a5fa)`} t={t} />
            )) : <p style={{ fontSize: 13, color: t.textDim }}>No tech skills detected</p>}
          </div>
        </div>

        {/* ═══ Dynamic Sections Analysis ═══ */}
        {sectionsAnalysis.length > 0 && (() => {
          // Auto-pick emoji icon based on section name keywords
          const getIcon = (name) => {
            const n = name.toLowerCase();
            if (n.includes("contact") || n.includes("personal")) return "📇";
            if (n.includes("summary") || n.includes("profile") || n.includes("objective") || n.includes("about")) return "👤";
            if (n.includes("experience") || n.includes("employment") || n.includes("work") || n.includes("internship")) return "💼";
            if (n.includes("education") || n.includes("academic") || n.includes("degree")) return "🎓";
            if (n.includes("skill") || n.includes("tech") || n.includes("competenc")) return "⚡";
            if (n.includes("project") || n.includes("portfolio") || n.includes("case stud")) return "🛠️";
            if (n.includes("certif") || n.includes("licen") || n.includes("credential")) return "🏅";
            if (n.includes("award") || n.includes("achiev") || n.includes("honor")) return "🏆";
            if (n.includes("publication") || n.includes("research") || n.includes("paper")) return "📑";
            if (n.includes("volunteer") || n.includes("community") || n.includes("pro bono")) return "🤝";
            if (n.includes("language")) return "🌐";
            if (n.includes("reference") || n.includes("recommend")) return "📋";
            if (n.includes("hobby") || n.includes("interest")) return "🎯";
            if (n.includes("extra") || n.includes("activit") || n.includes("club")) return "⭐";
            if (n.includes("training") || n.includes("workshop") || n.includes("course")) return "📚";
            if (n.includes("leadership") || n.includes("position") || n.includes("committee")) return "👑";
            if (n.includes("affiliation") || n.includes("membership") || n.includes("society")) return "🔗";
            if (n.includes("declaration") || n.includes("statement")) return "📝";
            if (n.includes("link") || n.includes("github") || n.includes("linkedin") || n.includes("website")) return "🔗";
            return "📄";
          };

          const qualityColors = {
            Strong:   { bg: "rgba(110,231,183,0.1)", color: "#6ee7b7", border: "rgba(110,231,183,0.3)" },
            Adequate: { bg: "rgba(96,165,250,0.1)",  color: "#60a5fa", border: "rgba(96,165,250,0.3)" },
            Weak:     { bg: "rgba(251,191,36,0.1)",  color: "#fbbf24", border: "rgba(251,191,36,0.3)" },
            Minimal:  { bg: "rgba(248,113,113,0.1)", color: "#f87171", border: "rgba(248,113,113,0.3)" },
          };

          const maxAts = Math.max(...sectionsAnalysis.map(s => s.atsContribution || 0), 1);

          return (
            <div className="card fade-up delay-3" style={{ marginTop: 20, marginBottom: 20 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: t.text, marginBottom: 6 }}>
                📋 Resume Sections Breakdown
                <span className="tag" style={{ marginLeft: 10, background: t.accentSoft, color: t.accent, border: `1px solid ${t.accentGlow}` }}>
                  {sectionsAnalysis.length} detected
                </span>
              </h3>
              <p style={{ fontSize: 12, color: t.textMuted, marginBottom: 20 }}>
                Every section found in your resume, rated by quality with its ATS score contribution
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 14 }}>
                {sectionsAnalysis.map((s, i) => {
                  const qc = qualityColors[s.quality] || qualityColors.Adequate;
                  const atsVal = s.atsContribution || 0;
                  const barWidth = maxAts > 0 ? Math.round((atsVal / maxAts) * 100) : 0;

                  return (
                    <div key={i} style={{
                      padding: 16, borderRadius: 14,
                      background: t.surfaceAlt,
                      border: `1px solid ${qc.border}`,
                      display: "flex", flexDirection: "column", gap: 10,
                      transition: "transform .2s, box-shadow .2s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 6px 20px ${qc.border}`; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
                    >
                      {/* Header row: icon + name + quality badge */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{
                          width: 36, height: 36, borderRadius: 10,
                          background: qc.bg, border: `1px solid ${qc.border}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 18, flexShrink: 0,
                        }}>
                          {getIcon(s.section)}
                        </span>
                        <p style={{ fontWeight: 700, color: t.text, fontSize: 14, flex: 1 }}>{s.section}</p>
                        <span className="tag" style={{
                          background: qc.bg, color: qc.color,
                          border: `1px solid ${qc.border}`, fontSize: 11,
                        }}>
                          {s.quality}
                        </span>
                      </div>

                      {/* Note */}
                      <p style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.6 }}>{s.note}</p>

                      {/* ── Dynamic details sub-fields ── */}
                      {s.details && (() => {
                        const d = s.details;
                        return (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

                            {/* SKILLS: groups */}
                            {d.groups && Array.isArray(d.groups) && d.groups.filter(Boolean).length > 0 && (
                              <div>
                                <span style={{ fontSize: 11, color: t.textDim, fontWeight: 600, letterSpacing: ".4px" }}>
                                  {d.totalCount || d.groups.filter(Boolean).length} SKILLS DETECTED
                                </span>
                                {d.groups.filter(Boolean).map((g, gi) => (
                                  <div key={gi} style={{ marginTop: 6 }}>
                                    <span style={{ fontSize: 11, color: qc.color, fontWeight: 600 }}>{g?.category || g?.name || "Skills"}</span>
                                    {g?.items && Array.isArray(g.items) && (
                                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 4 }}>
                                        {g.items.filter(Boolean).map((item, ii) => (
                                          <span key={ii} className="tag" style={{ background: qc.bg, color: qc.color, border: `1px solid ${qc.border}`, fontSize: 10 }}>
                                            {typeof item === "object" ? (item?.name || item?.item || JSON.stringify(item)) : String(item)}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* PROJECTS / ACHIEVEMENTS: items + impact */}
                            {d.items && Array.isArray(d.items) && d.items.filter(Boolean)[0]?.name && d.items.filter(Boolean)[0]?.industryRecognized === undefined && d.items.filter(Boolean)[0]?.language === undefined && (
                              <div>
                                <span style={{ fontSize: 11, color: t.textDim, fontWeight: 600 }}>{d.totalCount || d.items.filter(Boolean).length} ITEMS FOUND</span>
                                {d.items.filter(Boolean).map((item, ii) => (
                                  <div key={ii} style={{ marginTop: 6, padding: "6px 10px", borderRadius: 8, background: t.surface }}>
                                    <p style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{item?.name || item?.title || "Item"}</p>
                                    <p style={{ fontSize: 11, color: item?.impact === "Not specified" ? t.textDim : t.accent, marginTop: 2 }}>
                                      {item?.impact === "Not specified" || !item?.impact ? "⚠ No impact metric" : `✦ ${item.impact}`}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* CERTIFICATIONS: items */}
                            {d.items && Array.isArray(d.items) && d.items.filter(Boolean)[0]?.industryRecognized !== undefined && (
                              <div>
                                <span style={{ fontSize: 11, color: t.textDim, fontWeight: 600 }}>{d.totalCount || d.items.filter(Boolean).length} CERTIFICATION{(d.totalCount || d.items.filter(Boolean).length) !== 1 ? "S" : ""}</span>
                                {d.items.filter(Boolean).map((item, ii) => (
                                  <div key={ii} style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 11, color: item?.industryRecognized ? t.accent : t.warning }}>
                                      {item?.industryRecognized ? "✓" : "~"}
                                    </span>
                                    <span style={{ fontSize: 12, color: t.text, flex: 1 }}>{item?.name || item?.title || "Certification"}</span>
                                    {item?.relevance && <span className="tag" style={{ fontSize: 10, background: qc.bg, color: qc.color, border: `1px solid ${qc.border}` }}>{item.relevance}</span>}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* LANGUAGES: items */}
                            {d.items && Array.isArray(d.items) && d.items.filter(Boolean)[0]?.language !== undefined && (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {d.items.filter(Boolean).map((item, ii) => (
                                  <div key={ii} className="tag" style={{ background: qc.bg, color: qc.color, border: `1px solid ${qc.border}`, fontSize: 11, gap: 6 }}>
                                    🌐 {item?.language || item?.name || "Language"}
                                    {item?.proficiency && <span style={{ color: t.textDim, fontWeight: 400 }}>· {item.proficiency}</span>}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* EDUCATION: relevance + GPA */}
                            {d.relevance !== undefined && (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                                <span className="tag" style={{ background: qc.bg, color: qc.color, border: `1px solid ${qc.border}`, fontSize: 11 }}>
                                  Relevance: {d.relevance}
                                </span>
                                {d.gpa && (
                                  <span className="tag" style={{ background: "rgba(167,139,250,0.1)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)", fontSize: 11 }}>
                                    GPA {d.gpa}
                                  </span>
                                )}
                                {d.note && <p style={{ fontSize: 11, color: t.textMuted, width: "100%", marginTop: 2 }}>{d.note}</p>}
                              </div>
                            )}

                            {/* EMPLOYMENT: total years + trajectory */}
                            {d.totalYears !== undefined && (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                                <span className="tag" style={{ background: "rgba(96,165,250,0.1)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.3)", fontSize: 11 }}>
                                  ⏱ {d.totalYears}
                                </span>
                                <span className="tag" style={{ background: qc.bg, color: qc.color, border: `1px solid ${qc.border}`, fontSize: 11 }}>
                                  {d.growthTrajectory}
                                </span>
                                {d.trajectoryNote && <p style={{ fontSize: 11, color: t.textMuted, width: "100%", marginTop: 2 }}>{d.trajectoryNote}</p>}
                              </div>
                            )}

                          </div>
                        );
                      })()}

                      {/* ATS Contribution bar */}
                      {atsVal > 0 && (
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 11, color: t.textDim, fontWeight: 500 }}>ATS Contribution</span>
                            <span style={{ fontSize: 11, color: qc.color, fontWeight: 700 }}>+{atsVal} pts</span>
                          </div>
                          <div style={{ height: 5, borderRadius: 10, background: `${qc.border}`, overflow: "hidden" }}>
                            <div style={{
                              height: "100%", borderRadius: 10,
                              background: `linear-gradient(90deg, ${qc.color}, ${t.accent})`,
                              width: `${barWidth}%`,
                              transition: "width 1s cubic-bezier(.22,1,.36,1)",
                            }} />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>

        {/* Best Job Roles Analysis CTA */}
<div
  className="card fade-up delay-3"
  onClick={onBestJobRoles}
  style={{
    gridColumn: "1 / -1",
    marginBottom: 0,
    padding: "20px 22px",
    cursor: "pointer",
    border: `1px solid ${t.accentGlow}`,
    borderLeft: `3px solid ${t.accent}`,
    background: t.cardGrad || t.surface,
    transition: "all .25s ease",
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = "translateY(-2px)";
    e.currentTarget.style.boxShadow = `0 8px 28px ${t.accentGlow}`;
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = "translateY(0)";
    e.currentTarget.style.boxShadow = "none";
  }}
>
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
    <div>
      <h3 style={{
        fontSize: 17,
        fontWeight: 700,
        color: t.text,
        marginBottom: 6
      }}>
        💼 Find Your Best Job Roles
      </h3>

      <p style={{
        fontSize: 13,
        color: t.textMuted,
        margin: 0,
        lineHeight: 1.5
      }}>
        Discover the job roles that best match your resume, skills, and experience.
      </p>
    </div>

    <span style={{
      fontSize: 13,
      color: t.accent,
      fontWeight: 700,
      whiteSpace: "nowrap"
    }}>
      Analyse Roles →
    </span>
  </div>
</div>


          {/* Job Roles */}
          <div className="card fade-up delay-3">
            <h3 style={{ fontSize: 17, fontWeight: 700, color: t.text, marginBottom: 16 }}>Best Matched Job Roles</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {jobRoles.length > 0 ? jobRoles.map((r, i) => (
                <div key={r.title} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: i === 0 ? t.accentSoft : t.surfaceAlt, border: `1px solid ${i === 0 ? t.accentGlow : "transparent"}` }}>
                  <span style={{ fontSize: 20 }}>{r.icon || "💼"}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, color: t.text, fontSize: 14 }}>{r.title}</p>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 800, color: scoreColor(r.match || 0), fontFamily: "Syne,sans-serif" }}>{r.match || 0}%</span>
                </div>
              )) : <p style={{ fontSize: 13, color: t.textDim }}>No role matches found</p>}
            </div>
          </div>

          {/* Grammar Issues */}
          <div className="card fade-up delay-3">
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: t.text, margin: 0 }}>
                Grammar & Phrasing
                <span className="tag" style={{ marginLeft: 10, background: "rgba(248,113,113,0.1)", color: t.danger, border: `1px solid rgba(248,113,113,0.25)` }}>
                  {grammarIssues.length} issues
                </span>
              </h3>
              <span
                onClick={() => onNavigate("grammarCheck")}
                style={{ fontSize: 12, color: t.accent, fontWeight: 600, cursor: "pointer", letterSpacing: ".3px", whiteSpace: "nowrap", transition: "opacity .2s" }}
                onMouseEnter={e => e.currentTarget.style.opacity = ".7"}
                onMouseLeave={e => e.currentTarget.style.opacity = "1"}
              >
                View Full Grammar Analysis →
              </span>
            </div>
            {/* weakPatterns summary if grammarAnalysis exists */}
            {result.grammarAnalysis?.weakPatterns && (() => {
              const wp = result.grammarAnalysis.weakPatterns;
              return (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                  {[
                    ["Passive Voice", wp.passiveVoiceCount, "#fbbf24"],
                    ["Filler Phrases", wp.fillerPhraseCount, "#f87171"],
                    ["Weak Verbs", wp.weakVerbCount, "#fb923c"],
                    ["Missing Metrics", wp.missingMetricsCount, "#a78bfa"],
                  ].map(([label, count, color]) => (
                    <div key={label} style={{ padding: "8px 12px", borderRadius: 10, background: t.surfaceAlt, border: `1px solid ${t.border}` }}>
                      <p style={{ fontSize: 18, fontWeight: 800, color, fontFamily: "Syne,sans-serif" }}>{count ?? 0}</p>
                      <p style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>{label}</p>
                    </div>
                  ))}
                </div>
              );
            })()}
            {(() => {
  const displayGrammarIssues =
    result.grammarAnalysis?.grammarIssues?.length > 0
      ? result.grammarAnalysis.grammarIssues
      : grammarIssues;

  return displayGrammarIssues.length > 0
    ? displayGrammarIssues.map((g, i) => (
              <div key={i} style={{ marginBottom: 16, padding: 14, borderRadius: 10, background: t.surfaceAlt }}>
                <p style={{ fontSize: 13, color: t.danger, marginBottom: 6, lineHeight: 1.5 }}>
                  ✗ <em>"{g.original || g.text || g.before || g.issue || "--"}"</em>
                </p>
                <p style={{ fontSize: 13, color: t.accent, lineHeight: 1.5 }}>
                 ✓ {g.corrected || g.fix || g.after || g.suggestion || "--"}
                </p>
              </div>
                  ))
    : <p style={{ fontSize: 13, color: t.accent }}>
        ✓ No grammar issues found — excellent!
      </p>;
})()}
          </div>
        </div>

        {/* Suggestions */}
        <div className="card fade-up delay-4">
          <h3 style={{ fontSize: 17, fontWeight: 700, color: t.text, marginBottom: 16 }}>💡 Top Suggestions to Improve</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12 }}>
            {suggestions.length > 0 ? suggestions.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 14px", borderRadius: 10, background: t.surfaceAlt }}>
                <span style={{ color: t.accent, fontWeight: 800, fontSize: 16, marginTop: 1 }}>{i + 1}</span>
                <p style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.6 }}>{s}</p>
              </div>
                  )) : <p style={{ fontSize: 13, color: t.textDim }}>No suggestions — your resume looks solid!</p>}
          </div>
        </div>

        {/* ═══ Dynamic Sections Analysis — moved above Job Roles ═══ */}
        {false && (() => {
          // Auto-pick emoji icon based on section name keywords
          const getIcon = (name) => {
            const n = name.toLowerCase();
            if (n.includes("contact") || n.includes("personal")) return "📇";
            if (n.includes("summary") || n.includes("profile") || n.includes("objective") || n.includes("about")) return "👤";
            if (n.includes("experience") || n.includes("employment") || n.includes("work") || n.includes("internship")) return "💼";
            if (n.includes("education") || n.includes("academic") || n.includes("degree")) return "🎓";
            if (n.includes("skill") || n.includes("tech") || n.includes("competenc")) return "⚡";
            if (n.includes("project") || n.includes("portfolio") || n.includes("case stud")) return "🛠️";
            if (n.includes("certif") || n.includes("licen") || n.includes("credential")) return "🏅";
            if (n.includes("award") || n.includes("achiev") || n.includes("honor")) return "🏆";
            if (n.includes("publication") || n.includes("research") || n.includes("paper")) return "📑";
            if (n.includes("volunteer") || n.includes("community") || n.includes("pro bono")) return "🤝";
            if (n.includes("language")) return "🌐";
            if (n.includes("reference") || n.includes("recommend")) return "📋";
            if (n.includes("hobby") || n.includes("interest")) return "🎯";
            if (n.includes("extra") || n.includes("activit") || n.includes("club")) return "⭐";
            if (n.includes("training") || n.includes("workshop") || n.includes("course")) return "📚";
            if (n.includes("leadership") || n.includes("position") || n.includes("committee")) return "👑";
            if (n.includes("affiliation") || n.includes("membership") || n.includes("society")) return "🔗";
            if (n.includes("declaration") || n.includes("statement")) return "📝";
            if (n.includes("link") || n.includes("github") || n.includes("linkedin") || n.includes("website")) return "🔗";
            return "📄";
          };

          const qualityColors = {
            Strong:   { bg: "rgba(110,231,183,0.1)", color: "#6ee7b7", border: "rgba(110,231,183,0.3)" },
            Adequate: { bg: "rgba(96,165,250,0.1)",  color: "#60a5fa", border: "rgba(96,165,250,0.3)" },
            Weak:     { bg: "rgba(251,191,36,0.1)",  color: "#fbbf24", border: "rgba(251,191,36,0.3)" },
            Minimal:  { bg: "rgba(248,113,113,0.1)", color: "#f87171", border: "rgba(248,113,113,0.3)" },
          };

          const maxAts = Math.max(...sectionsAnalysis.map(s => s.atsContribution || 0), 1);

          return (
            <div className="card fade-up delay-5" style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: t.text, marginBottom: 6 }}>
                📋 Resume Sections Breakdown
                <span className="tag" style={{ marginLeft: 10, background: t.accentSoft, color: t.accent, border: `1px solid ${t.accentGlow}` }}>
                  {sectionsAnalysis.length} detected
                </span>
              </h3>
              <p style={{ fontSize: 12, color: t.textMuted, marginBottom: 20 }}>
                Every section found in your resume, rated by quality with its ATS score contribution
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 14 }}>
                {sectionsAnalysis.map((s, i) => {
                  const qc = qualityColors[s.quality] || qualityColors.Adequate;
                  const atsVal = s.atsContribution || 0;
                  const barWidth = maxAts > 0 ? Math.round((atsVal / maxAts) * 100) : 0;

                  return (
                    <div key={i} style={{
                      padding: 16, borderRadius: 14,
                      background: t.surfaceAlt,
                      border: `1px solid ${qc.border}`,
                      display: "flex", flexDirection: "column", gap: 10,
                      transition: "transform .2s, box-shadow .2s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 6px 20px ${qc.border}`; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
                    >
                      {/* Header row: icon + name + quality badge */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{
                          width: 36, height: 36, borderRadius: 10,
                          background: qc.bg, border: `1px solid ${qc.border}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 18, flexShrink: 0,
                        }}>
                          {getIcon(s.section)}
                        </span>
                        <p style={{ fontWeight: 700, color: t.text, fontSize: 14, flex: 1 }}>{s.section}</p>
                        <span className="tag" style={{
                          background: qc.bg, color: qc.color,
                          border: `1px solid ${qc.border}`, fontSize: 11,
                        }}>
                          {s.quality}
                        </span>
                      </div>

                      {/* Note */}
                      <p style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.6 }}>{s.note}</p>

                      {/* ── Dynamic details sub-fields ── */}
                      {s.details && (() => {
                        const d = s.details;
                        return (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

                            {/* SKILLS: groups */}
                            {d.groups && Array.isArray(d.groups) && d.groups.filter(Boolean).length > 0 && (
                              <div>
                                <span style={{ fontSize: 11, color: t.textDim, fontWeight: 600, letterSpacing: ".4px" }}>
                                  {d.totalCount || d.groups.filter(Boolean).length} SKILLS DETECTED
                                </span>
                                {d.groups.filter(Boolean).map((g, gi) => (
                                  <div key={gi} style={{ marginTop: 6 }}>
                                    <span style={{ fontSize: 11, color: qc.color, fontWeight: 600 }}>{g?.category || g?.name || "Skills"}</span>
                                    {g?.items && Array.isArray(g.items) && (
                                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 4 }}>
                                        {g.items.filter(Boolean).map((item, ii) => (
                                          <span key={ii} className="tag" style={{ background: qc.bg, color: qc.color, border: `1px solid ${qc.border}`, fontSize: 10 }}>
                                            {typeof item === "object" ? (item?.name || item?.item || JSON.stringify(item)) : String(item)}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* PROJECTS: items + impact */}
                            {d.items && d.impact !== undefined && (
                              <div>
                                <span style={{ fontSize: 11, color: t.textDim, fontWeight: 600 }}>{d.totalCount || d.items.filter(Boolean).length} ITEMS FOUND</span>
                                {d.items.filter(Boolean).map((item, ii) => (
                                  <div key={ii} style={{ marginTop: 6, padding: "6px 10px", borderRadius: 8, background: t.surface }}>
                                    <p style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{item?.name || item?.title || "Item"}</p>
                                    <p style={{ fontSize: 11, color: item?.impact === "Not specified" ? t.textDim : t.accent, marginTop: 2 }}>
                                      {item?.impact === "Not specified" || !item?.impact ? "⚠ No impact metric" : `✦ ${item.impact}`}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* PROJECTS (alternative shape without d.impact) */}
                            {d.items && d.impact === undefined && Array.isArray(d.items) && d.items.filter(Boolean)[0]?.name && (
                              <div>
                                <span style={{ fontSize: 11, color: t.textDim, fontWeight: 600 }}>{d.totalCount || d.items.filter(Boolean).length} ITEMS FOUND</span>
                                {d.items.filter(Boolean).map((item, ii) => (
                                  <div key={ii} style={{ marginTop: 6, padding: "6px 10px", borderRadius: 8, background: t.surface }}>
                                    <p style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{item?.name || item?.title || "Item"}</p>
                                    <p style={{ fontSize: 11, color: item?.impact === "Not specified" ? t.textDim : t.accent, marginTop: 2 }}>
                                      {item?.impact === "Not specified" || !item?.impact ? "⚠ No impact metric" : `✦ ${item.impact}`}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* CERTIFICATIONS: items */}
                            {d.items && Array.isArray(d.items) && d.items.filter(Boolean)[0]?.industryRecognized !== undefined && (
                              <div>
                                <span style={{ fontSize: 11, color: t.textDim, fontWeight: 600 }}>{d.totalCount || d.items.filter(Boolean).length} CERTIFICATION{(d.totalCount || d.items.filter(Boolean).length) !== 1 ? "S" : ""}</span>
                                {d.items.filter(Boolean).map((item, ii) => (
                                  <div key={ii} style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 11, color: item?.industryRecognized ? t.accent : t.warning }}>
                                      {item?.industryRecognized ? "✓" : "~"}
                                    </span>
                                    <span style={{ fontSize: 12, color: t.text, flex: 1 }}>{item?.name || item?.title || "Certification"}</span>
                                    {item?.relevance && <span className="tag" style={{ fontSize: 10, background: qc.bg, color: qc.color, border: `1px solid ${qc.border}` }}>{item.relevance}</span>}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* LANGUAGES: items */}
                            {d.items && Array.isArray(d.items) && d.items.filter(Boolean)[0]?.language !== undefined && (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {d.items.filter(Boolean).map((item, ii) => (
                                  <div key={ii} className="tag" style={{ background: qc.bg, color: qc.color, border: `1px solid ${qc.border}`, fontSize: 11, gap: 6 }}>
                                    🌐 {item?.language || item?.name || "Language"}
                                    {item?.proficiency && <span style={{ color: t.textDim, fontWeight: 400 }}>· {item.proficiency}</span>}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* EDUCATION: relevance + GPA */}
                            {d.relevance !== undefined && (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                                <span className="tag" style={{ background: qc.bg, color: qc.color, border: `1px solid ${qc.border}`, fontSize: 11 }}>
                                  Relevance: {d.relevance}
                                </span>
                                {d.gpa && (
                                  <span className="tag" style={{ background: "rgba(167,139,250,0.1)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)", fontSize: 11 }}>
                                    GPA {d.gpa}
                                  </span>
                                )}
                                {d.note && <p style={{ fontSize: 11, color: t.textMuted, width: "100%", marginTop: 2 }}>{d.note}</p>}
                              </div>
                            )}

                            {/* EMPLOYMENT: total years + trajectory */}
                            {d.totalYears !== undefined && (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                                <span className="tag" style={{ background: "rgba(96,165,250,0.1)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.3)", fontSize: 11 }}>
                                  ⏱ {d.totalYears}
                                </span>
                                <span className="tag" style={{ background: qc.bg, color: qc.color, border: `1px solid ${qc.border}`, fontSize: 11 }}>
                                  {d.growthTrajectory}
                                </span>
                                {d.trajectoryNote && <p style={{ fontSize: 11, color: t.textMuted, width: "100%", marginTop: 2 }}>{d.trajectoryNote}</p>}
                              </div>
                            )}

                          </div>
                        );
                      })()}

                      {/* ATS Contribution bar */}
                      {atsVal > 0 && (
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 11, color: t.textDim, fontWeight: 500 }}>ATS Contribution</span>
                            <span style={{ fontSize: 11, color: qc.color, fontWeight: 700 }}>+{atsVal} pts</span>
                          </div>
                          <div style={{ height: 5, borderRadius: 10, background: `${qc.border}`, overflow: "hidden" }}>
                            <div style={{
                              height: "100%", borderRadius: 10,
                              background: `linear-gradient(90deg, ${qc.color}, ${t.accent})`,
                              width: `${barWidth}%`,
                              transition: "width 1s cubic-bezier(.22,1,.36,1)",
                            }} />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Total ATS from sections */}
              <div style={{
                marginTop: 16, padding: "12px 16px", borderRadius: 10,
                background: t.accentSoft, border: `1px solid ${t.accentGlow}`,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
                  Total ATS from {sectionsAnalysis.length} sections
                </span>
                <span style={{ fontSize: 16, fontWeight: 800, color: t.accent, fontFamily: "Syne,sans-serif" }}>
                  {sectionsAnalysis.reduce((sum, s) => sum + (s.atsContribution || 0), 0)} / {result.atsScore ?? 0}
                </span>
              </div>
            </div>
          );
        })()}

      </div>
    </div>
  );
};

// ── BEST JOB ROLES PAGE ───────────────────────────────────────────────────────
const BestJobRolesPage = ({ t, result, onNavigate }) => {
  const [activeRole, setActiveRole] = useState(null);

  const scoreColor = (v) =>
    v >= 80 ? "#6ee7b7" : v >= 65 ? "#60a5fa" : v >= 50 ? "#fbbf24" : "#f87171";

  const formatDate = (iso) => {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    } catch { return null; }
  };

  // ── Error / Empty states ────────────────────────────────────────────────────
  if (!result) {
    return (
      <div style={{ minHeight: "100vh", background: t.gradient, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>💼</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: t.text, marginBottom: 10 }}>No results yet</h2>
          <p style={{ color: t.textMuted, marginBottom: 24, fontSize: 15 }}>Upload your resume to find your best job roles.</p>
          <button className="btn-primary" onClick={() => onNavigate("home")}>← Back to Home</button>
        </div>
      </div>
    );
  }

  const roles    = result.recommendedRoles || [];
  const jobsByRole = result.jobsByRole      || [];

  // ── API error state ─────────────────────────────────────────────────────────
  if (result.error) {
    return (
      <div style={{ minHeight: "100vh", background: t.gradient, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", padding: 40, maxWidth: 520 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: t.text, marginBottom: 10 }}>Analysis Failed</h2>
          <p style={{ color: t.textMuted, marginBottom: 28, fontSize: 15, lineHeight: 1.7 }}>{result.error}</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="btn-primary" onClick={() => onNavigate("bestJobRolesUpload")} style={{ padding: "11px 24px" }}>
              Try Again →
            </button>
            <button className="btn-ghost" onClick={() => onNavigate("home")} style={{ padding: "11px 24px" }}>
              ← Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Flatten jobs — show all roles' jobs or only the active role's jobs
  const displayedJobGroups = activeRole
    ? jobsByRole.filter((g) => g.role === activeRole)
    : jobsByRole;

  const totalJobs = jobsByRole.reduce((n, g) => n + (g.jobs?.length || 0), 0);

  return (
    <div style={{ minHeight: "100vh", background: t.gradient, padding: "60px 24px 80px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>

        {/* Back button */}
        <button
          className="btn-ghost fade-up"
          onClick={() => onNavigate("home")}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 32, padding: "9px 20px", fontSize: 14 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" /><polyline points="12 19 5 12 12 5" />
          </svg>
          Back to Home
        </button>

        {/* Page Header */}
        <div className="fade-up" style={{ marginBottom: 8 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.3)",
            borderRadius: 20, padding: "5px 14px", marginBottom: 18,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#60a5fa", display: "inline-block", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 12, color: "#60a5fa", fontWeight: 700, letterSpacing: ".5px" }}>AI-POWERED ROLE MATCHING</span>
          </div>
          <h1 style={{ fontSize: "clamp(28px,5vw,42px)", fontWeight: 800, color: t.text, letterSpacing: "-1.5px", marginBottom: 6, fontFamily: "Syne,sans-serif" }}>
            Best Job Roles
          </h1>
          <p style={{ fontSize: 16, color: t.textMuted, fontWeight: 300 }}>
            Jobs that match your resume — based on your skills, experience &amp; tech stack
          </p>
        </div>

        {/* ── Recommended Roles ────────────────────────────────────────────── */}
        <div className="card fade-up delay-1" style={{ marginTop: 32, padding: 28 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: t.text, marginBottom: 6, fontFamily: "Syne,sans-serif" }}>
            🎯 Your Strongest Matches
          </h2>
          <p style={{ fontSize: 13, color: t.textMuted, marginBottom: 24 }}>
            Click a role to filter the job listings below
          </p>

          {roles.length === 0 ? (
            <p style={{ color: t.textMuted, fontSize: 14 }}>No role recommendations found.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {roles.map((r, i) => {
                const isActive = activeRole === r.role;
                const pct = r.matchPercentage ?? 0;
                const col = scoreColor(pct);
                return (
                  <div
                    key={r.role}
                    className={`fade-up delay-${Math.min(i + 2, 6)}`}
                    onClick={() => setActiveRole(isActive ? null : r.role)}
                    style={{
                      cursor: "pointer",
                      padding: "16px 20px",
                      borderRadius: 12,
                      border: `1px solid ${isActive ? col : t.border}`,
                      background: isActive ? `rgba(${col === "#6ee7b7" ? "110,231,183" : col === "#60a5fa" ? "96,165,250" : col === "#fbbf24" ? "251,191,36" : "248,113,113"},0.08)` : t.surfaceAlt,
                      transition: "all .25s ease",
                      boxShadow: isActive ? `0 0 0 1px ${col}40` : "none",
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.borderColor = col; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.borderColor = t.border; }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{
                          width: 28, height: 28, borderRadius: "50%", background: `${col}22`,
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          fontSize: 13, fontWeight: 800, color: col, fontFamily: "Syne,sans-serif",
                          border: `1px solid ${col}44`,
                        }}>
                          {i + 1}
                        </span>
                        <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{r.role}</span>
                      </div>
                      <span style={{ fontSize: 22, fontWeight: 800, color: col, fontFamily: "Syne,sans-serif" }}>{pct}%</span>
                    </div>

                    {/* Progress bar */}
                    <div style={{ height: 6, borderRadius: 10, background: t.border, overflow: "hidden", marginBottom: 10 }}>
                      <div style={{
                        height: "100%", borderRadius: 10,
                        background: `linear-gradient(90deg, ${col}, ${col}99)`,
                        width: `${pct}%`,
                        transition: "width 1.1s cubic-bezier(.22,1,.36,1)",
                        boxShadow: `0 0 8px ${col}66`,
                      }} />
                    </div>

                    {r.reason && (
                      <p style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5, margin: 0 }}>{r.reason}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Real Job Listings ────────────────────────────────────────────── */}
        <div style={{ marginTop: 40 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
            <div>
              <h2 className="fade-up" style={{ fontSize: 22, fontWeight: 800, color: t.text, fontFamily: "Syne,sans-serif", marginBottom: 4 }}>
                📋 Recommended Jobs
              </h2>
              <p style={{ fontSize: 13, color: t.textMuted }}>
                {activeRole
                  ? `Showing jobs for "${activeRole}" — click the role above to clear filter`
                  : `${totalJobs} real job${totalJobs !== 1 ? "s" : ""} matched across your top roles`}
              </p>
            </div>
            {activeRole && (
              <button className="btn-ghost" onClick={() => setActiveRole(null)} style={{ fontSize: 13, padding: "8px 16px" }}>
                ✕ Clear Filter
              </button>
            )}
          </div>

          {displayedJobGroups.length === 0 ? (
            <div className="card fade-up" style={{ textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
              <p style={{ color: t.textMuted, fontSize: 15 }}>No live job listings found for these roles right now.</p>
              <p style={{ color: t.textDim, fontSize: 13, marginTop: 6 }}>This can happen if Adzuna has no results for the detected roles. Try again later.</p>
            </div>
          ) : (
            displayedJobGroups.map((group) => (
              <div key={group.role} style={{ marginBottom: 36 }}>
                {/* Role group header */}
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  background: t.accentSoft, border: `1px solid ${t.accentGlow}`,
                  borderRadius: 20, padding: "4px 14px", marginBottom: 14,
                }}>
                  <span style={{ fontSize: 12, color: t.accent, fontWeight: 700, letterSpacing: ".4px" }}>
                    💼 {group.role}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {(group.jobs || []).map((job, ji) => (
                    <div
                      key={ji}
                      className={`card fade-up delay-${Math.min(ji + 2, 6)}`}
                      style={{ padding: 22, borderLeft: `3px solid ${t.accent}` }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
                        <div style={{ flex: 1, minWidth: 180 }}>
                          <h3 style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 4, fontFamily: "Syne,sans-serif" }}>
                            {job.title}
                          </h3>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 13, color: t.accent, fontWeight: 600 }}>{job.company}</span>
                            <span style={{ color: t.textDim, fontSize: 12 }}>·</span>
                            <span style={{ fontSize: 13, color: t.textMuted }}>📍 {job.location}</span>
                          </div>
                        </div>

                        {job.jobUrl && (
                          <a
                            href={job.jobUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 6,
                              background: t.accent, color: "#000",
                              borderRadius: 10, padding: "9px 18px",
                              fontSize: 13, fontWeight: 700, fontFamily: "Syne,sans-serif",
                              textDecoration: "none", whiteSpace: "nowrap",
                              transition: "transform .2s, box-shadow .2s",
                              boxShadow: `0 2px 8px ${t.accentGlow}`,
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 6px 20px ${t.accentGlow}`; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = `0 2px 8px ${t.accentGlow}`; }}
                          >
                            View Job →
                          </a>
                        )}
                      </div>

                      {/* Meta row */}
                      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: job.description ? 12 : 0 }}>
                        {job.salary && (
                          <span style={{ fontSize: 12, color: "#6ee7b7", fontWeight: 600, background: "rgba(110,231,183,0.1)", padding: "3px 10px", borderRadius: 20, border: "1px solid rgba(110,231,183,0.25)" }}>
                            💰 {job.salary}
                          </span>
                        )}
                        {job.employmentType && (
                          <span style={{ fontSize: 12, color: "#a78bfa", fontWeight: 600, background: "rgba(167,139,250,0.1)", padding: "3px 10px", borderRadius: 20, border: "1px solid rgba(167,139,250,0.25)" }}>
                            {job.employmentType}
                          </span>
                        )}
                        {formatDate(job.postedDate) && (
                          <span style={{ fontSize: 12, color: t.textMuted }}>
                            🕐 {formatDate(job.postedDate)}
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      {job.description && (
                        <p style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.65, margin: 0, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {job.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer CTA */}
        <div className="fade-up" style={{ marginTop: 48, textAlign: "center" }}>
          <p style={{ color: t.textMuted, fontSize: 14, marginBottom: 16 }}>Want a full resume breakdown including ATS score, grammar check, and skill gaps?</p>
          <button className="btn-primary" onClick={() => onNavigate("upload")} style={{ padding: "12px 28px", fontSize: 14 }}>
            Run Full Analysis →
          </button>
        </div>

      </div>
    </div>
  );
};


// HISTORY PAGE
const HistoryPage = ({ t, onNavigate, setAnalysisResult }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const scoreColor = (v) => (v >= 80 ? "#6ee7b7" : v >= 60 ? "#fbbf24" : "#f87171");

  const tokenKey = "token";
  const token = localStorage.getItem(tokenKey);

  useEffect(() => {
    if (!token && !loading) {
      setError("Sign in to view your resume history");
    }
  }, [token, loading]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`${process.env.REACT_APP_API_URL}/api/resume/history`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`${res.status}::${text}`);
        }

        const data = await res.json();
        if (!cancelled) setHistory(Array.isArray(data) ? data : []);
      } catch (err) {
        if (cancelled) return;

        const msg = String(err?.message || "");
        if (msg.startsWith("401::") || msg.startsWith("403::") || msg.includes("401") || msg.includes("403")) {
          setError("Sign in to view your resume history");
        } else {
          setError("Couldn't load your resume history. Please try again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const formatDate = (value) => {
    if (!value) return "";
    try {
      return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };

  const getRoleLabel = (resume) => {
    const roles = resume?.jobRoles;
    if (Array.isArray(roles) && roles.length > 0 && roles[0]?.role) return roles[0].role;
    return resume?.experienceLevel || "";
  };

  const deleteOne = async (id) => {
    const ok = window.confirm("Delete this analysis?");
    if (!ok) return;

    try {
      const res = await fetch(`http://localhost:5000/api/resume/history/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`${res.status}::${text}`);
      }

      setHistory((prev) => prev.filter((r) => String(r?._id) !== String(id)));
    } catch (err) {
      const msg = String(err?.message || "");
      window.alert(
        msg.includes("401") || msg.includes("403")
          ? "Not authorized to delete this history."
          : "Failed to delete. Please try again."
      );
    }
  };

  const clearAll = async () => {
    const ok = window.confirm("This will permanently delete ALL your analysis history. Are you sure?");
    if (!ok) return;

    try {
      const res = await fetch("http://localhost:5000/api/resume/history", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`${res.status}::${text}`);
      }

      setHistory([]);
    } catch (err) {
      const msg = String(err?.message || "");
      window.alert(
        msg.includes("401") || msg.includes("403")
          ? "Not authorized to clear this history."
          : "Failed to clear history. Please try again."
      );
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: t.gradient, padding: "60px 24px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <h1 className="fade-up" style={{ fontSize: 32, fontWeight: 800, color: t.text, letterSpacing: "-1.5px", marginBottom: 8 }}>
            History
          </h1>
          <p className="fade-up delay-1" style={{ color: t.textMuted, fontSize: 15, marginBottom: 32 }}>
            Loading…
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: t.gradient, padding: "60px 24px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <h1 className="fade-up" style={{ fontSize: 32, fontWeight: 800, color: t.text, letterSpacing: "-1.5px", marginBottom: 8 }}>
            History
          </h1>
          <p className="fade-up delay-1" style={{ color: t.textMuted, fontSize: 15, marginBottom: 32 }}>
            {error}
          </p>
          <button className="btn-primary" style={{ padding: "10px 20px", fontSize: 13 }} onClick={() => onNavigate("login")}>
            Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: t.gradient, padding: "60px 24px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <h1 className="fade-up" style={{ fontSize: 32, fontWeight: 800, color: t.text, letterSpacing: "-1.5px", marginBottom: 8 }}>
            History
          </h1>
          <button
            className="btn-ghost"
            style={{
              fontSize: 13,
              padding: "10px 16px",
              borderColor: "rgba(248,113,113,0.35)",
              color: t.danger,
            }}
            onClick={clearAll}
            disabled={history.length === 0}
            title={history.length === 0 ? "No history to clear" : "Clear all history"}
          >
            🗑️ Clear All History
          </button>
        </div>

        <p className="fade-up delay-1" style={{ color: t.textMuted, fontSize: 15, marginBottom: 32 }}>
          Track your resume improvement over time
        </p>

        {history.length === 0 ? (
          <div className="card fade-up" style={{ padding: 24 }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>📄</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: t.text, marginBottom: 6 }}>No resumes analysed yet</h2>
            <p style={{ color: t.textMuted, fontSize: 14, lineHeight: 1.7 }}>Upload one to get started</p>
            <div style={{ marginTop: 18 }}>
              <button className="btn-primary" onClick={() => onNavigate("upload")} style={{ padding: "10px 20px", fontSize: 13 }}>
                Upload Resume →
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {history.map((resume, i) => {
              const roleLabel = getRoleLabel(resume);
              const ats = resume?.atsScore ?? 0;
              const overall = resume?.overallScore ?? 0;
              const dateStr = formatDate(resume?.createdAt);
              const id = resume?._id;
              return (
                <div key={id || i} className={`card fade-up delay-${i + 2}`} style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 32 }}>📄</div>

                  <div style={{ flex: 1, minWidth: 160 }}>
                    <p style={{ fontWeight: 700, color: t.text, fontSize: 15 }}>{resume?.fileName || "resume"}</p>
                    <p style={{ color: t.textMuted, fontSize: 12, marginTop: 2 }}>
                      {roleLabel || ""}
                      {roleLabel ? " · " : ""}
                      {dateStr}
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: 20 }}>
                    <div style={{ textAlign: "center" }}>
                      <p style={{ fontSize: 22, fontWeight: 800, color: scoreColor(ats), fontFamily: "Syne,sans-serif" }}>{ats}</p>
                      <p style={{ fontSize: 11, color: t.textMuted }}>ATS</p>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <p style={{ fontSize: 22, fontWeight: 800, color: scoreColor(overall), fontFamily: "Syne,sans-serif" }}>{overall}</p>
                      <p style={{ fontSize: 11, color: t.textMuted }}>Overall</p>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <button
                      className="btn-ghost"
                      style={{ fontSize: 13, padding: "8px 18px" }}
                      onClick={() => {
                        setAnalysisResult(resume);
                        onNavigate("results");
                      }}
                    >
                      View →
                    </button>

                    <button
                      className="btn-ghost"
                      style={{
                        fontSize: 14,
                        padding: "8px 14px",
                        borderColor: "rgba(248,113,113,0.35)",
                        color: t.danger,
                      }}
                      onClick={() => deleteOne(id)}
                      title="Delete analysis"
                      aria-label="Delete analysis"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};


// ── NAV BAR ───────────────────────────────────────────────────────────────────
const Navbar = ({ t, dark, setDark, page, onNavigate, user, onLogout }) => {
  const isAuthed = Boolean(user);

  return (
    <nav style={{
      position: "sticky", top: 0, zIndex: 100,
      background: `${t.surface}cc`, backdropFilter: "blur(16px)",
      borderBottom: `1px solid ${t.border}`,
      padding: "0 32px", height: 60,
      display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      <span onClick={() => onNavigate("home")} style={{ fontFamily: "Syne,sans-serif", fontWeight: 800, fontSize: 24, color: t.text, cursor: "pointer", letterSpacing: "0.5px", display: "inline-flex", alignItems: "center", gap: 4 }}>
        resume<span style={{ color: t.accent, background: t.accentSoft, padding: "2px 8px", borderRadius: 8, boxShadow: `0 0 12px ${t.accentGlow}` }}>AI</span>
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        {[["upload","Analyse"],["history","History"]].map(([p, label]) => (
          <span key={p} className="nav-link" onClick={() => onNavigate(p)}
            style={{ color: page === p ? t.accent : undefined, fontWeight: page === p ? 600 : undefined }}>
            {label}
          </span>
        ))}
        <button onClick={() => setDark(d => !d)} style={{
          background: t.surfaceAlt, border: `1px solid ${t.border}`,
          borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 15,
        }}>
          {dark ? "☀️" : "🌙"}
        </button>
        {isAuthed ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 13, color: t.accent, fontWeight: 600, fontFamily: "Syne,sans-serif" }}>
              👤 {user?.name || "User"}
            </span>
            <button className="btn-ghost" style={{ padding: "7px 16px", fontSize: 13 }} onClick={onLogout}>
              Logout
            </button>
          </div>
        ) : (
          <button className="btn-primary" style={{ padding: "8px 18px", fontSize: 13 }} onClick={() => onNavigate("login")}>
            Login
          </button>
        )}
      </div>
    </nav>
  );
};

// ── APP ROOT ──────────────────────────────────────────────────────────────────
export default function App() {
  const [dark, setDark] = useState(true);
  const [page, setPage] = useState("home");
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisFile, setAnalysisFile] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);
  // atsScoreResult: set when navigating to atsScore from ResultsPage (state b),
  // null when arriving from LandingPage (state a = upload-first flow).
  const [atsScoreResult, setAtsScoreResult] = useState(null);
  // grammarResult: set when navigating to grammarCheck from ResultsPage (state b),
  // null when arriving from LandingPage (state a = upload-first flow).
  const [grammarResult, setGrammarResult] = useState(null);
  // bestJobRolesResult: set when navigating to bestJobRoles page after upload
  const [bestJobRolesResult, setBestJobRolesResult] = useState(null);

  // ── Single source of truth for auth state ─────────────────────────────────
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; }
  });

  const handleLogin = (userData) => {
    setCurrentUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setCurrentUser(null);   // ← triggers immediate navbar re-render
    setPage("home");
  };

  // Navigate to ATSScorePage with analysis data pre-loaded (state b)
  const navigateToAtsScore = (result) => {
    setAtsScoreResult(result || null);
    setPage("atsScore");
  };

  // Navigate to ATSScorePage fresh (state a) — clears any previous ATS result
  const navigateToAtsFresh = () => {
    setAtsScoreResult(null);
    setPage("atsScore");
  };

  // Navigate to GrammarCheckPage with analysis data pre-loaded (state b)
  const navigateToGrammar = (result) => {
    setGrammarResult(result || null);
    setPage("grammarCheck");
  };

  // Navigate to GrammarCheckPage fresh (state a) — clears any previous grammar result
  const navigateToGrammarFresh = () => {
    setGrammarResult(null);
    setPage("grammarCheck");
  };

  // Navigate to BestJobRolesPage fresh — clears any previous result
  const navigateToBestJobRoles = () => {
    setBestJobRolesResult(null);
    setPage("bestJobRolesUpload");
  };

  const t = themes[dark ? "dark" : "light"];
  const canvasRef = useRef(null);

  // Generic handleAnalyse (used by UploadPage → ResultsPage)
  const isAnalyzingRef = useRef(false);

  const handleAnalyse = async ({ file, jd, role }) => {
    if (isAnalyzingRef.current) return;
    isAnalyzingRef.current = true;
    setLoading(true);
    setAnalysisError(null);
    setAnalysisResult(null);

    try {
      const formData = new FormData();
      formData.append("resume", file);
      if (role) formData.append("jobRole", role);
      if (jd) formData.append("jobDescription", jd);

      const token = localStorage.getItem("token");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 900000); // 15 minutes timeout

      try {
        const response = await fetch("http://localhost:5000/api/resume/analyse", {
          method: "POST",
          body: formData,
          signal: controller.signal,
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        const data = await response.json();
        console.log("[handleAnalyse] Backend Response:", data);
        console.log("[handleAnalyse] HTTP status:", response.status, response.ok);

        if (!response.ok) {
          // Backend returned 4xx/5xx — throw so the catch block sets analysisError
          // instead of silently saving { message: "..." } as analysisResult
          throw new Error(data?.message || `Server error (${response.status})`);
        }

        console.log("[handleAnalyse] Saving state: atsScore=%o grammarScore=%o skillMatch=%o overallScore=%o",
          data.atsScore, data.grammarScore, data.skillMatch, data.overallScore);
        setAnalysisFile(file);  
        setAnalysisResult(data);
        setPage("results");
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err) {
      console.error("Resume analysis failed:", err);
      const message =
        err.response?.data?.message ||
        (err.name === "AbortError" || err.code === "ECONNABORTED"
          ? "Request timed out. The AI is taking too long — please try again."
          : err.request
            ? "Cannot reach the server. Make sure the backend is running on http://localhost:5000."
            : err.message || "Something went wrong. Please try again.");
      setAnalysisError(message);
      setPage("results");
    } finally {
      isAnalyzingRef.current = false;
      setLoading(false);
    }
  };

  // Grammar-check specific analyse: run full analysis (2 AI calls), then navigate to GrammarCheckPage.
  // Grammar-analysis (3rd AI call) is intentionally NOT pre-fetched here — GrammarCheckPage's
  // useEffect auto-fetches it lazily on mount when grammarAnalysis is absent. This keeps the
  // upload→navigate flow at 2 AI calls (matching the original 3-5 min performance).
  const handleAnalyseForGrammar = async ({ file, jd, role }) => {
    if (isAnalyzingRef.current) return;
    isAnalyzingRef.current = true;
    setLoading(true);
    setAnalysisError(null);
    try {
      const formData = new FormData();
      formData.append("resume", file);
      if (role) formData.append("jobRole", role);
      if (jd) formData.append("jobDescription", jd);
      const token = localStorage.getItem("token");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 900000); // 15 minutes timeout

      try {
        const response = await fetch("http://localhost:5000/api/resume/analyse", {
          method: "POST",
          body: formData,
          signal: controller.signal,
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        const data = await response.json();
        console.log("[handleAnalyseForGrammar] Backend Response:", data);
        console.log("[handleAnalyseForGrammar] HTTP status:", response.status, response.ok);

        if (!response.ok) {
          throw new Error(data?.message || `Server error (${response.status})`);
        }

        console.log("[handleAnalyseForGrammar] Saving state: atsScore=%o grammarScore=%o skillMatch=%o overallScore=%o",
          data.atsScore, data.grammarScore, data.skillMatch, data.overallScore);
        // Navigate immediately — GrammarCheckPage useEffect will fetch grammar lazily
        setGrammarResult(data);
        setAnalysisResult(data);
        setPage("grammarCheck");
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err) {
      const message = err.response?.data?.message ||
        (err.name === "AbortError" || err.code === "ECONNABORTED" ? "Request timed out. The AI is taking too long — please try again." : err.request ? "Cannot reach server." : err.message || "Something went wrong.");
      setAnalysisError(message);
      setPage("grammarCheck");
      throw new Error(message);
    } finally {
      isAnalyzingRef.current = false;
      setLoading(false);
    }
  };

  // ATS-score specific analyse: run analysis API, then keep the user on the ATS Score page (no full Results view)
  const handleAnalyseForAtsScore = async ({ file, jd, role }) => {
    if (isAnalyzingRef.current) return;
    isAnalyzingRef.current = true;
    setLoading(true);
    setAnalysisError(null);
    // Do NOT clear analysisResult here — if the user later clicks "Back to Full Report"
    // we want the Results page to have data. We will populate it below.

    try {
      const formData = new FormData();
      formData.append("resume", file);
      if (role) formData.append("jobRole", role);
      if (jd) formData.append("jobDescription", jd);

      const token = localStorage.getItem("token");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 900000); // 15 minutes timeout

      try {
        const response = await fetch("http://localhost:5000/api/resume/analyse", {
          method: "POST",
          body: formData,
          signal: controller.signal,
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        const data = await response.json();
        console.log("[handleAnalyseForAtsScore] Backend Response:", data);
        console.log("[handleAnalyseForAtsScore] HTTP status:", response.status, response.ok);

        if (!response.ok) {
          throw new Error(data?.message || `Server error (${response.status})`);
        }

        console.log("[handleAnalyseForAtsScore] Saving state: atsScore=%o grammarScore=%o skillMatch=%o overallScore=%o",
          data.atsScore, data.grammarScore, data.skillMatch, data.overallScore);
        // Store result in BOTH states so:
        // - ATS Score page (passedResult) gets the breakdown
        // - Results page (analysisResult) has data when user clicks "Back to Full Report"
        setAtsScoreResult(data);
        setAnalysisResult(data);
        setPage("atsScore");
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err) {
      console.error("ATS analysis failed:", err);
      const message =
        err.response?.data?.message ||
        (err.name === "AbortError" || err.code === "ECONNABORTED"
          ? "Request timed out. The AI is taking too long — please try again."
          : err.request
            ? "Cannot reach the server. Make sure the backend is running on http://localhost:5000."
            : err.message || "Something went wrong. Please try again.");

      setAnalysisError(message);
      setPage("atsScore");
      throw new Error(message);
    } finally {
      isAnalyzingRef.current = false;
      setLoading(false);
    }
  };

  // Best Job Roles specific analyse: 1 AI call + Adzuna job search — no full analysis pipeline
  // ── Best Job Roles + Real Job Listings ──────────────────────────────────────
const handleAnalyseForBestJobRoles = async ({ file, resumeId }) => {
  if (isAnalyzingRef.current) return;

  isAnalyzingRef.current = true;
  setLoading(true);
  setBestJobRolesResult(null);

  try {
    const formData = new FormData();
    formData.append("resume", file);
    if (resumeId) {
  formData.append("resumeId", resumeId);
}

    const token = localStorage.getItem("token");

    const controller = new AbortController();

    // Allow enough time for:
    // 1. PDF parsing
    // 2. Groq AI role analysis
    // 3. Apify Google Jobs scraping
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 180000); // 3 minutes

    try {
      const response = await fetch(
        "http://localhost:5000/api/resume/best-job-roles",
        {
          method: "POST",
          body: formData,
          signal: controller.signal,
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {},
        }
      );

      // Safely read the response
      const text = await response.text();

      let data;

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(
          `Server returned invalid JSON (${response.status})`
        );
      }

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            `Server error (${response.status})`
        );
      }

      console.log(
        "[BEST JOB ROLES] Server response:",
        data
      );

      // Make sure the expected arrays exist
      const safeResult = {
        ...data,
        recommendedRoles: Array.isArray(data?.recommendedRoles)
          ? data.recommendedRoles
          : [],
        jobsByRole: Array.isArray(data?.jobsByRole)
          ? data.jobsByRole
          : [],
      };

      setBestJobRolesResult(safeResult);
      setPage("bestJobRoles");

    } finally {
      clearTimeout(timeoutId);
    }

  } catch (err) {
    console.error(
      "[BEST JOB ROLES] Request failed:",
      err
    );

    const message =
      err?.name === "AbortError"
        ? "Job search took too long. Please try again."
        : err?.message ||
          "Something went wrong while analysing your resume.";

    setBestJobRolesResult({
      error: message,
      recommendedRoles: [],
      jobsByRole: [],
    });

    setPage("bestJobRoles");

  } finally {
    isAnalyzingRef.current = false;
    setLoading(false);
  }
};

  // ── Full-page particle system (180 stars, multi-directional, edge-wrapping) ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Jest/jsdom doesn't provide canvas 2d context.
    const ctx = canvas.getContext("2d");
    if (!ctx || typeof ctx.setTransform !== 'function') return;

    let animId;
    let w, h;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const PARTICLE_COUNT = 180;
    const createParticle = () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.15 + Math.random() * 0.6;
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.5 + Math.random() * 1.75,
        speedX: Math.cos(angle) * speed,
        speedY: Math.sin(angle) * speed,
        opacity: 0.2 + Math.random() * 0.6,
        isGreen: Math.random() > 0.55,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 0.006 + Math.random() * 0.014,
      };
    };
    const particles = Array.from({ length: PARTICLE_COUNT }, createParticle);

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";

      for (const p of particles) {
        p.x += p.speedX;
        p.y += p.speedY;
        p.pulse += p.pulseSpeed;

        // Edge wrapping
        if (p.x < -4) p.x = w + 4;
        else if (p.x > w + 4) p.x = -4;
        if (p.y < -4) p.y = h + 4;
        else if (p.y > h + 4) p.y = -4;

        const twinkle = 0.7 + 0.3 * Math.sin(p.pulse);
        const alpha = p.opacity * twinkle;

        // Soft glow
        const glowRadius = p.r * 3.5;
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowRadius);
        if (p.isGreen) {
          gradient.addColorStop(0, `rgba(110,231,183,${alpha * 0.8})`);
          gradient.addColorStop(0.4, `rgba(110,231,183,${alpha * 0.2})`);
          gradient.addColorStop(1, `rgba(110,231,183,0)`);
        } else {
          gradient.addColorStop(0, `rgba(255,255,255,${alpha * 0.9})`);
          gradient.addColorStop(0.4, `rgba(255,255,255,${alpha * 0.18})`);
          gradient.addColorStop(1, `rgba(255,255,255,0)`);
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Core dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.isGreen
          ? `rgba(110,231,183,${alpha})`
          : `rgba(255,255,255,${alpha})`;
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div style={{ background: t.bg, minHeight: "100vh", color: t.text, fontFamily: "'DM Sans',sans-serif" }}>
      <FontLink />
      <GlobalStyles t={t} />

      {/* ── Aurora keyframes ── */}
      <style>{`
        @keyframes auroraA {
          0%   { transform: translate(0, 0) scale(1); }
          25%  { transform: translate(80px, -50px) scale(1.12); }
          50%  { transform: translate(-40px, 40px) scale(0.95); }
          75%  { transform: translate(50px, 20px) scale(1.06); }
          100% { transform: translate(0, 0) scale(1); }
        }
        @keyframes auroraB {
          0%   { transform: translate(0, 0) scale(1); }
          25%  { transform: translate(-60px, 60px) scale(1.1); }
          50%  { transform: translate(50px, -30px) scale(0.9); }
          75%  { transform: translate(-30px, -20px) scale(1.08); }
          100% { transform: translate(0, 0) scale(1); }
        }
        @keyframes auroraC {
          0%   { transform: translate(0, 0) scale(1); }
          25%  { transform: translate(40px, 50px) scale(1.07); }
          50%  { transform: translate(-70px, -40px) scale(0.93); }
          75%  { transform: translate(20px, -30px) scale(1.04); }
          100% { transform: translate(0, 0) scale(1); }
        }
      `}</style>

      {/* ── Aurora blobs (fixed behind everything) ── */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
        <div style={{
          position: "absolute", width: 550, height: 550, borderRadius: "50%",
          background: "radial-gradient(circle, #6ee7b7 0%, rgba(110,231,183,0.4) 50%, transparent 70%)",
          filter: "blur(120px)", opacity: 0.18,
          top: "2%", left: "10%",
          animation: "auroraA 16s ease-in-out infinite",
          willChange: "transform",
        }} />
        <div style={{
          position: "absolute", width: 500, height: 500, borderRadius: "50%",
          background: "radial-gradient(circle, #a78bfa 0%, rgba(167,139,250,0.4) 50%, transparent 70%)",
          filter: "blur(120px)", opacity: 0.16,
          top: "25%", right: "5%",
          animation: "auroraB 20s ease-in-out infinite",
          willChange: "transform",
        }} />
        <div style={{
          position: "absolute", width: 480, height: 480, borderRadius: "50%",
          background: "radial-gradient(circle, #60a5fa 0%, rgba(96,165,250,0.4) 50%, transparent 70%)",
          filter: "blur(120px)", opacity: 0.15,
          bottom: "5%", left: "35%",
          animation: "auroraC 18s ease-in-out infinite",
          willChange: "transform",
        }} />
      </div>

      {/* ── Particle canvas (fixed, full viewport) ── */}
      <canvas
        ref={canvasRef}
        style={{
          position: "fixed", top: 0, left: 0,
          width: "100vw", height: "100vh",
          pointerEvents: "none", zIndex: 0,
        }}
      />

      {/* ── All page content above canvas ── */}
      <div style={{ position: "relative", zIndex: 1 }}>
        {!loading && <Navbar t={t} dark={dark} setDark={setDark} page={page} onNavigate={(p) => {
          if (p === "atsScore") navigateToAtsFresh();
          else if (p === "grammarCheck") navigateToGrammarFresh();
          else setPage(p);
        }} user={currentUser} onLogout={handleLogout} />}
        {loading ? <LoadingScreen t={t} /> :
          page === "home"     ? <LandingPage t={t} onNavigate={(p) => {
            if (p === "atsScore")      navigateToAtsFresh();
            else if (p === "grammarCheck")   navigateToGrammarFresh();
            else if (p === "bestJobRoles")   navigateToBestJobRoles();
            else setPage(p);
          }} /> :
          (page === "upload" || page === "bestJobRolesUpload") ? <UploadPage
            t={t}
            mode={page === "bestJobRolesUpload" ? "bestJobRoles" : undefined}
            onAnalyse={page === "bestJobRolesUpload" ? handleAnalyseForBestJobRoles : handleAnalyse}
            onNavigate={setPage}
          /> :
          page === "results" ? <ResultsPage
  t={t}
  onNavigate={(p) => {
    if (p === "atsScore") navigateToAtsScore(analysisResult);
    else if (p === "grammarCheck") navigateToGrammar(analysisResult);
    else setPage(p);
  }}
  onBestJobRoles={() => {
    if (analysisFile) {
      handleAnalyseForBestJobRoles({ file: analysisFile, resumeId: analysisResult?._id, });
    } else {
      setPage("bestJobRolesUpload");
    }
  }}
  result={analysisResult}
  error={analysisError}
/> :
          page === "atsScore" ? <ATSScorePage t={t} onNavigate={(p) => {
            if (p === "results") {
              if (!analysisResult && atsScoreResult) setAnalysisResult(atsScoreResult);
              setPage("results");
            } else if (p === "atsScore") navigateToAtsFresh();
            else setPage(p);
          }} onAnalyse={handleAnalyseForAtsScore} passedResult={atsScoreResult} /> :
          page === "grammarCheck" ? <GrammarCheckPage t={t} onNavigate={(p) => {
            if (p === "results") {
              // Sync analysisResult with the latest grammarResult (which may now have
              // grammarAnalysis + authoritative grammarScore set by setPassedGrammarResult)
              if (grammarResult) {
                setAnalysisResult(prev => {
                  if (!prev) return grammarResult;
                  // Merge the grammar fields and synchronized overallScore into analysisResult
                  const merged = { ...prev };
                  if (grammarResult.grammarAnalysis) merged.grammarAnalysis = grammarResult.grammarAnalysis;
                  if (grammarResult.grammarScore !== undefined) merged.grammarScore = grammarResult.grammarScore;
                  if (grammarResult.overallScore !== undefined) merged.overallScore = grammarResult.overallScore;
                  return merged;
                });
              }
              setPage("results");
            } else if (p === "grammarCheck") navigateToGrammarFresh();
            else setPage(p);
          }} onAnalyse={handleAnalyseForGrammar} passedResult={grammarResult}
            setPassedGrammarResult={(ga) => {
              // When the page fetches grammar on-demand, sync the authoritative score and updated overallScore back into
              // both result states so the Full Report cards always show real synchronized scores.
              const grammarScore = ga?.grammarScore ?? undefined;
              const overallScore = ga?.overallScore ?? undefined;
              setGrammarResult(prev => prev ? { 
                ...prev, 
                grammarAnalysis: ga, 
                ...(grammarScore !== undefined ? { grammarScore } : {}),
                ...(overallScore !== undefined ? { overallScore } : {}) 
              } : prev);
              setAnalysisResult(prev => prev ? { 
                ...prev, 
                grammarAnalysis: ga, 
                ...(grammarScore !== undefined ? { grammarScore } : {}),
                ...(overallScore !== undefined ? { overallScore } : {}) 
              } : prev);
            }} /> :
          page === "history"  ? <HistoryPage t={t} onNavigate={setPage} setAnalysisResult={setAnalysisResult} /> :
          page === "bestJobRoles" ? <BestJobRolesPage t={t} result={bestJobRolesResult} onNavigate={(p) => {
            if (p === "bestJobRolesUpload") navigateToBestJobRoles();
            else if (p === "upload") setPage("upload");
            else setPage(p);
          }} /> :
          (page === "login" || page === "signup") ? <AuthPage t={t} mode={page} onNavigate={setPage} onLogin={handleLogin} /> :
          <LandingPage t={t} onNavigate={setPage} />
        }
      </div>
    </div>
  );
}
