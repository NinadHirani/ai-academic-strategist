
"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";

interface ChatPanelProps {
  activeMode: "study" | "deepExplore";
  documents?: Array<{
    id: string;
    name: string;
    type: string;
    status: "ready" | "processing" | "error";
    chunkCount?: number;
  }>;
}

interface ChatSession {
  id: string;
  title: string;
  mode: string;
  updatedAt: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
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
  { label: "Explain this concept", emoji: "💡" },
  { label: "Create a quiz", emoji: "✏️" },
  { label: "Generate flashcards", emoji: "🗂️" },
  { label: "Summarize this", emoji: "📝" },
];

export default function ChatPanel({ activeMode, documents = [] }: ChatPanelProps) {
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch past chats on mount
  useEffect(() => {
    fetchPastChats();
  }, []);

  const fetchPastChats = async () => {
    try {
      const response = await fetch("/api/chat/sessions?userId=anonymous&limit=100");
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

  // Format date for display
  const formatChatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const dateStr = date.toDateString();
      const nowStr = now.toDateString();
      
      if (dateStr === nowStr) return "Today";
      
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      if (dateStr === yesterday.toDateString()) return "Yesterday";
      
      const diffTime = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays < 7) {
        return date.toLocaleDateString("en-US", { weekday: "short" });
      }
      
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {
      return dateString;
    }
  };

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

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: userMessage.content, 
          mode: activeMode,
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

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message,
        timestamp: new Date(),
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
            className="new-chat-btn"
            onClick={() => {
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

      <div className="chat-messages">
        {isWelcomeMessage ? (
          <div className="welcome-message">
            <div className="welcome-icon">🧠</div>
            <h3 className="welcome-title">AI Academic Strategist</h3>
            <p className="welcome-subtitle">
              {activeMode === "study" 
                ? "I'll help you study smarter with exam-focused insights" 
                : "I'll help you explore topics in depth with structured research"}
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
                {message.role === "user" ? "👤" : "✨"}
              </div>
              <div className="message-content">
                {shouldRenderDeepExplore(message) ? (
                  <DeepExploreResponse content={message.content} />
                ) : (
                  <MarkdownResponse content={message.content} />
                )}
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
          <input
            type="text"
            className="chat-input"
            placeholder={content.placeholder}
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


