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

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

// Chat history session type
interface ChatSession {
  id: string;
  title: string;
  updatedAt: string;
  mode: string;
}

interface Section {
  title: string;
  content: string;
  icon: string;
  isSpecial?: boolean;
}

const modeContent = {
  study: {
    title: "📚 Study Mode",
    description: "Your AI study assistant is ready to help you learn effectively.",
    placeholder: "Ask me anything about your studies...",
    features: ["Flashcard generation", "Quiz creation", "Concept explanations", "Study planning"],
  },
  deepExplore: {
    title: "🌐 DeepExplore Mode",
    description: "Dive deep into academic research and complex topics.",
    placeholder: "Explore any topic in depth...",
    features: ["Research synthesis", "Topic deep-dives", "Literature insights", "Advanced concepts"],
  },
};

// Section icons mapping
const sectionIcons: Record<string, string> = {
  "Concept Overview": "💡",
  "Key Principles": "🔑",
  "Related Topics": "🔗",
  "Common Confusions": "⚠️",
  "Practical Applications": "🎯",
  "Exam Relevance": "📝",
};

// Simple markdown parser for rendering formatted text
function parseMarkdown(content: string): string {
  let html = content;
  
  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  
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

// Check if content appears to be a DeepExplore structured response
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

// Parse DeepExplore response into structured sections
function parseDeepExploreResponse(content: string): Section[] {
  const sections: Section[] = [];
  
  // Split by ## headers
  const parts = content.split(/(?=## )/g);
  
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    
    // Extract title and content
    const match = trimmed.match(/^##\s*(.+?)(?:\n|$)([\s\S]*)$/);
    if (match) {
      const title = match[1].trim();
      let sectionContent = match[2].trim();
      
      // Clean up the content - remove any leading ## headers within content
      sectionContent = sectionContent.replace(/^##\s*.+$/gm, '').trim();
      
      const icon = sectionIcons[title] || "📄";
      const isSpecial = title === "Exam Relevance" || title === "Common Confusions";
      
      sections.push({
        title,
        content: sectionContent,
        icon,
        isSpecial,
      });
    } else if (sections.length === 0 && !trimmed.startsWith("##")) {
      // Content before first ## header - treat as introduction
      sections.push({
        title: "Introduction",
        content: trimmed,
        icon: "📖",
      });
    }
  }
  
  return sections;
}

// Render DeepExplore formatted response
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
            <span className="section-icon">{section.icon}</span>
            <span>{section.title}</span>
          </div>
          <div 
            className="deep-explore-section-content"
            dangerouslySetInnerHTML={{ 
              __html: section.content
                .replace(/\n/g, '<br/>')
                .replace(/•\s*/g, '<li>')
                .replace(/(<li>.*?)(<br\/>|$)/g, '$1</li>$2')
            }}
          />
        </div>
      ))}
    </div>
  );
}

export default function ChatPanel({ activeMode, documents = [] }: ChatPanelProps) {
  const content = modeContent[activeMode];
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: `Hello! I'm your AI Academic Strategist.\n${activeMode === "study" ? "Ready to help you with your studies!" : "Ready to explore complex topics with you!"}`,
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
  
  // Format date for display - simple and accurate using local time
  const formatChatDate = (dateString: string) => {
    try {
      // Parse as local time (browser will handle timezone)
      const date = new Date(dateString);
      const now = new Date();
      
      // Get date strings for comparison (ignores time)
      const dateStr = date.toDateString();
      const nowStr = now.toDateString();
      
      // Check if it's today
      if (dateStr === nowStr) {
        return "Today";
      }
      
      // Check if it's yesterday
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      if (dateStr === yesterday.toDateString()) {
        return "Yesterday";
      }
      
      // Check if within the last week
      const diffTime = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays < 7) {
        return date.toLocaleDateString("en-US", { weekday: "short" });
      }
      
      // Otherwise show date
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {
      // Fallback for invalid dates
      return dateString;
    }
  };

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

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const requestBody: {
        message: string;
        mode: string;
        sessionId?: string | null;
      } = {
        message: userMessage.content,
        mode: activeMode,
      };

      // Add sessionId if available
      if (sessionId) {
        requestBody.sessionId = sessionId;
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get response");
      }

      const data = await response.json();

      // Update sessionId from response if provided
      if (data.sessionId && !sessionId) {
        setSessionId(data.sessionId);
        console.log("[ChatPanel] New session created:", data.sessionId);
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
        content: error instanceof Error 
          ? `Error: ${error.message}` 
          : "Sorry, something went wrong. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Start a new chat - creates new session immediately
  const handleNewChat = async () => {
    // Create a new session immediately
    try {
      const response = await fetch("/api/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "anonymous", mode: activeMode }),
      });
      const data = await response.json();
      if (data.success && data.session) {
        setSessionId(data.session.id);
        fetchPastChats();
      }
    } catch (error) {
      console.error("[ChatPanel] Error creating session:", error);
    }
    
    setMessages([
      {
        id: Date.now().toString(),
        role: "assistant",
        content: `Hello! I'm your AI Academic Strategist.\n${activeMode === "study" ? "Ready to help you with your studies!" : "Ready to explore complex topics with you!"}`,
        timestamp: new Date(),
      },
    ]);
  };

  // Handle selecting a past chat session
  const handleSessionSelect = async (selectedSessionId: string) => {
    setSessionId(selectedSessionId);
    console.log("[ChatPanel] Loading past session:", selectedSessionId);
    
    // Set loading state
    setMessages([
      {
        id: "loading",
        role: "assistant",
        content: "Loading past conversation...",
        timestamp: new Date(),
      },
    ]);
    
    try {
      // Fetch past messages for this session
      const response = await fetch(`/api/chat/history?sessionId=${encodeURIComponent(selectedSessionId)}`);
      const data = await response.json();
      
      if (data.success && data.messages && data.messages.length > 0) {
        // Convert API messages to component messages
        const loadedMessages: Message[] = data.messages.map((msg: any) => ({
          id: msg.id,
          role: msg.role as "user" | "assistant",
          content: msg.content,
          timestamp: new Date(msg.createdAt),
        }));
        
        setMessages(loadedMessages);
        console.log("[ChatPanel] Loaded", loadedMessages.length, "messages from past session");
      } else {
        // No messages found
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
          content: "Failed to load past conversation. Please try again.",
          timestamp: new Date(),
        },
      ]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (date: Date) => {
    // Use 24-hour format to avoid hydration mismatch
    return date.toLocaleTimeString("en-GB", { 
      hour: "2-digit", 
      minute: "2-digit",
      hour12: false 
    });
  };

  // Determine if a message should be rendered as DeepExplore format
  const shouldRenderDeepExplore = (msg: Message) => {
    return msg.role === "assistant" && isDeepExploreResponse(msg.content);
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="chat-header-top">
          <h2 className="chat-title">{content.title}</h2>
          <div className="chat-actions">
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
        <p className="chat-description">{content.description}</p>
        {sessionId && (
          <p className="session-indicator">Chat history is saved</p>
        )}
      </div>

      <div className="chat-messages">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`message ${message.role === "user" ? "user-message" : "bot-message"} ${shouldRenderDeepExplore(message) ? "deep-explore-mode" : ""}`}
          >
            <div className="message-avatar">
              {message.role === "user" ? "👤" : "🤖"}
            </div>
<div className="message-content">
              {message.role === "assistant" ? (
                <MarkdownResponse content={message.content} />
              ) : (
                <div className="message-text">{message.content}</div>
              )}
              <div className="message-time">{formatTime(message.timestamp)}</div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="message bot-message">
            <div className="message-avatar">🤖</div>
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
        <input
          type="text"
          className="chat-input"
          placeholder={content.placeholder}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyPress}
          disabled={isLoading}
        />
        <button
          className="new-chat-input-btn"
          onClick={handleNewChat}
          title="Start new chat"
        >
          ✨ New
        </button>
        <button
          className="send-btn"
          onClick={handleSendMessage}
          disabled={isLoading || !inputValue.trim()}
        >
          {isLoading ? (
            <span className="loading-spinner"></span>
          ) : (
            "➤"
          )}
        </button>
      </div>
    </div>
  );
}
