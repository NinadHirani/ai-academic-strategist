"use client";

import React from "react";

export default function Header() {
  return (
    <header className="header">
      <div className="header-content container-premium">
        <div className="logo">
          <span className="logo-icon">🧠</span>
          <span className="logo-text">AI Academic Strategist</span>
        </div>
        <nav className="nav-links">
          <a href="/" className="nav-link">Home</a>
          <a href="/dashboard" className="nav-link">📈 Dashboard</a>
          <a href="/career" className="nav-link">💼 Career</a>
          <a href="/pyq" className="nav-link">📋 Past Papers</a>
          <a href="/copilot" className="nav-link nav-link-copilot">🎓 Academic Copilot</a>
          <a href="/sandbox" className="nav-link nav-link-sandbox">🧪 Mini GPT Lab</a>
        </nav>
      </div>
    </header>
  );
}

