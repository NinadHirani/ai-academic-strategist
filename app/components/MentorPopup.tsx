"use client";

import { useState, useEffect, useMemo } from "react";
import type { StudyRoadmap } from "@/lib/copilot-types";

type ChatMessageLite = {
  role: "user" | "assistant";
  content: string;
  toolResult?: {
    tool?: string;
    data?: any;
  };
};

interface MentorPopupProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessageLite[];
}

interface MentorContextData {
  performance: {
    retentionScore: number;
    topicsMastered: number;
    weeklyVelocity: number;
    velocityTrend: string;
    weakestTopics: string[];
  };
  tasks: string[];
  coachNote: string;
}

// ── Icons ────────────────────────────────────────────────────────────────────
const IconX = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconBot = ({ size = 18, color = "#6366F1" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="10" rx="2" />
    <circle cx="12" cy="5" r="2" />
    <line x1="12" y1="7" x2="12" y2="11" />
    <line x1="8" y1="15" x2="8.01" y2="15" />
    <line x1="16" y1="15" x2="16.01" y2="15" />
  </svg>
);

const IconCheck = ({ size = 12, color = "#fff" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconMap = ({ size = 14, color = "#6366F1" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
    <line x1="9" y1="3" x2="9" y2="18" />
    <line x1="15" y1="6" x2="15" y2="21" />
  </svg>
);

const IconSpark = ({ size = 14, color = "#F59E0B" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const IconTrend = ({ size = 14, color = "#22C55E" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

function StatCard({
  label,
  value,
  color = "#6366F1",
  bg = "#EEF2FF",
  border = "#C7D2FE",
}: {
  label: string;
  value: string | number;
  color?: string;
  bg?: string;
  border?: string;
}) {
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "10px 12px" }}>
      <p
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: "#94A3B8",
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          marginBottom: 4,
        }}
      >
        {label}
      </p>
      <p style={{ fontSize: 18, fontWeight: 800, color, letterSpacing: "-0.02em", lineHeight: 1 }}>{value}</p>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        {icon}
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: "#0F172A",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function extractCurrentTopic(messages: ChatMessageLite[]): string {
  const latest = [...messages].reverse().find((m) => m.role === "user" && m.content?.trim());
  if (!latest) return "";
  const first = latest.content.replace(/\s+/g, " ").trim().split(/[\n.!?]/)[0];
  return (first || latest.content).replace(/^eli5\s*:?\s*/i, "").slice(0, 80);
}

function extractRoadmapFromMessages(messages: ChatMessageLite[]): StudyRoadmap | null {
  const roadmapMessage = [...messages].reverse().find((m) => {
    return m.role === "assistant" && m.toolResult?.tool === "generate_roadmap" && m.toolResult?.data?.roadmap;
  });

  return (roadmapMessage?.toolResult?.data?.roadmap as StudyRoadmap) || null;
}

export default function MentorPopup({ isOpen, onClose, messages }: MentorPopupProps) {
  const [contextData, setContextData] = useState<MentorContextData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taskState, setTaskState] = useState<Record<number, boolean>>({});
  const [visible, setVisible] = useState(false);
  const [dynamicRoadmap, setDynamicRoadmap] = useState<StudyRoadmap | null>(null);

  const currentTopic = useMemo(() => extractCurrentTopic(messages), [messages]);
  const roadmapFromMessages = useMemo(() => extractRoadmapFromMessages(messages), [messages]);
  const roadmap = roadmapFromMessages || dynamicRoadmap;

  const roadmapTopics = useMemo(() => {
    if (!roadmap) return [] as string[];
    return roadmap.units
      .slice(0, 2)
      .flatMap((unit) => unit.topics.slice(0, 2).map((topic) => `${unit.title}: ${topic.name}`))
      .slice(0, 4);
  }, [roadmap]);

  useEffect(() => {
    if (!isOpen) {
      setVisible(false);
      return;
    }

    const v = setTimeout(() => setVisible(true), 30);
    setLoading(true);
    setError(null);

    let cancelled = false;

    async function loadMentorData() {
      try {
        const res = await fetch(`/api/mentor/context?userId=anonymous&topic=${encodeURIComponent(currentTopic)}`);
        const json = await res.json();

        if (!cancelled) {
          if (res.ok && json?.success) {
            setContextData({
              performance: json.performance,
              tasks: Array.isArray(json.tasks) ? json.tasks : [],
              coachNote: json.coachNote || "",
            });
          } else {
            setError("Unable to load mentor context right now.");
          }
        }

        if (!roadmapFromMessages && currentTopic) {
          const roadmapRes = await fetch("/api/copilot/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: currentTopic }),
          });

          const roadmapJson = await roadmapRes.json();
          if (!cancelled && roadmapRes.ok && roadmapJson?.success && roadmapJson?.roadmap) {
            setDynamicRoadmap(roadmapJson.roadmap as StudyRoadmap);
          }
        }
      } catch {
        if (!cancelled) {
          setError("Mentor data is temporarily unavailable.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadMentorData();

    return () => {
      cancelled = true;
      clearTimeout(v);
    };
  }, [isOpen, currentTopic, roadmapFromMessages]);

  if (!isOpen) return null;

  const retention = contextData?.performance.retentionScore ?? 0;
  const gaugeColor = retention >= 80 ? "#22C55E" : retention >= 50 ? "#F59E0B" : "#EF4444";

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15,23,42,0.25)",
          backdropFilter: "blur(2px)",
          zIndex: 49,
          opacity: visible ? 1 : 0,
          transition: "opacity 0.25s ease",
        }}
      />

      <aside
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 360,
          maxWidth: "calc(100vw - 12px)",
          zIndex: 50,
          background: "#fff",
          borderLeft: "1px solid #E2E8F0",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.1)",
          display: "flex",
          flexDirection: "column",
          fontFamily: "'Plus Jakarta Sans','Segoe UI',sans-serif",
          transform: visible ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s cubic-bezier(0.32,0.72,0,1)",
        }}
      >
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');`}</style>

        <div
          style={{
            padding: "18px 20px",
            borderBottom: "1px solid #F1F5F9",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "#EEF2FF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <IconBot />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>Mentor Assistant</p>
              <p style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>Live guidance from your learning data</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close mentor popup"
            title="Close mentor popup"
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              border: "1px solid #E2E8F0",
              background: "#F8FAFC",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#64748B",
            }}
          >
            <IconX />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          {loading && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                paddingTop: 60,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  border: "3px solid #EEF2FF",
                  borderTopColor: "#6366F1",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              <p style={{ fontSize: 13, color: "#94A3B8", fontWeight: 500 }}>Building your mentor plan...</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {!loading && error && (
            <div
              style={{
                background: "#FEF2F2",
                border: "1px solid #FECACA",
                borderRadius: 10,
                padding: "12px 14px",
                fontSize: 13,
                color: "#DC2626",
              }}
            >
              {error}
            </div>
          )}

          {!loading && contextData && (
            <>
              <Section icon={<IconTrend />} title="Performance Snapshot">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                  <StatCard
                    label="Retention"
                    value={`${contextData.performance.retentionScore}%`}
                    color={gaugeColor}
                    bg={gaugeColor === "#22C55E" ? "#F0FDF4" : gaugeColor === "#F59E0B" ? "#FFFBEB" : "#FEF2F2"}
                    border={gaugeColor === "#22C55E" ? "#BBF7D0" : gaugeColor === "#F59E0B" ? "#FDE68A" : "#FECACA"}
                  />
                  <StatCard label="Topics Mastered" value={contextData.performance.topicsMastered} />
                  <StatCard
                    label="Weekly Velocity"
                    value={`${contextData.performance.weeklyVelocity} topics`}
                    color="#F59E0B"
                    bg="#FFFBEB"
                    border="#FDE68A"
                  />
                  <StatCard
                    label="Trend"
                    value={contextData.performance.velocityTrend}
                    color="#22C55E"
                    bg="#F0FDF4"
                    border="#BBF7D0"
                  />
                </div>
                <div style={{ background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ marginTop: 1, flexShrink: 0 }}>
                      <IconSpark />
                    </div>
                    <p style={{ fontSize: 12, color: "#5B21B6", lineHeight: 1.65 }}>{contextData.coachNote}</p>
                  </div>
                </div>
              </Section>

              <div style={{ height: 1, background: "#F1F5F9", margin: "4px 0 20px" }} />

              <Section icon={<IconBot size={14} color="#6366F1" />} title="Current Topic">
                <div
                  style={{
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    borderRadius: 10,
                    padding: "10px 14px",
                    fontSize: 13,
                    fontWeight: 600,
                    color: currentTopic ? "#334155" : "#CBD5E1",
                    fontStyle: currentTopic ? "normal" : "italic",
                  }}
                >
                  {currentTopic || "No active topic yet - start chatting!"}
                </div>
              </Section>

              <div style={{ height: 1, background: "#F1F5F9", margin: "4px 0 20px" }} />

              <Section icon={<IconCheck size={14} color="#6366F1" />} title="Suggested Tasks">
                {contextData.tasks.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {contextData.tasks.map((task, i) => {
                      const done = Boolean(taskState[i]);
                      return (
                        <div
                          key={task}
                          onClick={() => setTaskState((s) => ({ ...s, [i]: !s[i] }))}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 12px",
                            background: done ? "#F0FDF4" : "#F8FAFC",
                            border: `1px solid ${done ? "#BBF7D0" : "#E2E8F0"}`,
                            borderRadius: 10,
                            cursor: "pointer",
                            transition: "all 0.18s ease",
                          }}
                        >
                          <div
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: 6,
                              flexShrink: 0,
                              background: done ? "#22C55E" : "#fff",
                              border: `2px solid ${done ? "#22C55E" : "#CBD5E1"}`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transition: "all 0.18s ease",
                            }}
                          >
                            {done && <IconCheck />}
                          </div>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 500,
                              color: done ? "#16A34A" : "#334155",
                              textDecoration: done ? "line-through" : "none",
                              lineHeight: 1.4,
                              flex: 1,
                              transition: "all 0.18s",
                            }}
                          >
                            {task}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: "#CBD5E1", fontStyle: "italic" }}>No tasks generated yet.</p>
                )}
              </Section>

              <div style={{ height: 1, background: "#F1F5F9", margin: "4px 0 20px" }} />

              <Section icon={<IconMap />} title="Roadmap Focus">
                {roadmapTopics.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {roadmapTopics.map((topic, i) => (
                      <div
                        key={topic}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "9px 12px",
                          background: "#F8FAFC",
                          border: "1px solid #E2E8F0",
                          borderRadius: 10,
                        }}
                      >
                        <div
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 6,
                            background: "#EEF2FF",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            fontSize: 10,
                            fontWeight: 800,
                            color: "#6366F1",
                          }}
                        >
                          {i + 1}
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 500, color: "#334155", lineHeight: 1.4 }}>{topic}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      background: "#F8FAFC",
                      border: "1px dashed #E2E8F0",
                      borderRadius: 10,
                      padding: "14px",
                      textAlign: "center",
                    }}
                  >
                    <p style={{ fontSize: 12, color: "#94A3B8", lineHeight: 1.65 }}>
                      Ask for a roadmap in chat - e.g. <em style={{ color: "#6366F1" }}>&quot;build roadmap for DBMS&quot;</em> - to get guided milestones here.
                    </p>
                  </div>
                )}
              </Section>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
