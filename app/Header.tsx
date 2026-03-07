"use client";

import React from "react";

export default function Header() {
  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">
          <span className="logo-icon">🧠</span>
          <span className="logo-text">AI Academic Strategist</span>
          <span className="logo-badge">Beta</span>
        </div>
        <div className="header-actions">
          <button className="header-btn">⚙️ Settings</button>
        </div>
      </div>
    </header>
  );
}
