"use client";
// @ts-nocheck
/* eslint-disable */
const INLINE_STYLE = <T,>(o: T): T => o;
/* eslint-disable react/no-inline-styles */


import { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from "recharts";

// ── Sample data ──────────────────────────────────────────────────────────────
const WEEKLY_DATA = [
  { week: "W1", topicsLearned: 4 },
  { week: "W2", topicsLearned: 7 },
  { week: "W3", topicsLearned: 5 },
  { week: "W4", topicsLearned: 11 },
  { week: "W5", topicsLearned: 9 },
  { week: "W6", topicsLearned: 14 },
  { week: "W7", topicsLearned: 12 },
];

const RETENTION_SCORE = 73;
const TOPICS_MASTERED = 39;
const TOPICS_DELTA    = 4;
const VELOCITY_PCT    = 50;
const VELOCITY_TREND  = "Increasing";

const HEATMAP_DATA = [
  { subject: "Mathematics", unit: "Unit 1", weaknessIntensity: 1, topics: ["Fractions", "Decimals"] },
  { subject: "Mathematics", unit: "Unit 2", weaknessIntensity: 3, topics: ["Quadratic Equations", "Polynomials", "Factoring"] },
  { subject: "Mathematics", unit: "Unit 3", weaknessIntensity: 0, topics: [] },
  { subject: "Physics",     unit: "Unit 1", weaknessIntensity: 2, topics: ["Newton's Laws", "Momentum"] },
  { subject: "Physics",     unit: "Unit 2", weaknessIntensity: 0, topics: [] },
  { subject: "Physics",     unit: "Unit 3", weaknessIntensity: 3, topics: ["Wave Interference", "Diffraction", "Polarization"] },
  { subject: "Chemistry",   unit: "Unit 1", weaknessIntensity: 0, topics: [] },
  { subject: "Chemistry",   unit: "Unit 2", weaknessIntensity: 1, topics: ["Equilibrium Constants"] },
  { subject: "Chemistry",   unit: "Unit 3", weaknessIntensity: 2, topics: ["Redox Reactions", "Electrochemistry"] },
  { subject: "Biology",     unit: "Unit 1", weaknessIntensity: 3, topics: ["Meiosis", "Crossing Over", "Genetic Linkage"] },
  { subject: "Biology",     unit: "Unit 2", weaknessIntensity: 1, topics: ["Enzyme Kinetics"] },
  { subject: "Biology",     unit: "Unit 3", weaknessIntensity: 0, topics: [] },
];

// ── Static config ────────────────────────────────────────────────────────────
const SUBJECT_EMOJI: Record<string,string> = { Mathematics: "📐", Physics: "⚡️", Chemistry: "🧪", Biology: "🧬" };

interface IntensityConfig { bg: string; border: string; text: string; label: string; }
const INTENSITY: Record<number,IntensityConfig> = {
  0: { bg: "#F8FAFC", border: "#E2E8F0", text: "#CBD5E1", label: "" },
  1: { bg: "#FFFBEB", border: "#FCD34D", text: "#B45309", label: "Low" },
  2: { bg: "#FFF7ED", border: "#FB923C", text: "#C2410C", label: "Mid" },
  3: { bg: "#FEF2F2", border: "#F87171", text: "#B91C1C", label: "High" },
};

// ── Stat card icon components (inline SVGs — no lucide dep needed in preview) ─
interface SVGIconProps { color: string; }
const IconBookOpen: React.FC<SVGIconProps> = ({ color }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
  </svg>
);
const IconBrain: React.FC<SVGIconProps> = ({ color }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5a3 3 0 1 0-5.993.142 4 4 0 0 0-2.867 3.518 4 4 0 0 0 1.018 3.055A4 4 0 1 0 12 18.93"/>
    <path d="M12 5a3 3 0 1 1 5.993.142 4 4 0 0 1 2.867 3.518 4 4 0 0 1-1.018 3.055A4 4 0 1 1 12 18.93"/>
  </svg>
);
const IconActivity: React.FC<SVGIconProps> = ({ color }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);

// ── Sub-components ───────────────────────────────────────────────────────────
interface ChartTooltipProps { active?: boolean; payload?: any[]; label?: string; }
function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: "10px 14px", boxShadow: "0 4px 16px rgba(0,0,0,0.1)" }}>
      <p style={{ margin: 0, fontSize: 12, color: "#94A3B8", fontWeight: 600 }}>{label}</p>
      <p style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 700, color: "#1E293B" }}>
        {payload[0].value} <span style={{ fontSize: 12, color: "#94A3B8", fontWeight: 400 }}>topics</span>
      </p>
    </div>
  );
}

interface ArcGaugeProps { score: number; color: string; }
function ArcGauge({ score, color }: ArcGaugeProps) {
  const pct      = Math.min(Math.max(score / 100, 0.001), 0.999);
  const angle    = Math.PI * pct;
  const cx = 100, cy = 90, r = 72;
  const endX     = cx - r * Math.cos(angle);
  const endY     = cy - r * Math.sin(angle);
  const largeArc = pct > 0.5 ? 1 : 0;
  return (
    <svg viewBox="0 0 200 96" width="100%" style={{ display: "block", maxWidth: 240, margin: "0 auto" }}>
      <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`} fill="none" stroke="#EEF2FF" strokeWidth="14" strokeLinecap="round"/>
      <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 ${largeArc} 1 ${endX.toFixed(2)} ${endY.toFixed(2)}`} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"/>
      <circle cx={endX} cy={endY} r="5" fill={color}/>
      <text x={cx-r-4} y={cy+14} fontSize="9" fill="#CBD5E1" textAnchor="middle">0</text>
      <text x={cx+r+4} y={cy+14} fontSize="9" fill="#CBD5E1" textAnchor="middle">100</text>
    </svg>
  );
}

// ── Card style helper ────────────────────────────────────────────────────────
const card = (visible: boolean, delay: number, extra: React.CSSProperties = {}): React.CSSProperties => ({
  opacity:    visible ? 1 : 0,
  transform:  visible ? "translateY(0)" : "translateY(14px)",
  transition: `opacity 0.45s ease ${delay}s, transform 0.45s ease ${delay}s`,
  background: "#fff",
  borderRadius: 16,
  border:     "1px solid #E2E8F0",
  padding:    "22px 20px",
  boxShadow:  "0 1px 6px rgba(0,0,0,.04)",
  ...extra,
});

interface WeeklyDatum {
  week: string;
  topicsLearned: number;
}

interface HeatmapDatum {
  subject: string;
  unit: string;
  weaknessIntensity: number;
  topics: string[];
}

interface DashboardChartsProps {
  weeklyData?: WeeklyDatum[];
  retentionScore?: number;
  heatmapData?: HeatmapDatum[];
  topicsMastered?: number;
  topicsDelta?: number;
  velocityPct?: number;
  velocityTrend?: string;
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function DashboardPreview({
  weeklyData,
  retentionScore,
  heatmapData,
  topicsMastered,
  topicsDelta,
  velocityPct,
  velocityTrend,
}: DashboardChartsProps) {
  const [tooltip,   setTooltip]   = useState<string | null>(null);
  const [animScore, setAnimScore] = useState<number>(0);
  const [visible,   setVisible]   = useState<boolean>(false);

  const resolvedWeeklyData =
    Array.isArray(weeklyData) && weeklyData.length > 0 ? weeklyData : WEEKLY_DATA;
  const resolvedRetentionScore =
    typeof retentionScore === "number" ? retentionScore : RETENTION_SCORE;
  const resolvedHeatmapData =
    Array.isArray(heatmapData) && heatmapData.length > 0 ? heatmapData : HEATMAP_DATA;
  const resolvedTopicsMastered =
    typeof topicsMastered === "number" ? topicsMastered : TOPICS_MASTERED;
  const resolvedTopicsDelta =
    typeof topicsDelta === "number" ? topicsDelta : TOPICS_DELTA;
  const resolvedVelocityPct =
    typeof velocityPct === "number" ? velocityPct : VELOCITY_PCT;
  const resolvedVelocityTrend =
    typeof velocityTrend === "string" && velocityTrend.trim().length > 0
      ? velocityTrend
      : VELOCITY_TREND;

  useEffect(() => {
    setTimeout(() => setVisible(true), 80);
    let start: number | null = null;
    const animate = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - (start as number)) / 1200, 1);
      setAnimScore(Math.round((1 - Math.pow(1 - p, 3)) * resolvedRetentionScore));
      if (p < 1) requestAnimationFrame(animate);
    };
    setTimeout(() => requestAnimationFrame(animate), 300);
  }, [resolvedRetentionScore]);

  const gaugeColor = resolvedRetentionScore >= 80 ? "#22C55E" : resolvedRetentionScore >= 50 ? "#F59E0B" : "#EF4444";
  const gaugeBg    = resolvedRetentionScore >= 80 ? "#F0FDF4" : resolvedRetentionScore >= 50 ? "#FFFBEB" : "#FEF2F2";
  const gaugeLabel = resolvedRetentionScore >= 80 ? "Excellent" : resolvedRetentionScore >= 50 ? "Good" : "Needs Work";

  const subjects = [...new Set(resolvedHeatmapData.map(d => d.subject))].sort();
  // `subject` is a string, use typed lookup below
  const units    = [...new Set(resolvedHeatmapData.map(d => d.unit))].sort();

  const statCards = [
    {
      Icon: IconBookOpen, iconColor: "#6366F1", iconBg: "#EEF2FF",
      eyebrow: "All time",       eyebrowColor: "#94A3B8",
      label: "Topics Mastered",  value: String(resolvedTopicsMastered), valueColor: "#0F172A",
      badge: `++${resolvedTopicsDelta}`, badgeColor: "#16A34A", badgeBg: "#F0FDF4", badgeBorder: "#BBF7D0",
    },
    {
      Icon: IconBrain, iconColor: "#22C55E", iconBg: "#F0FDF4",
      eyebrow: "Current",              eyebrowColor: "#94A3B8",
      label: "Knowledge Retention",    value: `${resolvedRetentionScore}%`, valueColor: gaugeColor,
      badge: "Health",  badgeColor: "#0369A1", badgeBg: "#F0F9FF", badgeBorder: "#BAE6FD",
    },
    {
      Icon: IconActivity, iconColor: "#3B82F6", iconBg: "#EFF6FF",
      eyebrow: resolvedVelocityTrend,  eyebrowColor: "#3B82F6",
      label: "Learning Velocity",     value: `+${resolvedVelocityPct}%`, valueColor: "#3B82F6",
      badge: "vs Last Week", badgeColor: "#7C3AED", badgeBg: "#F5F3FF", badgeBorder: "#DDD6FE",
    },
  ];

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans','Segoe UI',sans-serif", background: "#F1F5F9", minHeight: "100vh", padding: "32px 24px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        button:focus { outline: none; }
        @keyframes popIn { from { opacity:0; transform:translateX(-50%) translateY(6px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
      `}</style>

      <div style={{ maxWidth: 960, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ opacity: visible?1:0, transform: visible?"none":"translateY(-8px)", transition: "all 0.4s ease", marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: "linear-gradient(135deg,#6366F1,#4F46E5)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(99,102,241,.3)", flexShrink: 0 }}>
              <IconActivity color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.02em" }}>Study Analytics Dashboard</h1>
              <p style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>Track your learning velocity, memory retention, and knowledge gaps.</p>
            </div>
          </div>
        </div>

        {/* ── Stat Cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 18 }}>
          {statCards.map((s, i) => (
            <div key={i} style={card(visible, 0.05 + i * 0.07, { display: "flex", flexDirection: "column", gap: 16 })}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: s.iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <s.Icon color={s.iconColor} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: s.eyebrowColor, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {s.eyebrow}
                </span>
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
                  {s.label}
                </p>
                <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 40, fontWeight: 800, color: s.valueColor, letterSpacing: "-0.03em", lineHeight: 1 }}>
                    {s.value}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: s.badgeColor, background: s.badgeBg, border: `1px solid ${s.badgeBorder}`, padding: "3px 10px", borderRadius: 20, marginBottom: 4, whiteSpace: "nowrap" }}>
                    {s.badge}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Charts Row ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>

          {/* Learning Velocity */}
          <div style={card(visible, 0.2)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Learning Velocity</h2>
                <p style={{ fontSize: 12, color: "#94A3B8", marginTop: 3 }}>Topics mastered per week</p>
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#6366F1", background: "#EEF2FF", padding: "3px 10px", borderRadius: 20, border: "1px solid #C7D2FE", flexShrink: 0 }}>
                Weekly Trend
              </span>
            </div>
            <div style={{ height: 215 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={resolvedWeeklyData} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                  <defs>
                    <linearGradient id="velGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#6366F1"/><stop offset="100%" stopColor="#8B5CF6"/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#F1F5F9"/>
                  <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#94A3B8" }} dy={8}/>
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#94A3B8" }}/>
                  <RechartsTooltip content={<ChartTooltip />} cursor={{ stroke: "#E2E8F0", strokeWidth: 2 }}/>
                  <Line type="monotone" dataKey="topicsLearned" stroke="url(#velGrad)" strokeWidth={2.5}
                    dot={{ r: 4, fill: "#fff", stroke: "#6366F1", strokeWidth: 2.5 }}
                    activeDot={{ r: 5.5, fill: "#6366F1", stroke: "#EEF2FF", strokeWidth: 3 }}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Retention Score */}
          <div style={card(visible, 0.25, { display: "flex", flexDirection: "column" })}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Retention Score</h2>
                <p style={{ fontSize: 12, color: "#94A3B8", marginTop: 3 }}>Average memory health</p>
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#64748B", background: "#F8FAFC", padding: "3px 10px", borderRadius: 20, border: "1px solid #E2E8F0", flexShrink: 0 }}>
                SM-2 Algorithm
              </span>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 20 }}>
              <ArcGauge score={animScore} color={gaugeColor} />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 52, fontWeight: 800, color: gaugeColor, letterSpacing: "-0.04em", lineHeight: 1 }}>
                  {animScore}<span style={{ fontSize: 26, fontWeight: 700 }}>%</span>
                </div>
                <p style={{ fontSize: 13, color: "#64748B", marginTop: 8, fontWeight: 500 }}>Average Memory Health</p>
                <span style={{ display: "inline-block", marginTop: 10, fontSize: 12, fontWeight: 700, color: gaugeColor, background: gaugeBg, padding: "4px 16px", borderRadius: 20 }}>
                  {gaugeLabel}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Weakness Heatmap ── */}
        <div style={card(visible, 0.35)}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Weakness Heatmap</h2>
              <p style={{ fontSize: 12, color: "#94A3B8", marginTop: 3 }}>Identified knowledge gaps based on chat interactions and quizzes.</p>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              {[["#F8FAFC","#E2E8F0","#94A3B8","Good"],["#FFFBEB","#FCD34D","#B45309","Review"],["#FEF2F2","#F87171","#B91C1C","Critical"]].map(([bg,bdr,txt,lbl]) => (
                <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: bg, border: `1.5px solid ${bdr}` }}/>
                  <span style={{ fontSize: 11, fontWeight: 600, color: txt }}>{lbl}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 520 }}>
              {/* Column headers */}
              <div style={{ display: "grid", gridTemplateColumns: `160px repeat(${units.length},1fr)`, gap: 8, marginBottom: 8 }}>
                <div/>
                {units.map(u => (
                  <div key={u} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.07em" }}>{u}</div>
                ))}
              </div>

              {/* Subject rows */}
              {subjects.map((subject, si) => (
                <div key={subject} style={{
                  display: "grid", gridTemplateColumns: `160px repeat(${units.length},1fr)`, gap: 8, marginBottom: 8,
                  opacity: visible?1:0, transform: visible?"none":"translateY(8px)",
                  transition: `opacity 0.4s ease ${0.4 + si*0.07}s, transform 0.4s ease ${0.4 + si*0.07}s`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: "#F8FAFC", border: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>
                      {(SUBJECT_EMOJI as Record<string,string>)[subject] ?? "📖"}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>{subject}</span>
                  </div>

                  {units.map(unit => {
                    const dp        = resolvedHeatmapData.find(d => d.subject === subject && d.unit === unit);
                    const intensity = dp?.weaknessIntensity ?? 0;
                    const topics    = dp?.topics ?? [];
                    const cfg       = INTENSITY[intensity as number];
                    const cellId    = `${subject}-${unit}`;
                    const hovered   = tooltip === cellId;
                    return (
                      <div key={cellId} style={{ position: "relative", aspectRatio: "1" }}
                        onMouseEnter={() => intensity > 0 && setTooltip(cellId)}
                        onMouseLeave={() => setTooltip(null)}>
                        <button disabled={intensity === 0} style={{
                          width: "100%", height: "100%", borderRadius: 10,
                          background: hovered ? cfg.border + "28" : cfg.bg,
                          border: `1.5px solid ${cfg.border}`,
                          cursor: intensity > 0 ? "pointer" : "default",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexDirection: "column", gap: 2,
                          transition: "all 0.18s ease",
                          transform: hovered ? "scale(1.09)" : "scale(1)",
                          boxShadow: hovered ? `0 4px 14px ${cfg.border}55` : "none",
                        }}>
                          {intensity > 0 && (
                            <>
                              <span style={{ fontSize: 15, fontWeight: 800, color: cfg.text, lineHeight: 1 }}>{intensity}</span>
                              <span style={{ fontSize: 9, fontWeight: 700, color: cfg.text, opacity: 0.7, letterSpacing: "0.05em", textTransform: "uppercase" }}>{cfg.label}</span>
                            </>
                          )}
                        </button>

                        {hovered && topics.length > 0 && (
                          <div style={{
                            position: "absolute", bottom: "calc(100% + 10px)", left: "50%",
                            transform: "translateX(-50%)",
                            background: "#0F172A", borderRadius: 12, padding: "13px 15px",
                            width: 205, zIndex: 99, pointerEvents: "none",
                            boxShadow: "0 12px 40px rgba(0,0,0,.25)",
                            animation: "popIn 0.15s ease",
                          }}>
                            <p style={{ fontSize: 11, fontWeight: 700, color: "#F1F5F9", paddingBottom: 8, marginBottom: 8, borderBottom: "1px solid rgba(255,255,255,.08)" }}>
                              Needs Improvement
                            </p>
                            {topics.map((t, i) => (
                              <div key={i} style={{ display: "flex", gap: 7, marginBottom: i < topics.length-1 ? 6 : 0, alignItems: "flex-start" }}>
                                <span style={{ color: "#818CF8", fontSize: 10, marginTop: 2.5, flexShrink: 0 }}>◆</span>
                                <span style={{ fontSize: 12, color: "#CBD5E1", lineHeight: 1.45 }}>{t}</span>
                              </div>
                            ))}
                            <p style={{ fontSize: 10, color: "#475569", marginTop: 10, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,.07)", textAlign: "center", fontStyle: "italic" }}>
                              Click to review with AI Copilot
                            </p>
                            <div style={{ position: "absolute", bottom: -5, left: "50%", transform: "translateX(-50%) rotate(45deg)", width: 9, height: 9, background: "#0F172A" }}/>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}