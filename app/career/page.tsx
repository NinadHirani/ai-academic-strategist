"use client";

import { useState, useEffect } from "react";

// ── Icons ────────────────────────────────────────────────────────────────────
const IconBriefcase  = ({ color = "#6366F1", size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="12.01"/>
  </svg>
);
const IconTarget     = ({ color = "#6366F1", size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
  </svg>
);
const IconArrowRight = ({ color = "#fff", size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
);
const IconCheck      = ({ color = "#22C55E", size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/>
  </svg>
);
const IconCircle     = ({ color = "#F97316", size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
  </svg>
);
const IconZap        = ({ color = "#6366F1", size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);

// ── Sample data ──────────────────────────────────────────────────────────────
const ROLES = [
  "Frontend Engineer",
  "Data Scientist",
  "Product Manager",
  "Backend Engineer",
  "ML Engineer",
  "DevOps Engineer",
] as const;

const READINESS_DATA = {
  "Frontend Engineer": {
    percentage: 72,
    matchedSkills: ["HTML & CSS", "JavaScript Fundamentals", "React Basics", "Git & Version Control"],
    missingSkills:  ["TypeScript", "Performance Optimization", "Testing (Jest/Cypress)", "Web Accessibility"],
  },
  "Data Scientist": {
    percentage: 55,
    matchedSkills: ["Python Programming", "Statistics & Probability", "Data Visualization"],
    missingSkills:  ["Machine Learning (sklearn)", "SQL & Databases", "Feature Engineering", "Model Deployment", "Pandas / NumPy advanced"],
  },
  "Product Manager": {
    percentage: 40,
    matchedSkills: ["Communication Skills", "Basic Market Research"],
    missingSkills:  ["Roadmap Planning", "OKR / KPI Frameworks", "User Story Writing", "A/B Testing", "Stakeholder Management"],
  },
  "Backend Engineer": {
    percentage: 85,
    matchedSkills: ["Node.js / Express", "REST API Design", "SQL Databases", "Authentication & JWT", "Docker Basics", "Git"],
    missingSkills:  ["Message Queues (Kafka)", "gRPC"],
  },
  "ML Engineer": {
    percentage: 48,
    matchedSkills: ["Python", "Linear Algebra", "NumPy / Pandas"],
    missingSkills:  ["PyTorch / TensorFlow", "MLOps & CI/CD", "Model Serving", "Distributed Training", "Cloud Platforms"],
  },
  "DevOps Engineer": {
    percentage: 33,
    matchedSkills: ["Linux Basics", "Git"],
    missingSkills:  ["Kubernetes", "CI/CD Pipelines", "Infrastructure as Code", "Monitoring & Alerting", "Cloud (AWS/GCP)", "Networking"],
  },
};

type CareerRole = keyof typeof READINESS_DATA;

// ── Helpers ───────────────────────────────────────────────────────────────────
const card = (extra = {}) => ({
  background: "#fff", borderRadius: 16,
  border: "1px solid #E2E8F0", boxShadow: "0 1px 6px rgba(0,0,0,.04)",
  ...extra,
});

type GaugeColor = {
  stroke: string;
  text: string;
  bg: string;
  border: string;
  glow: string;
};

function getColor(pct: number): GaugeColor {
  if (pct >= 80) return { stroke: "#22C55E", text: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0", glow: "rgba(34,197,94,0.15)" };
  if (pct >= 40) return { stroke: "#6366F1", text: "#4F46E5", bg: "#EEF2FF", border: "#C7D2FE", glow: "rgba(99,102,241,0.15)" };
  return       { stroke: "#F97316", text: "#EA580C", bg: "#FFF7ED", border: "#FED7AA", glow: "rgba(249,115,22,0.15)" };
}

function getLabel(pct: number) {
  if (pct >= 80) return "Job-Ready";
  if (pct >= 60) return "Almost There";
  if (pct >= 40) return "Progressing";
  return "Getting Started";
}

// ── Animated circular progress ────────────────────────────────────────────────
function CircularProgress({ target, color }: { target: number; color: GaugeColor }) {
  const [pct, setPct] = useState(0);
  const r = 45, circ = 2 * Math.PI * r;

  useEffect(() => {
    setPct(0);
    let start: number | null = null;
    const run = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / 900, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setPct(Math.round(ease * target));
      if (p < 1) requestAnimationFrame(run);
    };
    const t = setTimeout(() => requestAnimationFrame(run), 200);
    return () => clearTimeout(t);
  }, [target]);

  const dash = (pct / 100) * circ;

  return (
    <div style={{ position: "relative", width: 180, height: 180, flexShrink: 0 }}>
      {/* Glow */}
      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color.glow, filter: "blur(16px)", transform: "scale(0.85)" }} />
      <svg width="180" height="180" viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
        {/* Track */}
        <circle cx="50" cy="50" r={r} fill="none" stroke="#F1F5F9" strokeWidth="9"/>
        {/* Progress */}
        <circle cx="50" cy="50" r={r} fill="none"
          stroke={color.stroke} strokeWidth="9"
          strokeDasharray={`${dash.toFixed(1)} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.05s linear" }}
        />
      </svg>
      {/* Text */}
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 36, fontWeight: 900, color: color.text, letterSpacing: "-0.04em", lineHeight: 1 }}>{pct}%</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 4 }}>Ready</span>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function CareerPage() {
  const [selectedRole, setSelectedRole] = useState<CareerRole>(ROLES[0]);
  const [visible,      setVisible]      = useState(false);

  useEffect(() => { setTimeout(() => setVisible(true), 80); }, []);

  const readiness = READINESS_DATA[selectedRole];
  const color     = getColor(readiness.percentage);

  const fadeIn = (delay = 0) => ({
    opacity:    visible ? 1 : 0,
    transform:  visible ? "translateY(0)" : "translateY(12px)",
    transition: `opacity 0.45s ease ${delay}s, transform 0.45s ease ${delay}s`,
  });

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans','Segoe UI',sans-serif", background: "#F1F5F9", minHeight: "100vh", padding: "32px 24px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        button:focus { outline: none; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 4px; }
      `}</style>

      <div style={{ maxWidth: 1000, margin: "0 auto" }}>

        {/* ── Header ── */}
        <div style={{ ...fadeIn(0), marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: "linear-gradient(135deg,#6366F1,#4F46E5)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(99,102,241,.3)", flexShrink: 0 }}>
              <IconBriefcase color="#fff" size={20} />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.02em" }}>Career Simulator</h1>
              <p style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>
                See how your coursework aligns with industry roles and generate actionable bridging roadmaps.
              </p>
            </div>
          </div>
        </div>

        {/* ── Body: sidebar + main ── */}
        <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 18, alignItems: "start" }}>

          {/* ── Sidebar ── */}
          <div style={{ ...fadeIn(0.1), display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4, paddingLeft: 4 }}>
              Target Roles
            </span>
            {ROLES.map((role, i) => {
              const isActive = role === selectedRole;
              const rd = READINESS_DATA[role];
              const c  = getColor(rd.percentage);
              return (
                <button key={role} onClick={() => setSelectedRole(role)} style={{
                  textAlign: "left", padding: "10px 12px", borderRadius: 10,
                  border: `1.5px solid ${isActive ? "#C7D2FE" : "#E2E8F0"}`,
                  background: isActive ? "#EEF2FF" : "#fff",
                  cursor: "pointer",
                  opacity: visible ? 1 : 0,
                  transform: visible ? "none" : "translateX(-8px)",
                  transition: `opacity 0.4s ease ${0.1 + i * 0.05}s, transform 0.4s ease ${0.1 + i * 0.05}s, background 0.15s, border-color 0.15s`,
                }}>
                  <span style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? "#4F46E5" : "#334155", display: "block", marginBottom: 5 }}>
                    {role}
                  </span>
                  {/* Mini progress bar */}
                  <div style={{ height: 4, background: "#F1F5F9", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${rd.percentage}%`, background: c.stroke, borderRadius: 99 }} />
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: c.text, marginTop: 4, display: "block" }}>
                    {rd.percentage}% ready
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── Main content ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Readiness card */}
            <div style={{ ...fadeIn(0.2), ...card({ padding: "28px", overflow: "hidden", position: "relative" }) }}>
              {/* Ambient glow */}
              <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: color.glow, filter: "blur(40px)", pointerEvents: "none" }} />

              <div style={{ position: "relative" }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.02em" }}>{selectedRole}</h2>
                <p style={{ fontSize: 12, color: "#94A3B8", marginTop: 3, marginBottom: 24 }}>Your Academic Readiness Score</p>

                {/* Score + skills row */}
                <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
                  {/* Circle */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                    <CircularProgress key={selectedRole} target={readiness.percentage} color={color} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: color.text, background: color.bg, border: `1px solid ${color.border}`, padding: "3px 14px", borderRadius: 20 }}>
                      {getLabel(readiness.percentage)}
                    </span>
                  </div>

                  {/* Skills */}
                  <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, minWidth: 280 }}>
                    {/* Mastered */}
                    <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 12, padding: "16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                        <IconCheck size={16} color="#22C55E" />
                        <span style={{ fontSize: 12, fontWeight: 800, color: "#15803D", textTransform: "uppercase", letterSpacing: "0.07em" }}>Mastered</span>
                      </div>
                      {readiness.matchedSkills.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {readiness.matchedSkills.map(s => (
                            <div key={s} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22C55E", flexShrink: 0 }} />
                              <span style={{ fontSize: 12, color: "#166534", fontWeight: 500 }}>{s}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ fontSize: 12, color: "#86EFAC", fontStyle: "italic" }}>None yet</p>
                      )}
                    </div>

                    {/* Missing */}
                    <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 12, padding: "16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                        <IconCircle size={16} color="#F97316" />
                        <span style={{ fontSize: 12, fontWeight: 800, color: "#C2410C", textTransform: "uppercase", letterSpacing: "0.07em" }}>Missing</span>
                      </div>
                      {readiness.missingSkills.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {readiness.missingSkills.map(s => (
                            <div key={s} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#F97316", flexShrink: 0 }} />
                              <span style={{ fontSize: 12, color: "#9A3412", fontWeight: 500 }}>{s}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <IconZap color="#22C55E" size={14} />
                          <span style={{ fontSize: 12, color: "#16A34A", fontWeight: 700 }}>None! Ready to apply.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bridging roadmap card */}
            {readiness.missingSkills.length > 0 && (
              <div style={{
                ...fadeIn(0.3),
                ...card({ padding: "20px 22px" }),
                borderLeft: "4px solid #6366F1",
                background: "#FAFAFE",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <IconTarget color="#6366F1" size={18} />
                      <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>Bridging Roadmap</h3>
                    </div>
                    <p style={{ fontSize: 12, color: "#64748B", maxWidth: 440, lineHeight: 1.65 }}>
                      Bridge the gap between your current knowledge and the requirements for{" "}
                      <strong style={{ color: "#0F172A" }}>{selectedRole}</strong>.{" "}
                      AI will generate a personalised study plan covering all {readiness.missingSkills.length} missing skills.
                    </p>
                  </div>
                  <button style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "12px 20px", borderRadius: 12, fontSize: 13, fontWeight: 700,
                    background: "linear-gradient(135deg,#6366F1,#4F46E5)",
                    color: "#fff", border: "none", cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(99,102,241,.3)",
                    whiteSpace: "nowrap", flexShrink: 0,
                  }}>
                    Generate Plan <IconArrowRight />
                  </button>
                </div>

                {/* Skill pills */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
                  {readiness.missingSkills.map(s => (
                    <span key={s} style={{ fontSize: 11, fontWeight: 600, color: "#4F46E5", background: "#EEF2FF", border: "1px solid #C7D2FE", padding: "4px 11px", borderRadius: 20 }}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* All-ready state */}
            {readiness.missingSkills.length === 0 && (
              <div style={{
                ...fadeIn(0.3),
                ...card({ padding: "20px 22px" }),
                borderLeft: "4px solid #22C55E",
                background: "#F0FDF4",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <IconZap color="#22C55E" size={18} />
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 800, color: "#15803D" }}>You're job-ready! 🎉</h3>
                    <p style={{ fontSize: 12, color: "#16A34A", marginTop: 2 }}>Your current skillset fully covers the requirements for <strong>{selectedRole}</strong>. Start applying!</p>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}