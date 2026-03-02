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
import styles from "./sandbox.module.css";

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
        <div className="header-content max-width-1100">
          <div className="logo">
            <span className="logo-icon">🎯</span>
            <span className="logo-text">Exam Prompt Builder</span>
            <span className="logo-badge badge-purple">Prompt Maker</span>
          </div>
          <nav className="nav-links">
            <a href="/" className="nav-link">← Back to Study AI</a>
          </nav>
        </div>
      </header>

      <main className="main-content max-width-1100">
        {/* Hero */}
        <div className="hero-section pb-05rem">
          <h1 className="hero-title fs-15rem">
            Exam Prompt Builder
          </h1>
          <p className="hero-subtitle fs-085rem">
            Build focused, rubric-aligned prompts for exam prep. Copy into the main Study AI for answers.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-025 mb-125 border-bottom-subtle pb-0">
          {(["study", "about"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
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
          <div className="flex-col gap-1rem">
            <div className="p-1rem bg-secondary radius-md border-subtle">
                            {/* Tips/examples for each mode */}
                            <div className="mb-075">
                              <span className="fs-08rem accent-blue fw-600">Tip:</span>
                              <span className="fs-08rem text-secondary ml-05"> 
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
                              className="btn-randomize"
                            >
                              🎲 Randomize
                            </button>
              <h3 className="accent-blue mb-05">Exam Study Prompt Builder</h3>
              <p className="fs-085rem text-secondary mb-075">
                Build a concise, exam-style prompt you can paste into the main AI. No training needed; focused on retrieval, hints, and rubric-aligned answers.
              </p>

              <div className="grid grid-cols-auto-fill-240 gap-075">
                <label className="flex-col gap-035">
                  <span className="fs-07rem text-tertiary uppercase ls-005">Mode</span>
                  <select value={studyMode} onChange={(e) => setStudyMode(e.target.value)} className="input-style">
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

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Topic / Chapter</span>
                  <input value={studyTopic} onChange={(e) => setStudyTopic(e.target.value)} placeholder="e.g., Photosynthesis, Derivatives, WWII causes" className={styles.input} />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Custom Instructions / Keywords</span>
                  <input value={customInstructions} onChange={(e) => setCustomInstructions(e.target.value)} placeholder="Any extra instructions or keywords..." className={styles.input} />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Answer Format</span>
                  <select value={answerFormat} onChange={e => setAnswerFormat(e.target.value)} className={styles.input}>
                    <option value="paragraph">Paragraph</option>
                    <option value="list">List</option>
                    <option value="table">Table</option>
                    <option value="diagram">Diagram</option>
                  </select>
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Difficulty Level</span>
                  <select value={difficulty} onChange={e => setDifficulty(e.target.value)} className={styles.input}>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </label>
                <label className={styles.checkboxRow}>
                  <input type="checkbox" checked={includeExamples} onChange={e => setIncludeExamples(e.target.checked)} />
                  <span className={styles.checkboxText}>Include Examples</span>
                </label>
                <label className={styles.checkboxRow}>
                  <input type="checkbox" checked={includeReferences} onChange={e => setIncludeReferences(e.target.checked)} />
                  <span className={styles.checkboxText}>Include References</span>
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Follow-up Questions</span>
                  <input type="number" min={0} max={5} value={followUpCount} onChange={e => setFollowUpCount(Number(e.target.value))} className={styles.input} />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Recap Style</span>
                  <select value={recapStyle} onChange={e => setRecapStyle(e.target.value)} className={styles.input}>
                    <option value="one-line">One-line</option>
                    <option value="summary">Summary</option>
                    <option value="none">None</option>
                  </select>
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Answer length (sentences)</span>
                  <input type="number" min={1} max={8} value={studyConstraints.sentences} onChange={(e) => setStudyConstraints({ ...studyConstraints, sentences: Number(e.target.value) })} className={styles.input} />
                </label>

                <label className={styles.checkboxRow}>
                  <input type="checkbox" checked={studyConstraints.bullets} onChange={(e) => setStudyConstraints({ ...studyConstraints, bullets: e.target.checked })} />
                  <span className={styles.checkboxText}>Bullet-only answers</span>
                </label>

                <label className={styles.checkboxRow}>
                  <input type="checkbox" checked={studyConstraints.hints} onChange={(e) => setStudyConstraints({ ...studyConstraints, hints: e.target.checked })} />
                  <span className={styles.checkboxText}>Hint-first (reveal gradually)</span>
                </label>

                <label className={styles.checkboxRow}>
                  <input type="checkbox" checked={studyConstraints.rubric} onChange={(e) => setStudyConstraints({ ...studyConstraints, rubric: e.target.checked })} />
                  <span className={styles.checkboxText}>Rubric-style critique</span>
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
                className={styles.actionButton}
              >
                Build Prompt
              </button>
            </div>

            {studyPrompt && (
              <div className={styles.promptBox}>
                <CopyPromptButton prompt={editingPrompt ?? studyPrompt} />
                {editingPrompt !== null ? (
                  <textarea
                    value={editingPrompt}
                    onChange={e => setEditingPrompt(e.target.value)}
                    className={styles.textareaEdit}
                    aria-label="Edit prompt"
                  />
                ) : (
                  <div>{studyPrompt}</div>
                )}
                <div className={styles.buttonRow}>
                  <button
                    onClick={() => setEditingPrompt(studyPrompt)}
                    className={styles.smallButton}
                  >Edit</button>
                  {editingPrompt !== null && (
                    <button
                      onClick={() => { setStudyPrompt(editingPrompt ?? studyPrompt); setEditingPrompt(null); }}
                      className={styles.saveButton}
                    >Save</button>
                  )}
                  <button
                    onClick={() => setFavoritePrompts([...favoritePrompts, (editingPrompt ?? studyPrompt)])}
                    className={styles.favoriteButton}
                  >Save as Favorite</button>
                </div>
              </div>
            )}
            {favoritePrompts.length > 0 && (
              <div className={styles.favorites}>
                <h4 className={styles.favoritesTitle}>Favorite Prompts</h4>
                <ul className={styles.favoriteList}>
                  {favoritePrompts.map((fp, i) => (
                    <li key={i} className={styles.favoriteItem}>
                      <div className={styles.favoritePrompt}>{fp}</div>
                      <button
                        onClick={() => setStudyPrompt(fp)}
                        className={styles.useButton}
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
          <div className={styles.aboutCard}>
            <h2 className={styles.aboutHeading}>
              About This Module
            </h2>

            <section className={styles.aboutSection}>
              <h3 className={styles.aboutSubheading}>What Is This?</h3>
              <p>
                The <strong>Exam Prompt Builder</strong> helps you craft high-quality, rubric-aligned prompts
                for exam preparation. Choose a study mode, enter your topic, set constraints, and generate
                a prompt you can copy straight into the main Study AI for detailed answers.
              </p>
            </section>

            <section className={styles.aboutSection}>
              <h3 className={styles.aboutSubheading}>How To Use</h3>
              <ul className={styles.aboutList}>
                <li><strong>Study Tab</strong> — Select a mode (Concept Refresh, Formula Drill, Past-Paper, Flashcards, or Common Mistakes)</li>
                <li><strong>Topic</strong> — Enter the subject or chapter you want to revise</li>
                <li><strong>Constraints</strong> — Set answer length, bullet format, hints, and rubric critique</li>
                <li><strong>Build Prompt</strong> — Click to generate an optimised prompt</li>
                <li><strong>Copy</strong> — Copy the prompt and paste it into the main Study AI for a full answer</li>
              </ul>
            </section>

            <section className={styles.aboutSection}>
              <h3 className={styles.aboutSubheading}>Study Modes</h3>
              <ul className={styles.aboutList}>
                <li><strong>Concept Refresh</strong> — Quick summary of key ideas</li>
                <li><strong>Formula Drill</strong> — Formulae with worked examples</li>
                <li><strong>Past-Paper Style</strong> — Exam-format questions with model answers</li>
                <li><strong>Flashcards</strong> — Quick-fire Q&A cards</li>
                <li><strong>Common Mistakes</strong> — Frequent errors and how to fix them</li>
              </ul>
            </section>

            <section className={styles.tipCard}>
              <h3 className={styles.tipHeading}>💡 Tip</h3>
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
      className={styles.copyButton}
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
