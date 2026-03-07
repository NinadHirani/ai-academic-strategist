"use client";

import React from "react";

interface PromptWidgetProps {
    prompt: string;
    topic: string;
    onUse: (prompt: string) => void;
}

export function PromptBlock({ prompt, topic, onUse }: PromptWidgetProps) {
    return (
        <div className="prompt-widget-block" style={{
            marginTop: '1rem',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '12px',
            padding: '1rem',
            background: 'rgba(139, 92, 246, 0.1)',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>🎯</span> Exam Prompt for {topic}
                </h4>
                <button
                    onClick={() => onUse(prompt)}
                    style={{
                        background: '#8b5cf6',
                        color: 'white',
                        border: 'none',
                        padding: '4px 12px',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#7c3aed'}
                    onMouseOut={(e) => e.currentTarget.style.background = '#8b5cf6'}
                >
                    Use Prompt
                </button>
            </div>

            <div style={{
                background: 'rgba(0,0,0,0.3)',
                padding: '0.75rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                lineHeight: 1.5,
                border: '1px solid rgba(255,255,255,0.05)',
                color: 'rgba(255,255,255,0.9)',
                fontStyle: 'italic'
            }}>
                "{prompt}"
            </div>

            <p style={{ marginTop: '0.75rem', marginBottom: 0, fontSize: '0.75rem', opacity: 0.6 }}>
                Click <strong>Use Prompt</strong> to paste this into the chat and start your session.
            </p>
        </div>
    );
}
