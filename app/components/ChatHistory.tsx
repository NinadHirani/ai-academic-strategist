"use client";

import React, { useState, useEffect } from "react";

interface ChatSession {
  id: string;
  title: string;
  mode: string;
  createdAt: string;
  updatedAt: string;
}

interface ChatHistoryProps {
  userId?: string;
  onSessionSelect: (sessionId: string) => void;
  onNewChat: () => void;
}

export default function ChatHistory({ userId = "anonymous", onSessionSelect, onNewChat }: ChatHistoryProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, [userId]);

  const fetchSessions = async () => {
    try {
      const response = await fetch(`/api/chat/sessions?userId=${encodeURIComponent(userId)}&limit=50`);
      const data = await response.json();
      
      if (data.success && data.sessions) {
        setSessions(data.sessions);
      }
    } catch (error) {
      console.error("[ChatHistory] Error fetching sessions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    
    if (!confirm("Are you sure you want to delete this chat?")) {
      return;
    }

    try {
      const response = await fetch(`/api/chat/sessions?sessionId=${sessionId}`, {
        method: "DELETE",
      });
      const data = await response.json();
      
      if (data.success) {
        // Remove from local state
        setSessions(sessions.filter(s => s.id !== sessionId));
      }
    } catch (error) {
      console.error("[ChatHistory] Error deleting session:", error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <>
      {/* Toggle Button */}
      <button 
        className="chat-history-toggle"
        onClick={() => setIsOpen(!isOpen)}
        title="Past Chats"
      >
        📜
      </button>

      {/* Sidebar */}
      <div className={`chat-history-sidebar ${isOpen ? "open" : ""}`}>
        <div className="chat-history-header">
          <h3>Past Chats</h3>
          <button 
            className="close-btn"
            onClick={() => setIsOpen(false)}
          >
            ✕
          </button>
        </div>

        <button 
          className="new-chat-btn-full"
          onClick={() => {
            onNewChat();
            setIsOpen(false);
          }}
        >
          + New Chat
        </button>

        <div className="chat-history-list">
          {isLoading ? (
            <div className="loading-placeholder">Loading...</div>
          ) : sessions.length === 0 ? (
            <div className="empty-history">
              <p>No past chats yet.</p>
              <p>Start a new conversation!</p>
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className="chat-history-item"
                onClick={() => {
                  onSessionSelect(session.id);
                  setIsOpen(false);
                }}
              >
                <div className="session-info">
                  <span className="session-title">{session.title}</span>
                  <span className="session-date">{formatDate(session.updatedAt)}</span>
                </div>
                <span className="session-mode">{session.mode === "deepExplore" ? "🌐" : "📚"}</span>
                <button 
                  className="delete-btn"
                  onClick={(e) => handleDeleteSession(e, session.id)}
                  title="Delete chat"
                >
                  🗑️
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Overlay */}
      {isOpen && <div className="chat-history-overlay" onClick={() => setIsOpen(false)} />}
    </>
  );
}
