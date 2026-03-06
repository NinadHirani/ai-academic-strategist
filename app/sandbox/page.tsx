"use client";

import { useEffect, useState } from "react";
import type { ChangeEvent, InputHTMLAttributes, ReactNode } from "react";
import type { SandboxStudyMode } from "@/lib/types";

// ── Icons ────────────────────────────────────────────────────────────────────
const IconTarget  = ({ color = "#6366F1", size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
  </svg>
);
const IconDice    = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="3"/>
    <circle cx="8"  cy="8"  r="1.2" fill="currentColor"/><circle cx="16" cy="8"  r="1.2" fill="currentColor"/>
    <circle cx="8"  cy="16" r="1.2" fill="currentColor"/><circle cx="16" cy="16" r="1.2" fill="currentColor"/>
    <circle cx="12" cy="12" r="1.2" fill="currentColor"/>
  </svg>
);
const IconCopy    = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);
const IconStar    = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);
const IconEdit    = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const IconCheck   = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

// ── Data ─────────────────────────────────────────────────────────────────────
const MODES: Array<{ value: SandboxStudyMode; label: string }> = [
  { value: "concept-refresh",  label: "Concept Refresh" },
  { value: "formula-drill",    label: "Formula Drill" },
  { value: "past-paper",       label: "Past-Paper Style" },
  { value: "flashcards",       label: "Flashcards" },
  { value: "mistake-fix",      label: "Common Mistakes" },
  { value: "compare-contrast", label: "Compare & Contrast" },
  { value: "case-study",       label: "Case Study" },
  { value: "step-by-step",     label: "Step-by-Step Solution" },
];

const MODE_TIPS = {
  "concept-refresh":  "Summarize key concepts in a concise way.",
  "formula-drill":    "Focus on formulas and provide worked examples.",
  "past-paper":       "Create exam-style questions and answers.",
  "flashcards":       "Generate Q&A pairs for quick review.",
  "mistake-fix":      "List common mistakes and how to fix them.",
  "compare-contrast": "Highlight similarities and differences with examples.",
  "case-study":       "Analyze a scenario and give recommendations.",
  "step-by-step":     "Break down the solution into clear steps.",
};

const MODE_TEXT = {
  "concept-refresh":  "Give a concise concept refresh",
  "formula-drill":    "Drill formulas with 2 worked examples",
  "past-paper":       "Generate 2 past-paper style questions with answers",
  "flashcards":       "Create 6 flashcards",
  "mistake-fix":      "List common mistakes and fixes",
  "compare-contrast": "Compare and contrast two concepts with examples",
  "case-study":       "Analyze a case study and provide recommendations",
  "step-by-step":     "Give a step-by-step solution to a problem",
};

type ConstraintsState = {
  bullets: boolean;
  sentences: number;
  hints: boolean;
  rubric: boolean;
};

type AnswerFormat = "paragraph" | "list" | "table" | "diagram";
type Difficulty = "easy" | "medium" | "hard";
type RecapStyle = "one-line" | "summary" | "none";

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildPrompt(
  mode: SandboxStudyMode,
  topic: string,
  constraints: ConstraintsState,
  custom: string,
  format: AnswerFormat,
  difficulty: Difficulty,
  examples: boolean,
  refs: boolean,
  followUp: number,
  recap: RecapStyle
) {
  const t = topic?.trim() || "[insert your topic]";
  const parts = [`${MODE_TEXT[mode] || "Explain"} for ${t}.`];
  if (custom?.trim())   parts.push(`Instructions: ${custom.trim()}`);
  parts.push(`Format: ${format || "paragraph"}. Difficulty: ${difficulty || "medium"}.`);
  if (examples)         parts.push("Include relevant examples.");
  if (refs)             parts.push("Include references where possible.");
  parts.push(`Limit to ${constraints.sentences} sentences${constraints.bullets ? ", bullet-only" : ""}.`);
  if (constraints.hints)  parts.push("Reveal hints first, then full answer.");
  if (constraints.rubric) parts.push("Provide a brief rubric-style critique (clarity, correctness, conciseness).");
  if (recap !== "none")   parts.push(`End with a ${recap === "one-line" ? "one-line recap" : "summary recap"}.`);
  if (followUp > 0)       parts.push(`Add ${followUp} follow-up question${followUp > 1 ? "s" : ""}.`);
  return parts.join(" ");
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const card = (extra = {}) => ({
  background: "#fff", borderRadius: 16,
  border: "1px solid #E2E8F0", boxShadow: "0 1px 6px rgba(0,0,0,.04)",
  ...extra,
});

const inputStyle = {
  width: "100%", padding: "9px 12px",
  background: "#F8FAFC", border: "1px solid #E2E8F0",
  borderRadius: 10, fontSize: 13, color: "#334155",
  fontFamily: "inherit", outline: "none",
  transition: "border-color 0.15s",
};

const labelStyle = { fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5, display: "block" };

const pillBtn = (active: boolean, colors: { bg: string; border: string; text: string }) => ({
  padding: "7px 16px", borderRadius: 20, fontSize: 12, fontWeight: 700,
  border: `1.5px solid ${active ? colors.border : "#E2E8F0"}`,
  background: active ? colors.bg : "#fff",
  color: active ? colors.text : "#94A3B8",
  cursor: "pointer", transition: "all 0.15s ease",
});

// ── Field components ──────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </div>
  );
}

function Select<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}
        style={inputStyle}
        onFocus={e => e.target.style.borderColor = "#C7D2FE"}
        onBlur={e => e.target.style.borderColor = "#E2E8F0"}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  );
}

function Input({ label, ...props }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label}>
      <input {...props} style={inputStyle}
        onFocus={e => e.target.style.borderColor = "#C7D2FE"}
        onBlur={e => e.target.style.borderColor = "#E2E8F0"} />
    </Field>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
      <div style={{ position: "relative", width: 36, height: 20, flexShrink: 0 }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: 99, background: checked ? "#6366F1" : "#E2E8F0", transition: "background 0.2s" }} />
        <div style={{ position: "absolute", top: 2, left: checked ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,.15)", transition: "left 0.2s" }} />
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 500, color: "#475569" }}>{label}</span>
    </label>
  );
}

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {}
  };
  return (
    <button onClick={copy} style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700,
      background: copied ? "#F0FDF4" : "linear-gradient(135deg,#6366F1,#4F46E5)",
      color: copied ? "#16A34A" : "#fff",
      border: copied ? "1px solid #BBF7D0" : "none",
      cursor: "pointer", transition: "all 0.2s",
    }}>
      {copied ? <><IconCheck size={13}/> Copied!</> : <><IconCopy size={13}/> Copy</>}
    </button>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SandboxPage() {
  const [activeTab,          setActiveTab]          = useState("lab");
  const [studyMode,          setStudyMode]          = useState<SandboxStudyMode>("concept-refresh");
  const [studyTopic,         setStudyTopic]         = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [answerFormat,       setAnswerFormat]       = useState<AnswerFormat>("paragraph");
  const [difficulty,         setDifficulty]         = useState<Difficulty>("medium");
  const [includeExamples,    setIncludeExamples]    = useState(true);
  const [includeReferences,  setIncludeReferences]  = useState(false);
  const [followUpCount,      setFollowUpCount]      = useState(1);
  const [recapStyle,         setRecapStyle]         = useState<RecapStyle>("one-line");
  const [constraints,        setConstraints]        = useState<ConstraintsState>({ bullets: true, sentences: 5, hints: true, rubric: true });
  const [builtPrompt,        setBuiltPrompt]        = useState("");
  const [editingPrompt,      setEditingPrompt]      = useState<string | null>(null);
  const [favorites,          setFavorites]          = useState<string[]>([]);

  const [labStatus, setLabStatus] = useState<"checking" | "online" | "offline">("checking");
  const [labStatusMessage, setLabStatusMessage] = useState("");
  const [labBackend, setLabBackend] = useState<"mini-gpt" | "karpathy">("mini-gpt");
  const [labTrainLoading, setLabTrainLoading] = useState(false);
  const [labGenerateLoading, setLabGenerateLoading] = useState(false);
  const [labTrainResponse, setLabTrainResponse] = useState<Record<string, unknown> | null>(null);
  const [labGeneratedText, setLabGeneratedText] = useState("");
  const [labPrompt, setLabPrompt] = useState("quantum");
  const [labEpochs, setLabEpochs] = useState(300);
  const [labLearningRate, setLabLearningRate] = useState(0.001);

  const checkLabStatus = async () => {
    setLabStatus("checking");
    setLabStatusMessage("");
    try {
      const response = await fetch("/api/mini-gpt?endpoint=health");
      const data = await response.json();
      if (response.ok) {
        setLabStatus("online");
        setLabStatusMessage(typeof data?.status === "string" ? data.status : "Mini GPT server reachable");
      } else {
        setLabStatus("offline");
        setLabStatusMessage(data?.error || "Mini GPT server unavailable");
      }
    } catch {
      setLabStatus("offline");
      setLabStatusMessage("Mini GPT server unavailable");
    }
  };

  const runLabTrain = async () => {
    setLabTrainLoading(true);
    setLabTrainResponse(null);
    try {
      const response =
        labBackend === "mini-gpt"
          ? await fetch("/api/mini-gpt?endpoint=train", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ n_steps: labEpochs, learning_rate: labLearningRate }),
            })
          : await fetch("/api/mini-gpt-karpathy", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ endpoint: "train", num_steps: labEpochs, learning_rate: labLearningRate }),
            });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Training failed");
      }
      setLabTrainResponse(data);
      await checkLabStatus();
    } catch (e) {
      setLabTrainResponse({ error: e instanceof Error ? e.message : "Training failed" });
    } finally {
      setLabTrainLoading(false);
    }
  };

  const runLabGenerate = async () => {
    setLabGenerateLoading(true);
    setLabGeneratedText("");
    try {
      const response =
        labBackend === "mini-gpt"
          ? await fetch("/api/mini-gpt?endpoint=generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ prompt: labPrompt, max_tokens: 120, temperature: 0.8 }),
            })
          : await fetch("/api/mini-gpt-karpathy", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ endpoint: "generate", temperature: 0.8, num_samples: 8 }),
            });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Generation failed");
      }
      setLabGeneratedText(data?.generated_text || data?.text || JSON.stringify(data));
    } catch (e) {
      setLabGeneratedText(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLabGenerateLoading(false);
    }
  };

  useEffect(() => {
    checkLabStatus();
  }, []);

  useEffect(() => {
    if (labBackend === "karpathy") {
      setLabStatus("online");
      setLabStatusMessage("Karpathy backend does not expose health endpoint; use Train/Generate to validate.");
    } else {
      checkLabStatus();
    }
  }, [labBackend]);

  const con = <K extends keyof ConstraintsState>(key: K, val: ConstraintsState[K]) =>
    setConstraints((c) => ({ ...c, [key]: val }));

  const handleBuild = () => {
    const p = buildPrompt(studyMode, studyTopic, constraints, customInstructions, answerFormat, difficulty, includeExamples, includeReferences, followUpCount, recapStyle);
    setBuiltPrompt(p);
    setEditingPrompt(null);
  };

  const handleRandomize = () => {
    setAnswerFormat(randomFrom(["paragraph","list","table","diagram"]));
    setDifficulty(randomFrom(["easy","medium","hard"]));
    setStudyMode(randomFrom(MODES.map((m) => m.value as SandboxStudyMode)));
    setConstraints({ bullets: Math.random()>.5, hints: Math.random()>.5, rubric: Math.random()>.5, sentences: Math.floor(Math.random()*7)+2 });
    setIncludeExamples(Math.random()>.5);
    setIncludeReferences(Math.random()>.5);
    setFollowUpCount(Math.floor(Math.random()*3));
    setRecapStyle(randomFrom(["one-line","summary","none"]));
    setCustomInstructions("");
  };

  const currentPrompt = editingPrompt ?? builtPrompt;

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans','Segoe UI',sans-serif", background: "#F1F5F9", minHeight: "100vh", padding: "32px 24px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        button:focus, input:focus, select:focus, textarea:focus { outline: none; }
        select, input[type="number"] { appearance: none; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 4px; }
      `}</style>

      <div style={{ maxWidth: 820, margin: "0 auto" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: "linear-gradient(135deg,#6366F1,#4F46E5)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(99,102,241,.3)", flexShrink: 0 }}>
              <IconTarget color="#fff" size={20} />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.02em" }}>Exam Prompt Builder</h1>
              <p style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>Build focused, rubric-aligned prompts for exam prep.</p>
            </div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#7C3AED", background: "#F5F3FF", border: "1px solid #DDD6FE", padding: "4px 12px", borderRadius: 20, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Prompt Maker
          </span>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {[["lab","🧪","Lab"],["study","🎯","Study"],["about","📖","About"]].map(([id, icon, label]) => (
            <button key={id} onClick={() => setActiveTab(id)} style={pillBtn(activeTab === id, { bg: "#EEF2FF", border: "#C7D2FE", text: "#4F46E5" })}>
              {icon} {label}
            </button>
          ))}
        </div>

        {/* ── Lab Tab ── */}
        {activeTab === "lab" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={card({ padding: "24px" })}>
              <h2 style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", marginBottom: 10 }}>Mini GPT Lab</h2>
              <p style={{ fontSize: 13, color: "#64748B", marginBottom: 14 }}>
                Train and sample from the sandbox model via <code>/api/mini-gpt</code>.
              </p>

              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
                <select
                  value={labBackend}
                  onChange={(e) => setLabBackend(e.target.value as "mini-gpt" | "karpathy")}
                  style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #E2E8F0" }}
                >
                  <option value="mini-gpt">mini-gpt</option>
                  <option value="karpathy">mini-gpt-karpathy</option>
                </select>
                <span style={{
                  padding: "4px 10px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  color: labStatus === "online" ? "#166534" : labStatus === "offline" ? "#991b1b" : "#334155",
                  background: labStatus === "online" ? "#dcfce7" : labStatus === "offline" ? "#fee2e2" : "#e2e8f0",
                }}>
                  {labStatus === "checking" ? "Checking..." : labStatus.toUpperCase()}
                </span>
                <span style={{ fontSize: 12, color: "#64748B" }}>{labStatusMessage}</span>
                {labBackend === "mini-gpt" && (
                  <button className="btn-premium" onClick={checkLabStatus}>Refresh Status</button>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginBottom: 14 }}>
                <Input
                  label="Epochs (n_steps)"
                  type="number"
                  min={10}
                  max={5000}
                  value={labEpochs}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setLabEpochs(Number(e.target.value))}
                />
                <Input
                  label="Learning Rate"
                  type="number"
                  step="0.0001"
                  min={0.0001}
                  max={1}
                  value={labLearningRate}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setLabLearningRate(Number(e.target.value))}
                />
              </div>

              <button
                onClick={runLabTrain}
                disabled={labTrainLoading || labStatus === "offline"}
                className="btn-premium"
                style={{ marginBottom: 12 }}
              >
                {labTrainLoading ? "Training..." : "Train"}
              </button>

              {labTrainResponse && (
                <pre style={{ background: "#F8FAFC", padding: 12, borderRadius: 10, fontSize: 12, overflowX: "auto" }}>
                  {JSON.stringify(labTrainResponse, null, 2)}
                </pre>
              )}

              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                <Input
                  label="Generate Prompt"
                  value={labPrompt}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setLabPrompt(e.target.value)}
                  placeholder="Enter prompt"
                />
                <button
                  onClick={runLabGenerate}
                  disabled={labGenerateLoading || labStatus === "offline"}
                  className="btn-premium"
                >
                  {labGenerateLoading ? "Generating..." : "Generate"}
                </button>
                {!!labGeneratedText && (
                  <pre style={{ background: "#F8FAFC", padding: 12, borderRadius: 10, fontSize: 12, whiteSpace: "pre-wrap" }}>
                    {labGeneratedText}
                  </pre>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Study Tab ── */}
        {activeTab === "study" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Builder card */}
            <div style={card({ padding: "24px" })}>

              {/* Tip banner */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 10, padding: "10px 14px", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
                <p style={{ fontSize: 12, color: "#4338CA", fontWeight: 500, flex: 1 }}>
                  <span style={{ fontWeight: 800 }}>Tip: </span>{MODE_TIPS[studyMode]}
                </p>
                <button onClick={handleRandomize} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  fontSize: 12, fontWeight: 700, color: "#6366F1",
                  background: "#fff", border: "1.5px solid #C7D2FE",
                  borderRadius: 8, padding: "6px 14px", cursor: "pointer",
                  flexShrink: 0,
                }}>
                  <IconDice size={14} /> Randomize
                </button>
              </div>

              <h2 style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", marginBottom: 4 }}>Configure Your Prompt</h2>
              <p style={{ fontSize: 12, color: "#94A3B8", marginBottom: 20 }}>
                Build a focused, exam-style prompt you can paste into the main Study AI.
              </p>

              {/* Form grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
                <Select label="Study Mode" value={studyMode} onChange={setStudyMode}
                  options={MODES} />
                <Input label="Topic / Chapter" value={studyTopic} onChange={(e: ChangeEvent<HTMLInputElement>) => setStudyTopic(e.target.value)}
                  placeholder="e.g. Photosynthesis, Derivatives…" />
                <Input label="Custom Instructions" value={customInstructions} onChange={(e: ChangeEvent<HTMLInputElement>) => setCustomInstructions(e.target.value)}
                  placeholder="Any extra keywords…" />
                <Select label="Answer Format" value={answerFormat} onChange={setAnswerFormat}
                  options={[{value:"paragraph",label:"Paragraph"},{value:"list",label:"List"},{value:"table",label:"Table"},{value:"diagram",label:"Diagram"}]} />
                <Select label="Difficulty" value={difficulty} onChange={setDifficulty}
                  options={[{value:"easy",label:"Easy"},{value:"medium",label:"Medium"},{value:"hard",label:"Hard"}]} />
                <Input label="Answer Length (sentences)" type="number" min={1} max={10}
                  value={constraints.sentences} onChange={(e: ChangeEvent<HTMLInputElement>) => con("sentences", Number(e.target.value))} />
                <Input label="Follow-up Questions" type="number" min={0} max={5}
                  value={followUpCount} onChange={(e: ChangeEvent<HTMLInputElement>) => setFollowUpCount(Number(e.target.value))} />
                <Select label="Recap Style" value={recapStyle} onChange={setRecapStyle}
                  options={[{value:"one-line",label:"One-line"},{value:"summary",label:"Summary"},{value:"none",label:"None"}]} />
              </div>

              {/* Toggles */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginTop: 18, padding: "16px", background: "#F8FAFC", borderRadius: 12, border: "1px solid #F1F5F9" }}>
                <Toggle checked={includeExamples}      onChange={setIncludeExamples}   label="Include Examples" />
                <Toggle checked={includeReferences}    onChange={setIncludeReferences} label="Include References" />
                <Toggle checked={constraints.bullets}  onChange={(v: boolean) => con("bullets", v)}  label="Bullet-only Answers" />
                <Toggle checked={constraints.hints}    onChange={(v: boolean) => con("hints", v)}    label="Hint-first (Reveal Gradually)" />
                <Toggle checked={constraints.rubric}   onChange={(v: boolean) => con("rubric", v)}   label="Rubric-style Critique" />
              </div>

              {/* Build button */}
              <button onClick={handleBuild} style={{
                marginTop: 20, width: "100%", padding: "13px",
                background: "linear-gradient(135deg,#6366F1,#4F46E5)",
                color: "#fff", fontSize: 14, fontWeight: 700,
                border: "none", borderRadius: 12, cursor: "pointer",
                boxShadow: "0 4px 14px rgba(99,102,241,.3)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
                <IconTarget color="#fff" size={16} /> Build Prompt
              </button>
            </div>

            {/* Generated prompt box */}
            {builtPrompt && (
              <div style={card({ padding: "20px" })}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>Generated Prompt</h3>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button onClick={() => setEditingPrompt(editingPrompt !== null ? null : builtPrompt)} style={{
                      display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8,
                      fontSize: 12, fontWeight: 600, color: "#64748B",
                      background: "#F8FAFC", border: "1px solid #E2E8F0", cursor: "pointer",
                    }}>
                      <IconEdit size={13}/> {editingPrompt !== null ? "Cancel" : "Edit"}
                    </button>
                    {editingPrompt !== null && (
                      <button onClick={() => { setBuiltPrompt(editingPrompt); setEditingPrompt(null); }} style={{
                        display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8,
                        fontSize: 12, fontWeight: 700, color: "#fff",
                        background: "linear-gradient(135deg,#6366F1,#4F46E5)", border: "none", cursor: "pointer",
                      }}>
                        <IconCheck size={13}/> Save
                      </button>
                    )}
                    <CopyButton text={currentPrompt} />
                    <button onClick={() => { if (!favorites.includes(currentPrompt)) setFavorites(f => [...f, currentPrompt]); }} style={{
                      display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8,
                      fontSize: 12, fontWeight: 700, color: "#7C3AED",
                      background: "#F5F3FF", border: "1px solid #DDD6FE", cursor: "pointer",
                    }}>
                      <IconStar size={12}/> Save
                    </button>
                  </div>
                </div>

                {editingPrompt !== null ? (
                  <textarea value={editingPrompt} onChange={(e) => setEditingPrompt(e.target.value)}
                    style={{ width: "100%", minHeight: 100, padding: "12px", background: "#F8FAFC", border: "1px solid #C7D2FE", borderRadius: 10, fontSize: 13, color: "#334155", fontFamily: "inherit", lineHeight: 1.6, resize: "vertical" }} />
                ) : (
                  <div style={{ background: "#F8FAFC", border: "1px solid #F1F5F9", borderRadius: 10, padding: "14px", fontSize: 13, color: "#334155", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                    {builtPrompt}
                  </div>
                )}
              </div>
            )}

            {/* Favorites */}
            {favorites.length > 0 && (
              <div style={card({ padding: "20px" })}>
                <h3 style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: "#7C3AED" }}><IconStar size={14}/></span> Saved Prompts
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {favorites.map((fp, i) => (
                    <div key={i} style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: "12px 14px" }}>
                      <p style={{ fontSize: 12, color: "#475569", lineHeight: 1.6, marginBottom: 10 }}>{fp}</p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => { setBuiltPrompt(fp); setEditingPrompt(null); }} style={{
                          fontSize: 12, fontWeight: 700, color: "#fff",
                          background: "linear-gradient(135deg,#6366F1,#4F46E5)",
                          border: "none", borderRadius: 8, padding: "5px 14px", cursor: "pointer",
                        }}>Use</button>
                        <CopyButton text={fp} />
                        <button onClick={() => setFavorites(f => f.filter((_, j) => j !== i))} style={{
                          fontSize: 12, fontWeight: 600, color: "#94A3B8",
                          background: "#fff", border: "1px solid #E2E8F0",
                          borderRadius: 8, padding: "5px 12px", cursor: "pointer",
                        }}>Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── About Tab ── */}
        {activeTab === "about" && (
          <div style={card({ padding: "28px" })}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", marginBottom: 20 }}>About This Module</h2>

            {([
              {
                title: "What Is This?",
                content: "The Exam Prompt Builder helps you craft high-quality, rubric-aligned prompts for exam preparation. Choose a study mode, enter your topic, set constraints, and generate a prompt you can copy straight into the main Study AI for detailed answers.",
                type: "text",
              },
              {
                title: "How To Use",
                type: "list",
                items: [
                  ["Study Tab", "Select a mode (Concept Refresh, Formula Drill, Past-Paper, Flashcards, or Common Mistakes)"],
                  ["Topic", "Enter the subject or chapter you want to revise"],
                  ["Constraints", "Set answer length, bullet format, hints, and rubric critique"],
                  ["Build Prompt", "Click to generate an optimised prompt"],
                  ["Copy", "Paste the prompt into the main Study AI for a full answer"],
                ],
              },
              {
                title: "Study Modes",
                type: "list",
                items: [
                  ["Concept Refresh", "Quick summary of key ideas"],
                  ["Formula Drill", "Formulae with worked examples"],
                  ["Past-Paper Style", "Exam-format questions with model answers"],
                  ["Flashcards", "Quick-fire Q&A cards"],
                  ["Common Mistakes", "Frequent errors and how to fix them"],
                ],
              },
            ] as Array<
              | { title: string; type: "text"; content: string }
              | { title: string; type: "list"; items: Array<[string, string]> }
            >).map((sec) => (
              <div key={sec.title} style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 12, fontWeight: 800, color: "#6366F1", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>{sec.title}</h3>
                {sec.type === "text" && <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.75 }}>{sec.content}</p>}
                {sec.type === "list" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {sec.items.map(([key, val]) => (
                      <div key={key} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#C7D2FE", flexShrink: 0, marginTop: 6 }} />
                        <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}><strong style={{ color: "#1E293B" }}>{key}</strong> — {val}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Tip card */}
            <div style={{ background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 12, padding: "16px 18px" }}>
              <h3 style={{ fontSize: 12, fontWeight: 800, color: "#7C3AED", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>💡 Good to Know</h3>
              <p style={{ fontSize: 13, color: "#5B21B6", lineHeight: 1.7 }}>
                This tool is a <strong>prompt maker</strong>, not an AI model. It builds the best possible prompt for your exam topic so that when you paste it into the Study AI, you get focused, rubric-aligned answers every time.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}