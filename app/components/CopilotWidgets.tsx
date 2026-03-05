"use client";

import React, { useState } from "react";
import type { StudyRoadmap, RoadmapUnit, RoadmapTopic, TopicExpansion, WebResource, DifficultyLevel } from "@/lib/copilot-types";

// ============================================================================
// Roadmap Tree
// ============================================================================

export function RoadmapTree({
    roadmap,
    expandedTopics,
    onExpand,
}: {
    roadmap: StudyRoadmap;
    expandedTopics: Record<string, TopicExpansion | any>;
    onExpand: (topic: RoadmapTopic) => void;
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
        <div className="copilot-roadmap" style={{ marginTop: '1rem', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '1rem', background: 'rgba(0,0,0,0.2)' }}>
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
}: {
    unit: RoadmapUnit;
    isOpen: boolean;
    onToggle: () => void;
    expandedTopics: Record<string, TopicExpansion | any>;
    onExpand: (topic: RoadmapTopic) => void;
}) {
    const hours = Math.round(unit.totalEstimatedMinutes / 60 * 10) / 10;

    return (
        <div className="copilot-unit-node">
            <div className="copilot-unit-header" onClick={onToggle} style={{ cursor: 'pointer', padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', marginBottom: '4px', display: 'flex', alignItems: 'center' }}>
                <span className="copilot-unit-chevron" style={{ marginRight: '8px' }}>{isOpen ? "▼" : "▶"}</span>
                <span className="copilot-unit-badge" style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', marginRight: '8px' }}>Unit {unit.unitNumber}</span>
                <span className="copilot-unit-title" style={{ fontWeight: 600, flex: 1 }}>{unit.title}</span>
                <span className="copilot-unit-meta" style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                    {unit.topics.length} topics · ~{hours}h
                </span>
            </div>
            {isOpen && (
                <div className="copilot-unit-topics" style={{ paddingLeft: '24px', marginBottom: '12px' }}>
                    {unit.topics
                        .sort((a, b) => a.recommendedOrder - b.recommendedOrder)
                        .map((topic) => (
                            <TopicNode
                                key={topic.id}
                                topic={topic}
                                expansion={expandedTopics[topic.id]}
                                onExpand={() => onExpand(topic)}
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
}: {
    topic: RoadmapTopic;
    expansion?: TopicExpansion | any;
    onExpand: () => void;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const isLoading = expansion?.loading === true;
    const hasExpansion = expansion && !expansion.loading;
    const hasFailed = expansion?._failed === true;

    const handleClick = () => {
        if (!hasExpansion && !isLoading) {
            onExpand();
        } else if (hasFailed) {
            onExpand();
        }
        setIsOpen(!isOpen);
    };

    return (
        <div className="copilot-topic-node" style={{ marginBottom: '4px' }}>
            <div className="copilot-topic-header" onClick={handleClick} style={{ cursor: 'pointer', padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', fontSize: '0.9rem' }}>
                <span className="copilot-topic-chevron" style={{ marginRight: '6px', width: '16px', display: 'inline-flex', justifyContent: 'center' }}>
                    {isLoading ? "⏳" : isOpen ? "▾" : "▸"}
                </span>
                <span className="copilot-topic-order" style={{ opacity: 0.5, marginRight: '8px' }}>#{topic.recommendedOrder}</span>
                <span className="copilot-topic-name" style={{ flex: 1 }}>{topic.name}</span>
                <DifficultyBadge level={topic.difficulty} />
                <span className="copilot-topic-time" style={{ fontSize: '0.7rem', opacity: 0.6, marginLeft: '8px' }}>{topic.estimatedMinutes}m</span>
                {hasFailed && <span style={{ marginLeft: '8px' }}>🔄</span>}
            </div>

            {isOpen && (
                <div className="copilot-topic-body" style={{ padding: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', marginTop: '4px', borderLeft: '2px solid rgba(255,255,255,0.1)' }}>
                    {topic.subtopics.length > 0 && (
                        <div className="copilot-subtopics" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                            {topic.subtopics.map((st, i) => (
                                <span key={i} style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '10px', background: 'rgba(255,255,255,0.1)', opacity: 0.8 }}>
                                    {st.name}
                                </span>
                            ))}
                        </div>
                    )}

                    {topic.revisionNotes && (
                        <p className="copilot-revision-note" style={{ fontSize: '0.8rem', opacity: 0.7, fontStyle: 'italic' }}>
                            💡 {topic.revisionNotes}
                        </p>
                    )}

                    {isLoading && (
                        <div style={{ fontSize: '0.8rem', opacity: 0.5, padding: '8px' }}>
                            Generating detailed explanation...
                        </div>
                    )}

                    {hasExpansion && !hasFailed && <TopicExpansionView expansion={expansion} />}

                    {hasFailed && (
                        <div style={{ padding: '8px', color: '#f87171', fontSize: '0.8rem' }}>
                            <p>⚠️ Failed to load details. Click to retry.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function TopicExpansionView({ expansion }: { expansion: TopicExpansion }) {
    const [activeTab, setActiveTab] = useState<"overview" | "resources" | "exam">("overview");

    return (
        <div className="copilot-expansion" style={{ marginTop: '8px' }}>
            <div className="copilot-expansion-tabs" style={{ display: 'flex', gap: '4px', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {(["overview", "resources", "exam"] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: activeTab === tab ? '#818cf8' : 'inherit',
                            opacity: activeTab === tab ? 1 : 0.5,
                            padding: '4px 8px',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            borderBottom: activeTab === tab ? '2px solid #818cf8' : 'none'
                        }}
                    >
                        {tab === "overview" && "📖 Overview"}
                        {tab === "resources" && "🔗 Resources"}
                        {tab === "exam" && "📝 Exam"}
                    </button>
                ))}
            </div>

            <div style={{ fontSize: '0.85rem', lineHeight: 1.5 }}>
                {activeTab === "overview" && (
                    <div>
                        {expansion.conceptOverview.split("\n").map((p, i) => (
                            <p key={i} style={{ marginBottom: '8px' }}>{p}</p>
                        ))}
                    </div>
                )}

                {activeTab === "resources" && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {expansion.youtubeResources.map((r, i) => (
                            <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', padding: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', textDecoration: 'none', color: 'inherit' }}>
                                🎬 {r.title}
                            </a>
                        ))}
                        {expansion.articles.map((r, i) => (
                            <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', padding: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', textDecoration: 'none', color: 'inherit' }}>
                                📄 {r.title}
                            </a>
                        ))}
                    </div>
                )}

                {activeTab === "exam" && (
                    <p>{expansion.pastYearPatterns}</p>
                )}
            </div>
        </div>
    );
}

function DifficultyBadge({ level }: { level: DifficultyLevel }) {
    const colors: Record<DifficultyLevel, string> = {
        easy: "#10b981",
        medium: "#f59e0b",
        hard: "#ef4444",
    };
    return <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: '4px', border: `1px solid ${colors[level]}`, color: colors[level], textTransform: 'uppercase' }}>{level}</span>;
}
