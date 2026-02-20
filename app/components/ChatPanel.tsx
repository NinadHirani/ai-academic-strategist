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
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage.content,
          mode: activeMode,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get response");
      }

      const data = await response.json();

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
        <h2 className="chat-title">{content.title}</h2>
        <p className="chat-description">{content.description}</p>
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
              {shouldRenderDeepExplore(message) ? (
                <DeepExploreResponse content={message.content} />
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

