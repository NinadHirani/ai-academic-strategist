"use client";

import React, { useState, useCallback } from "react";
import type {
  CopilotPipelineState,
  StudyRoadmap,
  RoadmapUnit,
  RoadmapTopic,
  TopicExpansion,
  WebResource,
  DifficultyLevel,
} from "@/lib/copilot-types";

// ============================================================================
// Main Copilot Page
// ============================================================================

export default function CopilotPage() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<CopilotPipelineState>({
    step: "idle",
    query: "",
    searchResults: [],
    syllabus: null,
    roadmap: null,
    expandedTopics: {},
  });

  // ---- Run full pipeline ----
  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;

    setState((s) => ({
      ...s,
      step: "searching",
      query: q,
      searchResults: [],
      syllabus: null,
      roadmap: null,
      expandedTopics: {},
      error: undefined,
    }));

    try {
      const res = await fetch("/api/copilot/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });

      const data = await res.json();

      if (!data.success) {
        setState((s) => ({
          ...s,
          step: "error",
          error: data.error || "Search failed",
        }));
        return;
      }

      setState((s) => ({
        ...s,
        step: "done",
        syllabus: data.syllabus,
        roadmap: data.roadmap,
      }));
    } catch (err: any) {
      setState((s) => ({
        ...s,
        step: "error",
        error: err.message || "Network error",
      }));
    }
  }, [query]);

  // ---- Expand a topic ----
  const handleExpand = useCallback(
    async (topic: RoadmapTopic) => {
      if (state.expandedTopics[topic.id] && !(state.expandedTopics[topic.id] as any)?.loading) return; // Already expanded

      setState((s) => ({
        ...s,
        expandedTopics: {
          ...s.expandedTopics,
          [topic.id]: { loading: true } as any,
        },
      }));

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout

        const res = await fetch("/api/copilot/expand", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic,
            subject: state.syllabus?.subject || state.query,
            university: state.syllabus?.university || "",
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        const data = await res.json();

        if (data.success) {
          setState((s) => ({
            ...s,
            expandedTopics: {
              ...s.expandedTopics,
              [topic.id]: data.expansion,
            },
          }));
        } else {
          setState((s) => ({
            ...s,
            expandedTopics: {
              ...s.expandedTopics,
              [topic.id]: {
                topicId: topic.id,
                topicName: topic.name,
                conceptOverview: `Failed to load: ${data.error || "Unknown error"}. Click the topic again to retry.`,
                examples: [],
                pastYearPatterns: "",
                articles: [],
                youtubeResources: [],
                academicReferences: [],
                generatedAt: new Date().toISOString(),
                _failed: true,
              } as any,
            },
          }));
        }
      } catch (err: any) {
        const errorMsg = err.name === "AbortError"
          ? "Request timed out. Click the topic again to retry."
          : `Network error: ${err.message}. Click the topic again to retry.`;

        setState((s) => ({
          ...s,
          expandedTopics: {
            ...s.expandedTopics,
            [topic.id]: {
              topicId: topic.id,
              topicName: topic.name,
              conceptOverview: errorMsg,
              examples: [],
              pastYearPatterns: "",
              articles: [],
              youtubeResources: [],
              academicReferences: [],
              generatedAt: new Date().toISOString(),
              _failed: true,
            } as any,
          },
        }));
      }
    },
    [state.expandedTopics, state.syllabus, state.query]
  );

  // ---- Build a practical project ----
  const [activeProject, setActiveProject] = useState<any>(null);
  const [isGeneratingProject, setIsGeneratingProject] = useState(false);

  const handleGenerateProject = useCallback(async (topicName: string) => {
    setIsGeneratingProject(true);
    setActiveProject(null);
    try {
      const res = await fetch("/api/copilot/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topicName, subject: state.syllabus?.subject || "" }),
      });
      const data = await res.json();
      if (data.success) {
        setActiveProject(data.project);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingProject(false);
    }
  }, [state.syllabus]);

  const isLoading = state.step === "searching" || state.step === "parsing" || state.step === "roadmap";

  return (
    <main className="main-content container-premium section-spacing">
      {/* Hero + Search */}
      <div className="hero-section copilot-hero-pb">
        <h1 className="hero-title copilot-hero-title">
          AI Academic Copilot
        </h1>
        <p className="hero-subtitle copilot-hero-subtitle">
          Enter a subject query like <strong>&quot;TOC, Semester 6, GTU&quot;</strong> — the system will find the official syllabus,
          build a study roadmap, and let you deep-dive into each topic with real resources.
        </p>
      </div>


      {/* Search Bar */}
      <div className="copilot-search-bar">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="e.g., TOC, Semester 6, GTU"
          className="copilot-search-input"
          disabled={isLoading}
        />
        <button
          onClick={handleSearch}
          disabled={isLoading || !query.trim()}
          className="copilot-search-btn"
        >
          {isLoading ? (
            <span className="copilot-spinner" />
          ) : (
            "🔍 Search & Build Roadmap"
          )}
        </button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="copilot-loading">
          <div className="copilot-loading-bar" />
          <p className="copilot-loading-text">
            {state.step === "searching" && "🔎 Analyzing your query and generating syllabus from academic knowledge..."}
            {state.step === "parsing" && "📄 Structuring syllabus into units, topics and subtopics..."}
            {state.step === "roadmap" && "🗺️ Building personalized study roadmap..."}
          </p>
          <p className="copilot-loading-hint">
            This may take 15-30 seconds — generating comprehensive syllabus data
          </p>
        </div>
      )}

      {/* Error */}
      {state.step === "error" && (
        <div className="copilot-error">
          <span>❌</span>
          <div>
            <strong>Something went wrong</strong>
            <p>{state.error}</p>
          </div>
        </div>
      )}

      {/* Syllabus Info */}
      {state.syllabus && state.step === "done" && (
        <SyllabusHeader syllabus={state.syllabus} roadmap={state.roadmap!} />
      )}

      {/* Roadmap Tree */}
      {state.roadmap && state.step === "done" && (
        <RoadmapTree
          roadmap={state.roadmap}
          expandedTopics={state.expandedTopics}
          onExpand={handleExpand}
          onGenerateProject={handleGenerateProject}
        />
      )}

      {/* Project Modal */}
      {(isGeneratingProject || activeProject) && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border shadow-2xl max-w-2xl w-full rounded-2xl p-8 relative animate-in zoom-in duration-300">
            <button
              onClick={() => { setActiveProject(null); setIsGeneratingProject(false); }}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-2"
            >✕</button>

            {isGeneratingProject ? (
              <div className="py-12 flex flex-col items-center">
                <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mb-6"></div>
                <h3 className="text-xl font-bold">Designing Your Project...</h3>
                <p className="text-muted-foreground text-center mt-2">
                  We're mapping theoretical concepts to a hands-on technical challenge.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl font-bold">🛠️</span>
                  <div>
                    <h2 className="text-2xl font-bold">{activeProject.title}</h2>
                    <div className="flex gap-2 mt-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded">
                        {activeProject.difficulty}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground px-2 py-0.5 rounded">
                        {activeProject.estimatedHours} Hours
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-muted-foreground leading-relaxed">
                  {activeProject.description}
                </p>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-bold text-sm mb-3 uppercase tracking-wider text-primary">Tech Stack</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {activeProject.techStack.map((s: string) => (
                        <span key={s} className="text-xs bg-muted px-2 py-1 rounded border">{s}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm mb-3 uppercase tracking-wider text-primary">Key Learning</h4>
                    <ul className="text-xs space-y-1 text-muted-foreground">
                      {activeProject.learningObjectives.map((o: string) => (
                        <li key={o}>• {o}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="font-bold text-sm mb-4 uppercase tracking-wider text-primary">Implementation Steps</h4>
                  <div className="space-y-3">
                    {activeProject.steps.map((step: string, i: number) => (
                      <div key={i} className="flex gap-3 items-start">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold mt-0.5">
                          {i + 1}
                        </span>
                        <p className="text-sm">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Schedule */}
      {state.roadmap &&
        state.roadmap.suggestedSchedule.length > 0 &&
        state.step === "done" && (
          <ScheduleView roadmap={state.roadmap} />
        )}
    </main>
  );
}

// ============================================================================
// Syllabus Header
// ============================================================================

function SyllabusHeader({
  syllabus,
  roadmap,
}: {
  syllabus: CopilotPipelineState["syllabus"];
  roadmap: StudyRoadmap;
}) {
  if (!syllabus) return null;

  return (
    <div className="copilot-syllabus-header">
      <div className="copilot-syllabus-meta">
        <h2>{syllabus.subject}</h2>
        <div className="copilot-syllabus-tags">
          <span className="copilot-tag copilot-tag-blue">{syllabus.university}</span>
          <span className="copilot-tag copilot-tag-purple">{syllabus.semester}</span>
          {syllabus.subjectCode && (
            <span className="copilot-tag copilot-tag-green">{syllabus.subjectCode}</span>
          )}
        </div>
      </div>
      <div className="copilot-stats-row">
        <StatCard label="Units" value={syllabus.units.length} icon="📦" />
        <StatCard label="Topics" value={syllabus.totalTopics} icon="📚" />
        <StatCard label="Est. Hours" value={roadmap.totalEstimatedHours} icon="⏱️" />
        <StatCard label="Schedule" value={`${roadmap.suggestedSchedule.length} days`} icon="📅" />
      </div>
      {roadmap.revisionStrategy && (
        <div className="copilot-revision-strategy">
          <strong>📋 Revision Strategy:</strong> {roadmap.revisionStrategy}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number | string; icon: string }) {
  return (
    <div className="copilot-stat-card">
      <span className="copilot-stat-icon">{icon}</span>
      <span className="copilot-stat-value">{value}</span>
      <span className="copilot-stat-label">{label}</span>
    </div>
  );
}

// ============================================================================
// Roadmap Tree
// ============================================================================

function RoadmapTree({
  roadmap,
  expandedTopics,
  onExpand,
  onGenerateProject,
}: {
  roadmap: StudyRoadmap;
  expandedTopics: Record<string, TopicExpansion | any>;
  onExpand: (topic: RoadmapTopic) => void;
  onGenerateProject?: (topicName: string) => void;
}) {
  const [openUnits, setOpenUnits] = useState<Set<string>>(
    new Set(roadmap.units.map((u) => u.id))
  );

  const toggleUnit = (id: string) => {
    setOpenUnits((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="copilot-roadmap">
      <h3 className="copilot-section-title">🗺️ Study Roadmap</h3>
      <div className="copilot-tree">
        {roadmap.units.map((unit) => (
          <UnitNode
            key={unit.id}
            unit={unit}
            isOpen={openUnits.has(unit.id)}
            onToggle={() => toggleUnit(unit.id)}
            expandedTopics={expandedTopics}
            onExpand={onExpand}
            onGenerateProject={onGenerateProject}
          />
        ))}
      </div>
    </div>
  );
}

function UnitNode({
  unit,
  isOpen,
  onToggle,
  expandedTopics,
  onExpand,
  onGenerateProject,
}: {
  unit: RoadmapUnit;
  isOpen: boolean;
  onToggle: () => void;
  expandedTopics: Record<string, TopicExpansion | any>;
  onExpand: (topic: RoadmapTopic) => void;
  onGenerateProject?: (topicName: string) => void;
}) {
  const hours = Math.round(unit.totalEstimatedMinutes / 60 * 10) / 10;

  return (
    <div className="copilot-unit-node">
      <div className="copilot-unit-header" onClick={onToggle}>
        <span className="copilot-unit-chevron">{isOpen ? "▼" : "▶"}</span>
        <span className="copilot-unit-badge">Unit {unit.unitNumber}</span>
        <span className="copilot-unit-title">{unit.title}</span>
        <span className="copilot-unit-meta">
          {unit.topics.length} topics · ~{hours}h
        </span>
      </div>
      {isOpen && (
        <div className="copilot-unit-topics">
          {unit.topics
            .sort((a, b) => a.recommendedOrder - b.recommendedOrder)
            .map((topic) => (
              <TopicNode
                key={topic.id}
                topic={topic}
                expansion={expandedTopics[topic.id]}
                onExpand={() => onExpand(topic)}
                onGenerateProject={onGenerateProject}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function TopicNode({
  topic,
  expansion,
  onExpand,
  onGenerateProject,
}: {
  topic: RoadmapTopic;
  expansion?: TopicExpansion | any;
  onExpand: () => void;
  onGenerateProject?: (topicName: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const isLoading = expansion?.loading === true;
  const hasExpansion = expansion && !expansion.loading;
  const hasFailed = expansion?._failed === true;

  const handleClick = () => {
    if (!hasExpansion && !isLoading) {
      onExpand();
    } else if (hasFailed) {
      // Allow retry on failed expansions
      onExpand();
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className="copilot-topic-node">
      <div className="copilot-topic-header" onClick={handleClick}>
        <span className="copilot-topic-chevron">
          {isLoading ? <span className="copilot-spinner-sm" /> : isOpen ? "▾" : "▸"}
        </span>
        <span className="copilot-topic-order">#{topic.recommendedOrder}</span>
        <span className="copilot-topic-name">{topic.name}</span>
        <DifficultyBadge level={topic.difficulty} />
        <span className="copilot-topic-time">{topic.estimatedMinutes}min</span>
        {hasFailed && <span className="copilot-retry-badge" title="Click to retry">🔄</span>}
      </div>

      {/* Subtopics (always visible when open) */}
      {isOpen && (
        <div className="copilot-topic-body">
          {topic.subtopics.length > 0 && (
            <div className="copilot-subtopics">
              {topic.subtopics.map((st, i) => (
                <span key={i} className="copilot-subtopic-chip">
                  {st.name}
                </span>
              ))}
            </div>
          )}

          {topic.prerequisites.length > 0 && (
            <p className="copilot-prereqs">
              <strong>Prerequisites:</strong> {topic.prerequisites.join(", ")}
            </p>
          )}

          {topic.revisionNotes && (
            <p className="copilot-revision-note">
              💡 {topic.revisionNotes}
            </p>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="copilot-topic-loading">
              <span className="copilot-spinner-sm" />
              Generating detailed explanation with resources... (may take 15-30s)
            </div>
          )}

          {/* Expanded Content */}
          {hasExpansion && !hasFailed && (
            <TopicExpansionView expansion={expansion} onGenerateProject={onGenerateProject} />
          )}

          {/* Failed State */}
          {hasFailed && (
            <div className="copilot-topic-error">
              <p>⚠️ {expansion.conceptOverview}</p>
              <button onClick={onExpand} className="copilot-retry-btn">
                🔄 Retry
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Topic Expansion View
// ============================================================================

function TopicExpansionView({ expansion, onGenerateProject }: { expansion: TopicExpansion, onGenerateProject?: (topicName: string) => void }) {
  const [activeTab, setActiveTab] = useState<"overview" | "resources" | "exam">("overview");

  return (
    <div className="copilot-expansion">
      <div className="copilot-expansion-tabs">
        {(["overview", "resources", "exam"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`copilot-exp-tab ${activeTab === tab ? "active" : ""}`}
          >
            {tab === "overview" && "📖 Overview"}
            {tab === "resources" && "🔗 Resources"}
            {tab === "exam" && "📝 Exam Patterns"}
          </button>
        ))}
        {onGenerateProject && (
          <button
            onClick={() => onGenerateProject(expansion.topicName)}
            className="copilot-exp-tab project-btn"
            style={{ marginLeft: 'auto', background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', fontWeight: 'bold' }}
          >
            🛠️ Build Project
          </button>
        )}
      </div>

      {activeTab === "overview" && (
        <div className="copilot-exp-content">
          <div className="copilot-concept-overview">
            {expansion.conceptOverview.split("\n").map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>

          {expansion.mathematicalExplanation && (
            <div className="copilot-math-section">
              <h4>🧮 Mathematical Explanation</h4>
              <div className="copilot-math-content">
                {expansion.mathematicalExplanation}
              </div>
            </div>
          )}

          {expansion.examples.length > 0 && (
            <div className="copilot-examples">
              <h4>💡 Examples</h4>
              {expansion.examples.map((ex, i) => (
                <div key={i} className="copilot-example-card">
                  <span className="copilot-example-num">#{i + 1}</span>
                  {ex}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "resources" && (
        <div className="copilot-exp-content">
          {expansion.articles.length > 0 && (
            <ResourceSection title="📰 Articles" resources={expansion.articles} />
          )}
          {expansion.youtubeResources.length > 0 && (
            <ResourceSection title="🎬 YouTube" resources={expansion.youtubeResources} />
          )}
          {expansion.academicReferences.length > 0 && (
            <ResourceSection title="🎓 Academic References" resources={expansion.academicReferences} />
          )}
          {expansion.articles.length === 0 &&
            expansion.youtubeResources.length === 0 &&
            expansion.academicReferences.length === 0 && (
              <p className="copilot-no-resources">No verified resources found for this topic.</p>
            )}
        </div>
      )}

      {activeTab === "exam" && (
        <div className="copilot-exp-content">
          <div className="copilot-exam-patterns">
            <h4>📝 Past Year Question Patterns</h4>
            <p>{expansion.pastYearPatterns}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ResourceSection({ title, resources }: { title: string; resources: WebResource[] }) {
  return (
    <div className="copilot-resource-section">
      <h4>{title}</h4>
      <div className="copilot-resource-list">
        {resources.map((r, i) => (
          <a
            key={i}
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`copilot-resource-card ${!r.verified ? "unverified" : ""}`}
          >
            <div className="copilot-resource-title">
              {r.type === "video" || r.type === "playlist" ? "🎬 " : r.type === "academic" ? "🎓 " : "📄 "}
              {r.title}
            </div>
            <div className="copilot-resource-url">{r.url}</div>
            {r.snippet && <div className="copilot-resource-snippet">{r.snippet}</div>}
            {!r.verified && <span className="copilot-unverified-badge">⚠️ Unverified</span>}
          </a>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Schedule View
// ============================================================================

function ScheduleView({ roadmap }: { roadmap: StudyRoadmap }) {
  const [showSchedule, setShowSchedule] = useState(false);

  return (
    <div className="copilot-schedule">
      <button
        className="copilot-schedule-toggle"
        onClick={() => setShowSchedule(!showSchedule)}
      >
        {showSchedule ? "▼" : "▶"} 📅 Suggested Study Schedule ({roadmap.suggestedSchedule.length} days)
      </button>
      {showSchedule && (
        <div className="copilot-schedule-grid">
          {roadmap.suggestedSchedule.map((block, i) => (
            <div
              key={i}
              className={`copilot-schedule-block copilot-schedule-${block.type}`}
            >
              <div className="copilot-schedule-day">{block.label}</div>
              <div className="copilot-schedule-type">
                {block.type === "study" && "📚"}
                {block.type === "revision" && "🔄"}
                {block.type === "practice" && "✏️"}
                {" "}{block.type}
              </div>
              <div className="copilot-schedule-time">{block.estimatedMinutes} min</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Utility Components
// ============================================================================

function DifficultyBadge({ level }: { level: DifficultyLevel }) {
  const colors: Record<DifficultyLevel, string> = {
    easy: "copilot-diff-easy",
    medium: "copilot-diff-medium",
    hard: "copilot-diff-hard",
  };
  return <span className={`copilot-diff-badge ${colors[level]}`}>{level}</span>;
}
