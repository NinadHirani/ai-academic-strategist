"use client";

// Helper for study mode tips
function getModeTip(mode: string) {
  switch (mode) {
    case "concept-refresh": return "Summarize key concepts in a concise way.";
    case "formula-drill": return "Focus on formulas and provide worked examples.";
    case "past-paper": return "Create exam-style questions and answers.";
    case "flashcards": return "Generate Q&A pairs for quick review.";
    case "mistake-fix": return "List common mistakes and how to fix them.";
    case "compare-contrast": return "Highlight similarities and differences with examples.";
    case "case-study": return "Analyze a scenario and give recommendations.";
    case "step-by-step": return "Break down the solution into clear steps.";
    default: return "Choose a mode to see tips.";
  }
}

function randomStudyMode() {
  const modes = [
    "concept-refresh",
    "formula-drill",
    "past-paper",
    "flashcards",
    "mistake-fix",
    "compare-contrast",
    "case-study",
    "step-by-step"
  ];
  return modes[Math.floor(Math.random() * modes.length)];
}


import React, { useState } from "react";

// ============================================================================
// Main Sandbox Page — Exam Prompt Builder
// ============================================================================

export default function SandboxPage() {
    const [editingPrompt, setEditingPrompt] = useState<string | null>(null);
    const [favoritePrompts, setFavoritePrompts] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"study" | "about">("study");
  const [studyMode, setStudyMode] = useState("concept-refresh");
  const [studyTopic, setStudyTopic] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [answerFormat, setAnswerFormat] = useState("paragraph");
  const [difficulty, setDifficulty] = useState("medium");
  const [includeExamples, setIncludeExamples] = useState(true);
  const [includeReferences, setIncludeReferences] = useState(false);
  const [followUpCount, setFollowUpCount] = useState(1);
  const [recapStyle, setRecapStyle] = useState("one-line");
  const [studyConstraints, setStudyConstraints] = useState({ bullets: true, sentences: 5, hints: true, rubric: true });
  const [studyPrompt, setStudyPrompt] = useState("");

  // ========================================================================
  // Render
  // ========================================================================

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="header-content" style={{ maxWidth: "1100px" }}>
          <div className="logo">
            <span className="logo-icon">🎯</span>
            <span className="logo-text">Exam Prompt Builder</span>
            <span className="logo-badge" style={{
              background: "rgba(168, 85, 247, 0.15)",
              borderColor: "rgba(168, 85, 247, 0.3)",
              color: "#a855f7"
            }}>Prompt Maker</span>
          </div>
          <nav className="nav-links">
            <a href="/" className="nav-link">← Back to Study AI</a>
          </nav>
        </div>
      </header>

      <main className="main-content" style={{ maxWidth: "1100px" }}>
        {/* Hero */}
        <div className="hero-section" style={{ paddingBottom: "0.5rem" }}>
          <h1 className="hero-title" style={{ fontSize: "1.5rem" }}>
            Exam Prompt Builder
          </h1>
          <p className="hero-subtitle" style={{ fontSize: "0.85rem" }}>
            Build focused, rubric-aligned prompts for exam prep. Copy into the main Study AI for answers.
          </p>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex",
          gap: "0.25rem",
          marginBottom: "1.25rem",
          borderBottom: "1px solid var(--border-subtle)",
          paddingBottom: "0",
        }}>
          {(["study", "about"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "0.6rem 1rem",
                background: activeTab === tab ? "var(--bg-tertiary)" : "transparent",
                border: "1px solid transparent",
                borderBottom: activeTab === tab ? "2px solid var(--accent-blue)" : "2px solid transparent",
                borderRadius: "var(--radius-sm) var(--radius-sm) 0 0",
                color: activeTab === tab ? "var(--text-primary)" : "var(--text-tertiary)",
                fontSize: "0.8rem",
                fontWeight: activeTab === tab ? 600 : 400,
                cursor: "pointer",
                textTransform: "capitalize",
                transition: "all 0.15s ease",
              }}
            >
              {tab === "study" && "🎯 "}
              {tab === "about" && "📖 "}
              {tab === "study" ? "Study" : "About"}
            </button>
          ))}
        </div>

        {/* ================================================================ */}
        {/* STUDY (EXAM MODE) TAB */}
        {/* ================================================================ */}
        {activeTab === "study" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ padding: "1rem", background: "var(--bg-secondary)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                            {/* Tips/examples for each mode */}
                            <div style={{ marginBottom: "0.75rem" }}>
                              <span style={{ fontSize: "0.8rem", color: "var(--accent-blue)", fontWeight: 600 }}>Tip:</span>
                              <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginLeft: "0.5rem" }}>
                                {getModeTip(studyMode)}
                              </span>
                            </div>
                            {/* Randomize button for creative variations */}
                            <button
                              type="button"
                              onClick={() => {
                                // Randomize some fields for creative prompt
                                const formats = ["paragraph", "list", "table", "diagram"];
                                const difficulties = ["easy", "medium", "hard"];
                                setAnswerFormat(formats[Math.floor(Math.random() * formats.length)]);
                                setDifficulty(difficulties[Math.floor(Math.random() * difficulties.length)]);
                                setStudyMode(randomStudyMode());
                                setStudyConstraints({
                                  ...studyConstraints,
                                  bullets: Math.random() > 0.5,
                                  hints: Math.random() > 0.5,
                                  rubric: Math.random() > 0.5,
                                  sentences: Math.floor(Math.random() * 8) + 1,
                                });
                                setIncludeExamples(Math.random() > 0.5);
                                setIncludeReferences(Math.random() > 0.5);
                                setFollowUpCount(Math.floor(Math.random() * 3));
                                setRecapStyle(["one-line", "summary", "none"][Math.floor(Math.random() * 3)]);
                                setCustomInstructions("");
                              }}
                              style={{
                                marginBottom: "0.75rem",
                                padding: "0.5rem 1rem",
                                background: "var(--gradient-primary)",
                                color: "white",
                                border: "none",
                                borderRadius: "var(--radius-sm)",
                                fontWeight: 600,
                                fontSize: "0.85rem",
                                cursor: "pointer",
                              }}
                            >
                              🎲 Randomize
                            </button>
              <h3 style={{ color: "var(--accent-blue)", marginBottom: "0.5rem" }}>Exam Study Prompt Builder</h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "0.75rem" }}>
                Build a concise, exam-style prompt you can paste into the main AI. No training needed; focused on retrieval, hints, and rubric-aligned answers.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "0.75rem" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Mode</span>
                  <select value={studyMode} onChange={(e) => setStudyMode(e.target.value)} style={inputStyle}>
                    <option value="concept-refresh">Concept Refresh</option>
                    <option value="formula-drill">Formula Drill</option>
                    <option value="past-paper">Past-Paper Style</option>
                    <option value="flashcards">Flashcards</option>
                    <option value="mistake-fix">Common Mistakes</option>
                    <option value="compare-contrast">Compare & Contrast</option>
                    <option value="case-study">Case Study</option>
                    <option value="step-by-step">Step-by-Step Solution</option>
                  </select>
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Topic / Chapter</span>
                  <input value={studyTopic} onChange={(e) => setStudyTopic(e.target.value)} placeholder="e.g., Photosynthesis, Derivatives, WWII causes" style={inputStyle} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Custom Instructions / Keywords</span>
                  <input value={customInstructions} onChange={(e) => setCustomInstructions(e.target.value)} placeholder="Any extra instructions or keywords..." style={inputStyle} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Answer Format</span>
                  <select value={answerFormat} onChange={e => setAnswerFormat(e.target.value)} style={inputStyle}>
                    <option value="paragraph">Paragraph</option>
                    <option value="list">List</option>
                    <option value="table">Table</option>
                    <option value="diagram">Diagram</option>
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Difficulty Level</span>
                  <select value={difficulty} onChange={e => setDifficulty(e.target.value)} style={inputStyle}>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <input type="checkbox" checked={includeExamples} onChange={e => setIncludeExamples(e.target.checked)} />
                  <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Include Examples</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <input type="checkbox" checked={includeReferences} onChange={e => setIncludeReferences(e.target.checked)} />
                  <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Include References</span>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Follow-up Questions</span>
                  <input type="number" min={0} max={5} value={followUpCount} onChange={e => setFollowUpCount(Number(e.target.value))} style={inputStyle} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Recap Style</span>
                  <select value={recapStyle} onChange={e => setRecapStyle(e.target.value)} style={inputStyle}>
                    <option value="one-line">One-line</option>
                    <option value="summary">Summary</option>
                    <option value="none">None</option>
                  </select>
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Answer length (sentences)</span>
                  <input type="number" min={1} max={8} value={studyConstraints.sentences} onChange={(e) => setStudyConstraints({ ...studyConstraints, sentences: Number(e.target.value) })} style={inputStyle} />
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <input type="checkbox" checked={studyConstraints.bullets} onChange={(e) => setStudyConstraints({ ...studyConstraints, bullets: e.target.checked })} />
                  <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Bullet-only answers</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <input type="checkbox" checked={studyConstraints.hints} onChange={(e) => setStudyConstraints({ ...studyConstraints, hints: e.target.checked })} />
                  <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Hint-first (reveal gradually)</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <input type="checkbox" checked={studyConstraints.rubric} onChange={(e) => setStudyConstraints({ ...studyConstraints, rubric: e.target.checked })} />
                  <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Rubric-style critique</span>
                </label>
              </div>

              <button
                onClick={() => {
                  const prompt = buildStudyPrompt(
                    studyMode,
                    studyTopic,
                    studyConstraints,
                    customInstructions,
                    answerFormat,
                    difficulty,
                    includeExamples,
                    includeReferences,
                    followUpCount,
                    recapStyle
                  );
                  if (prompt) setStudyPrompt(prompt);
                  setEditingPrompt(null);
                }}
                style={{
                  marginTop: "0.75rem",
                  padding: "0.65rem 1.25rem",
                  background: "var(--gradient-primary)",
                  border: "none",
                  borderRadius: "var(--radius-md)",
                  color: "white",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Build Prompt
              </button>
            </div>

            {studyPrompt && (
              <div style={{ position: "relative", padding: "1rem", background: "var(--bg-secondary)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", fontFamily: "var(--font-mono)", fontSize: "0.9rem", whiteSpace: "pre-wrap", marginBottom: "0.5rem" }}>
                <CopyPromptButton prompt={editingPrompt ?? studyPrompt} />
                {editingPrompt !== null ? (
                  <textarea
                    value={editingPrompt}
                    onChange={e => setEditingPrompt(e.target.value)}
                    style={{ width: "100%", minHeight: "80px", fontFamily: "var(--font-mono)", fontSize: "0.9rem", marginTop: "0.5rem" }}
                  />
                ) : (
                  <div>{studyPrompt}</div>
                )}
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <button
                    onClick={() => setEditingPrompt(studyPrompt)}
                    style={{ padding: "0.3rem 0.8rem", background: "var(--bg-tertiary)", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer" }}
                  >Edit</button>
                  {editingPrompt !== null && (
                    <button
                      onClick={() => { setStudyPrompt(editingPrompt ?? studyPrompt); setEditingPrompt(null); }}
                      style={{ padding: "0.3rem 0.8rem", background: "var(--gradient-primary)", color: "white", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer" }}
                    >Save</button>
                  )}
                  <button
                    onClick={() => setFavoritePrompts([...favoritePrompts, (editingPrompt ?? studyPrompt)])}
                    style={{ padding: "0.3rem 0.8rem", background: "#a855f7", color: "white", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer" }}
                  >Save as Favorite</button>
                </div>
              </div>
            )}
            {favoritePrompts.length > 0 && (
              <div style={{ marginBottom: "1rem" }}>
                <h4 style={{ fontSize: "0.9rem", color: "var(--accent-blue)", marginBottom: "0.5rem" }}>Favorite Prompts</h4>
                <ul style={{ listStyle: "none", padding: 0 }}>
                  {favoritePrompts.map((fp, i) => (
                    <li key={i} style={{ marginBottom: "0.5rem", background: "var(--bg-tertiary)", borderRadius: "var(--radius-sm)", padding: "0.5rem" }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.9rem", marginBottom: "0.25rem" }}>{fp}</div>
                      <button
                        onClick={() => setStudyPrompt(fp)}
                        style={{ padding: "0.2rem 0.7rem", background: "var(--gradient-primary)", color: "white", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer", fontSize: "0.85rem" }}
                      >Use</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* ABOUT TAB */}
        {/* ================================================================ */}
        {activeTab === "about" && (
          <div style={{
            padding: "1.25rem",
            background: "var(--bg-secondary)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-subtle)",
            fontSize: "0.85rem",
            color: "var(--text-secondary)",
            lineHeight: 1.8,
          }}>
            <h2 style={{ color: "var(--text-primary)", marginBottom: "0.75rem", fontSize: "1.1rem" }}>
              About This Module
            </h2>

            <section style={{ marginBottom: "1.25rem" }}>
              <h3 style={{ color: "var(--accent-blue)", fontSize: "0.9rem", marginBottom: "0.5rem" }}>What Is This?</h3>
              <p>
                The <strong>Exam Prompt Builder</strong> helps you craft high-quality, rubric-aligned prompts
                for exam preparation. Choose a study mode, enter your topic, set constraints, and generate
                a prompt you can copy straight into the main Study AI for detailed answers.
              </p>
            </section>

            <section style={{ marginBottom: "1.25rem" }}>
              <h3 style={{ color: "var(--accent-blue)", fontSize: "0.9rem", marginBottom: "0.5rem" }}>How To Use</h3>
              <ul style={{ paddingLeft: "1.25rem" }}>
                <li><strong>Study Tab</strong> — Select a mode (Concept Refresh, Formula Drill, Past-Paper, Flashcards, or Common Mistakes)</li>
                <li><strong>Topic</strong> — Enter the subject or chapter you want to revise</li>
                <li><strong>Constraints</strong> — Set answer length, bullet format, hints, and rubric critique</li>
                <li><strong>Build Prompt</strong> — Click to generate an optimised prompt</li>
                <li><strong>Copy</strong> — Copy the prompt and paste it into the main Study AI for a full answer</li>
              </ul>
            </section>

            <section style={{ marginBottom: "1.25rem" }}>
              <h3 style={{ color: "var(--accent-blue)", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Study Modes</h3>
              <ul style={{ paddingLeft: "1.25rem" }}>
                <li><strong>Concept Refresh</strong> — Quick summary of key ideas</li>
                <li><strong>Formula Drill</strong> — Formulae with worked examples</li>
                <li><strong>Past-Paper Style</strong> — Exam-format questions with model answers</li>
                <li><strong>Flashcards</strong> — Quick-fire Q&A cards</li>
                <li><strong>Common Mistakes</strong> — Frequent errors and how to fix them</li>
              </ul>
            </section>

            <section style={{ padding: "0.75rem", background: "rgba(168, 85, 247, 0.08)", borderRadius: "var(--radius-md)" }}>
              <h3 style={{ color: "#a855f7", fontSize: "0.9rem", marginBottom: "0.5rem" }}>💡 Tip</h3>
              <p>
                This tool is a <strong>prompt maker</strong>, not an AI model. It builds the best possible
                prompt for your exam topic so that when you paste it into the Study AI, you get focused,
                rubric-aligned answers every time.
              </p>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

const inputStyle: React.CSSProperties = {
  padding: "0.5rem 0.6rem",
  background: "var(--bg-input)",
  border: "1px solid var(--border-subtle)",
  borderRadius: "var(--radius-sm)",
  color: "var(--text-primary)",
  fontSize: "0.8rem",
  fontFamily: "var(--font-mono)",
  outline: "none",
  width: "100%",
};

function CopyPromptButton({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      onClick={handleCopy}
      style={{
        position: "absolute",
        top: "8px",
        right: "16px",
        padding: "0.4rem 1rem",
        background: "var(--gradient-primary)",
        color: "white",
        border: "none",
        borderRadius: "var(--radius-sm)",
        fontWeight: 600,
        fontSize: "0.85rem",
        cursor: "pointer",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        zIndex: 2,
      }}
    >
      {copied ? "Copied!" : "Copy to clipboard"}
    </button>
  );
}

function buildStudyPrompt(
  mode: string,
  topic: string,
  c: { bullets: boolean; sentences: number; hints: boolean; rubric: boolean },
  customInstructions?: string,
  answerFormat?: string,
  difficulty?: string,
  includeExamples?: boolean,
  includeReferences?: boolean,
  followUpCount?: number,
  recapStyle?: string
) {
  const topicText = topic?.trim() ? topic.trim() : "[insert your topic]";
  const parts: string[] = [];
  const modeText: Record<string, string> = {
    "concept-refresh": "Give a concise concept refresh",
    "formula-drill": "Drill formulas with 2 worked examples",
    "past-paper": "Generate 2 past-paper style questions with answers",
    "flashcards": "Create 6 flashcards",
    "mistake-fix": "List common mistakes and fixes",
    "compare-contrast": "Compare and contrast two concepts with examples",
    "case-study": "Analyze a case study and provide recommendations",
    "step-by-step": "Give a step-by-step solution to a problem",
  };
  parts.push(`${modeText[mode] || "Explain"} for ${topicText}.`);
  if (customInstructions?.trim()) {
    parts.push(`Instructions: ${customInstructions.trim()}`);
  }
  parts.push(`Format: ${answerFormat || "paragraph"}.`);
  parts.push(`Difficulty: ${difficulty || "medium"}.`);
  if (includeExamples) parts.push("Include relevant examples.");
  if (includeReferences) parts.push("Include references where possible.");
  parts.push(`Limit to ${c.sentences} sentences${c.bullets ? ", bullet-only" : ""}.`);
  if (c.hints) parts.push("Reveal hints first, then full answer.");
  if (c.rubric) parts.push("Provide a brief rubric-style critique for a student attempt (clarity, correctness, conciseness).");
  if (recapStyle && recapStyle !== "none") {
    parts.push(`End with a ${recapStyle === "one-line" ? "one-line recap" : "summary recap"}.`);
  }
  if (followUpCount && followUpCount > 0) {
    parts.push(`Add ${followUpCount} follow-up question${followUpCount > 1 ? "s" : ""}.`);
  }
  return parts.join(" ");
}
