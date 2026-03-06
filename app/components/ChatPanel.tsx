"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { RoadmapTree } from "./CopilotWidgets";
import { PromptBlock } from "./PromptWidgets";
import MentorPopup from "./MentorPopup";
import type { RoadmapTopic, TopicExpansion } from "@/lib/copilot-types";
import { deleteDocument } from "@/lib/documents";
import { DEFAULT_USER_ID } from "@/lib/config";
import type { ChatMode, UploadedDocument } from "@/lib/types";
import { formatChatDate } from "@/lib/utils";

interface ChatSession {
  id: string;
  title: string;
  mode: ChatMode;
  updatedAt: string;
}

interface ChatPanelProps {
  activeMode: ChatMode;
  documents?: UploadedDocument[];
  onRequestUpload?: () => void;
  onClearDocuments?: () => void | Promise<void>;
  onDocumentsChange?: (docs: UploadedDocument[]) => void;
}

interface SourceInfo {
  documentName: string;
  chunkIndex: number;
  score: number;
}

interface ToolResultInfo {
  tool: string;
  label: string;
  emoji: string;
  data?: any;
  error?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: SourceInfo[];
  hasDocuments?: boolean;
  toolResult?: ToolResultInfo;
}

interface Section {
  title: string;
  content: string;
  icon: string;
  isSpecial?: boolean;
}

const modeContent = {
  study: {
    title: "Study Mode",
    description: "Your AI study assistant is ready to help",
    placeholder: "Ask anything about your studies...",
    icon: "📚",
    features: ["Flashcard generation", "Quiz creation", "Concept explanations", "Study planning"],
  },
  deepExplore: {
    title: "DeepExplore",
    description: "Dive deep into academic research and complex topics",
    placeholder: "Explore any topic in depth...",
    icon: "🌐",
    features: ["Research synthesis", "Topic deep-dives", "Literature insights", "Advanced concepts"],
  },
};

const sectionIcons: Record<string, string> = {
  "Concept Overview": "💡",
  "Key Principles": "🔑",
  "Related Topics": "🔗",
  "Common Confusions": "⚠️",
  "Practical Applications": "🎯",
  "Exam Relevance": "📝",
  "Introduction": "📖",
};

// Enhanced markdown parser for rendering formatted text
function parseMarkdown(content: string): string {
  let html = content;

  // Mermaid diagrams - preserve as pre-formatted code block
  html = html.replace(/```mermaid\n?([\s\S]*?)```/g, '<pre class="mermaid-diagram"><code class="language-mermaid">$1</code></pre>');

  // Regular code blocks
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Markdown tables - convert to HTML table
  const tableRegex = /(\|.+\|)\n(\|[-:\s|]+\|)\n((?:\|.+\|\n?)+)/g;
  html = html.replace(tableRegex, (match) => {
    const rows = match.trim().split('\n');
    if (rows.length < 2) return match;

    let tableHtml = '<table>';

    // Header row
    const headerCells = rows[0].split('|').filter(c => c.trim());
    tableHtml += '<thead><tr>';
    for (const cell of headerCells) {
      tableHtml += `<th>${cell.trim()}</th>`;
    }
    tableHtml += '</tr></thead>';

    // Body rows (skip separator)
    tableHtml += '<tbody>';
    for (let i = 2; i < rows.length; i++) {
      const cells = rows[i].split('|').filter(c => c.trim());
      tableHtml += '<tr>';
      for (const cell of cells) {
        tableHtml += `<td>${cell.trim()}</td>`;
      }
      tableHtml += '</tr>';
    }
    tableHtml += '</tbody></table>';

    return tableHtml;
  });

  // Bullet points
  html = html.replace(/^• (.+)$/gm, '<li>$1</li>');
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Wrap consecutive <li> elements in <ul>
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  // Line breaks
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br/>');

  // Wrap in paragraph
  html = '<p>' + html + '</p>';

  // Clean up
  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p><br\/>/g, '<p>');
  html = html.replace(/<br\/><\/p>/g, '</p>');
  html = html.replace(/<p>(<h[123]>)/g, '$1');
  html = html.replace(/(<\/h[123]>)<\/p>/g, '$1');
  html = html.replace(/<p>(<pre)/g, '$1');
  html = html.replace(/(<\/pre>)<\/p>/g, '$1');
  html = html.replace(/<p>(<table)/g, '$1');
  html = html.replace(/(<\/table>)<\/p>/g, '$1');
  html = html.replace(/<p>(<ul>)/g, '$1');
  html = html.replace(/(<\/ul>)<\/p>/g, '$1');

  return html;
}

// Render markdown formatted response
function MarkdownResponse({ content }: { content: string }) {
  const html = useMemo(() => parseMarkdown(content), [content]);

  return (
    <div
      className="markdown-content"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function isDeepExploreResponse(content: string): boolean {
  const deepExploreSections = [
    "## Concept Overview",
    "## Key Principles",
    "## Related Topics",
    "## Common Confusions",
    "## Practical Applications",
    "## Exam Relevance",
  ];
  return deepExploreSections.some(section => content.includes(section));
}

function parseDeepExploreResponse(content: string): Section[] {
  const sections: Section[] = [];
  const parts = content.split(/(?=## )/g);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const match = trimmed.match(/^##\s*(.+?)(?:\n|$)([\s\S]*)$/);
    if (match) {
      const title = match[1].trim();
      let sectionContent = match[2].trim();
      sectionContent = sectionContent.replace(/^##\s*.+$/gm, '').trim();

      const icon = sectionIcons[title] || "📄";
      const isSpecial = title === "Exam Relevance" || title === "Common Confusions";

      sections.push({ title, content: sectionContent, icon, isSpecial });
    } else if (sections.length === 0 && !trimmed.startsWith("##")) {
      sections.push({ title: "Introduction", content: trimmed, icon: "📖" });
    }
  }

  return sections;
}

function DeepExploreResponse({ content }: { content: string }) {
  const sections = useMemo(() => parseDeepExploreResponse(content), [content]);

  return (
    <div className="deep-explore-response">
      {sections.map((section, index) => (
        <div
          key={index}
          className={`deep-explore-section ${section.isSpecial ? section.title === "Exam Relevance" ? "exam-relevance" : "common-confusions" : ""}`}
        >
          <div className="deep-explore-section-header">
            <span>{section.icon}</span>
            <span>{section.title}</span>
          </div>
          <div
            className="deep-explore-section-content"
            dangerouslySetInnerHTML={{
              __html: parseMarkdown(section.content)
            }}
          />
        </div>
      ))}
    </div>
  );
}

const quickActions = [
  { label: "Build an exam prompt", emoji: "🎯" },
  { label: "Explain this concept", emoji: "💡" },
  { label: "ELI5 this paper", emoji: "👶" },
  { label: "Create a quiz", emoji: "✏️" },
];

export default function ChatPanel({ activeMode, documents = [], onRequestUpload, onClearDocuments, onDocumentsChange }: ChatPanelProps) {
  const content = modeContent[activeMode];
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "welcome",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pastChats, setPastChats] = useState<ChatSession[]>([]);
  const [showPastChats, setShowPastChats] = useState(false);
  const [showAllChats, setShowAllChats] = useState(false);
  const [showDocList, setShowDocList] = useState(false);
  const [showMentorPopup, setShowMentorPopup] = useState(false);
  const [expandedTopics, setExpandedTopics] = useState<Record<string, TopicExpansion | any>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch past chats on mount
  useEffect(() => {
    fetchPastChats();
  }, []);

  const fetchPastChats = async () => {
    try {
      const response = await fetch(`/api/chat/sessions?userId=${encodeURIComponent(DEFAULT_USER_ID)}&limit=100`);
      const data = await response.json();
      if (data.success && data.sessions) {
        setPastChats(data.sessions);
      }
    } catch (error) {
      console.error("[ChatPanel] Error fetching past chats:", error);
    }
  };

  // Handle selecting a past chat session
  const handleSessionSelect = async (selectedSessionId: string) => {
    // Clear uploaded documents when switching to a past chat
    if (onClearDocuments) await onClearDocuments();

    setSessionId(selectedSessionId);
    setShowPastChats(false);

    // Show loading state
    setMessages([
      {
        id: "loading",
        role: "assistant",
        content: "Loading conversation...",
        timestamp: new Date(),
      },
    ]);

    try {
      const response = await fetch(`/api/chat/history?sessionId=${encodeURIComponent(selectedSessionId)}`);
      const data = await response.json();

      if (data.success && data.messages && data.messages.length > 0) {
        const loadedMessages: Message[] = data.messages.map((msg: any) => ({
          id: msg.id,
          role: msg.role as "user" | "assistant",
          content: msg.content,
          timestamp: new Date(msg.createdAt),
        }));

        setMessages(loadedMessages);
      } else {
        setMessages([
          {
            id: "empty",
            role: "assistant",
            content: "This conversation is empty. Start chatting!",
            timestamp: new Date(),
          },
        ]);
      }
    } catch (error) {
      console.error("[ChatPanel] Error loading past session:", error);
      setMessages([
        {
          id: "error",
          role: "assistant",
          content: "Failed to load conversation. Please try again.",
          timestamp: new Date(),
        },
      ]);
    }
  };

  const handleExpandTopic = useCallback(async (topic: RoadmapTopic, subject: string) => {
    if (expandedTopics[topic.id] && !(expandedTopics[topic.id] as any)?.loading) return;

    setExpandedTopics((prev) => ({
      ...prev,
      [topic.id]: { loading: true },
    }));

    try {
      const res = await fetch("/api/copilot/expand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          subject: subject,
          university: "",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setExpandedTopics((prev) => ({
          ...prev,
          [topic.id]: data.expansion,
        }));
      } else {
        setExpandedTopics((prev) => ({
          ...prev,
          [topic.id]: { _failed: true },
        }));
      }
    } catch (err) {
      setExpandedTopics((prev) => ({
        ...prev,
        [topic.id]: { _failed: true },
      }));
    }
  }, [expandedTopics]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (preset?: string) => {
    const messageText = preset || inputValue.trim();
    if (!messageText || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: messageText,
      timestamp: new Date(),
    };

    setMessages((prev) => prev.filter(m => m.id !== "welcome"));
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    const isELI5 = messageText.toLowerCase().includes("eli5");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: isELI5 ? `ELI5: ${messageText.replace(/eli5/i, "").trim()}` : messageText,
          mode: activeMode,
          useRag: true,
          sessionId: sessionId || undefined
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get response");
      }

      const data = await response.json();

      // Update session ID if it's a new session
      if (data.sessionId && !sessionId) {
        setSessionId(data.sessionId);
        fetchPastChats(); // Refresh past chats list when new session is created
      }

      // Build sources list from retrieval metadata
      const responseSources: SourceInfo[] = data.retrieval?.sources || [];

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message,
        timestamp: new Date(),
        sources: responseSources.length > 0 ? responseSources : undefined,
        hasDocuments: data.hasDocuments,
        toolResult: data.toolResult ? {
          ...data.toolResult,
          data: data.toolResult.data
        } : undefined,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: error instanceof Error ? `Error: ${error.message}` : "Sorry, something went wrong. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  };

  const shouldRenderDeepExplore = (msg: Message) => {
    return msg.role === "assistant" && isDeepExploreResponse(msg.content);
  };

  const isWelcomeMessage = messages.length === 1 && messages[0].id === "welcome";

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="chat-header-left">
          <div className="chat-header-icon">{content.icon}</div>
          <div className="chat-title-group">
            <h2 className="chat-title">{content.title}</h2>
            <p className="chat-description">{content.description}</p>
          </div>
        </div>
        <div className="chat-actions">
          <button
            className="mentor-popup-btn"
            onClick={() => setShowMentorPopup(true)}
            title="Open mentor assistant"
          >
            🧘 Mentor
          </button>
          {/* Document status badge */}
          {documents.length > 0 && (
            <div
              className="doc-status-badge"
              title={`${documents.filter(d => d.status === "ready").length} document(s) loaded for Q&A`}
              onClick={() => setShowDocList(!showDocList)}
            >
              <span className="doc-badge-icon">📚</span>
              <span className="doc-badge-count">{documents.filter(d => d.status === "ready").length}</span>
              <span className="doc-badge-label">docs loaded</span>
            </div>
          )}
          <button
            className="new-chat-btn"
            onClick={async () => {
              if (onClearDocuments) await onClearDocuments();
              setMessages([
                {
                  id: "welcome",
                  role: "assistant",
                  content: "welcome",
                  timestamp: new Date(),
                },
              ]);
              setSessionId(null);
              fetchPastChats(); // Refresh the past chats list
            }}
            title="Start new chat"
          >
            ✨ New Chat
          </button>
          <div className="past-chats-dropdown">
            <button
              className="past-chats-btn"
              onClick={() => setShowPastChats(!showPastChats)}
              title="View past chats"
            >
              📜 Past Chats
            </button>
            {showPastChats && (
              <div className="past-chats-menu">
                <div className="past-chats-header">
                  <span>Your Chats</span>
                </div>
                <div className="past-chats-list">
                  {pastChats.length === 0 ? (
                    <div className="no-chats">No past chats yet</div>
                  ) : (
                    <>
                      {(showAllChats ? pastChats : pastChats.slice(0, 3)).map((chat) => (
                        <div
                          key={chat.id}
                          className={`past-chat-item ${sessionId === chat.id ? "active" : ""}`}
                          onClick={() => handleSessionSelect(chat.id)}
                        >
                          <span className="past-chat-icon">{chat.mode === "deepExplore" ? "🌐" : "📚"}</span>
                          <div className="past-chat-info">
                            <span className="past-chat-title">{chat.title}</span>
                            <span className="past-chat-date">{formatChatDate(chat.updatedAt)}</span>
                          </div>
                        </div>
                      ))}
                      {pastChats.length > 3 && (
                        <button
                          className="show-more-btn"
                          onClick={() => setShowAllChats(!showAllChats)}
                        >
                          {showAllChats ? "Show less" : `Show more (${pastChats.length - 3} more)`}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <MentorPopup
        isOpen={showMentorPopup}
        onClose={() => setShowMentorPopup(false)}
        messages={messages.map((m) => ({
          role: m.role,
          content: m.content,
          toolResult: m.toolResult,
        }))}
      />

      {showDocList && (
        <div className="doc-list-panel-overlay" onClick={() => setShowDocList(false)} />
      )}
      {showDocList && (
        <div className="doc-list-panel">
          <h4>Your uploaded documents</h4>
          {documents.length === 0 ? (
            <p>No files uploaded.</p>
          ) : (
            <ul>
              {documents.map((doc) => (
                <li key={doc.id} className="doc-list-item">
                  <span>{doc.name}</span>
                  <button
                    className="doc-list-delete"
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        await deleteDocument(doc.id);
                        const updated = documents.filter((d) => d.id !== doc.id);
                        onDocumentsChange?.(updated);
                      } catch (err) {
                        console.error('delete doc', err);
                      }
                    }}
                  >
                    🗑️
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button onClick={() => setShowDocList(false)} className="close-doc-list">Close</button>
        </div>
      )}
      <div className="chat-messages">
        {isWelcomeMessage ? (
          <div className="welcome-message">
            <div className="welcome-icon">🧠</div>
            <h3 className="welcome-title">AI Academic Strategist</h3>
            <p className="welcome-subtitle">
              {activeMode === "study"
                ? "Generate study roadmaps, build exam prompts, or ask academic questions."
                : "I'll help you explore topics in depth with structured research."}
            </p>
            <div className="quick-actions">
              {quickActions.map((action, i) => (
                <button key={i} className="quick-action-btn" onClick={() => handleSendMessage(action.label)}>
                  {action.emoji} {action.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`message ${message.role === "user" ? "user-message" : "bot-message"} ${shouldRenderDeepExplore(message) ? "deep-explore-mode" : ""}`}
            >
              <div className="message-avatar">
                {message.role === "user" ? "U" : "AI"}
              </div>
              <div className="message-content">
                {message.toolResult && (
                  <div className="tool-result-badge" style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 12px',
                    marginBottom: '8px',
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    background: message.toolResult.error
                      ? 'rgba(239, 68, 68, 0.15)'
                      : 'rgba(99, 102, 241, 0.15)',
                    color: message.toolResult.error
                      ? '#f87171'
                      : '#818cf8',
                    border: `1px solid ${message.toolResult.error ? 'rgba(239, 68, 68, 0.3)' : 'rgba(99, 102, 241, 0.3)'}`,
                  }}>
                    <span>{message.toolResult.emoji}</span>
                    <span>{message.toolResult.label}</span>
                  </div>
                )}
                {shouldRenderDeepExplore(message) ? (
                  <DeepExploreResponse content={message.content} />
                ) : (
                  <MarkdownResponse content={message.content} />
                )}

                {/* Rich Tool Widgets */}
                {message.toolResult?.tool === "generate_roadmap" && message.toolResult.data?.roadmap && (
                  <RoadmapTree
                    roadmap={message.toolResult.data.roadmap}
                    expandedTopics={expandedTopics}
                    onExpand={(topic) => handleExpandTopic(topic, message.toolResult?.data?.syllabus?.subject || "Subject")}
                  />
                )}

                {message.toolResult?.tool === "build_exam_prompt" && message.toolResult.data?.prompt && (
                  <PromptBlock
                    prompt={message.toolResult.data.prompt}
                    topic={message.toolResult.data.topic}
                    onUse={(p) => setInputValue(p)}
                  />
                )}

                {/* Source Citations */}
                {message.sources && message.sources.length > 0 && (() => {
                  // group by documentName
                  const groups: Record<string, Array<{ chunkIndex: number; score: number }>> = {};
                  message.sources.forEach(s => {
                    const name = s.documentName.replace(/\s+\(\d+\)/g, '') // remove trailing (1) etc
                      .replace(/\(SPECIAL\)/i, '')
                      .trim();
                    if (!groups[name]) groups[name] = [];
                    // avoid duplicates
                    if (!groups[name].some(c => c.chunkIndex === s.chunkIndex)) {
                      groups[name].push({ chunkIndex: s.chunkIndex, score: s.score });
                    }
                  });
                  const docNames = Object.keys(groups);
                  return (
                    <div className="source-citations">
                      <div className="source-citations-header">
                        <span className="source-icon">📎</span>
                        <span>Sources ({docNames.length})</span>
                      </div>
                      <div className="source-citations-list">
                        {docNames.map((doc, di) => (
                          <div key={di} className="source-citation-group">
                            <div className="source-citation-title">
                              <span className="source-doc-icon">📄</span>
                              <span className="source-doc-name">{doc}</span>
                            </div>
                            <div className="source-citation-items">
                              {groups[doc].map((item, idx2) => (
                                <div key={idx2} className="source-citation-item">
                                  <span className="source-chunk-badge">Section {item.chunkIndex + 1}</span>
                                  <span className="source-score">{(item.score * 100).toFixed(0)}% match</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                <div className="message-time">{formatTime(message.timestamp)}</div>
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="message bot-message">
            <div className="message-avatar">✨</div>
            <div className="message-content">
              <div className="typing-indicator">
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        <div className="chat-input-wrapper">
          <button
            className="attach-btn"
            onClick={() => onRequestUpload?.()}
            title="Upload documents for Q&A"
            type="button"
          >
            <span style={{ fontSize: '1.2rem', opacity: 0.7 }}>⊕</span>
          </button>
          <input
            type="text"
            className="chat-input"
            placeholder={documents && documents.length > 0 ? `Ask about your ${documents.filter(d => d.status === "ready").length} uploaded doc(s)...` : content.placeholder}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={isLoading}
          />
        </div>
        <button
          className="send-btn"
          onClick={() => handleSendMessage()}
          disabled={isLoading || !inputValue.trim()}
        >
          {isLoading ? <span className="loading-spinner"></span> : "↑"}
        </button>
      </div>
    </div>
  );
}
