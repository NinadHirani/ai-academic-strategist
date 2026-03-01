"use client";

import React from "react";

export default function Header() {
  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">
          <span className="logo-icon">🧠</span>
          <span className="logo-text">AI Academic Strategist</span>
        </div>
        <nav className="nav-links">
          <a href="/" className="nav-link">Home</a>
          <a href="/sandbox" className="nav-link nav-link-sandbox">🧪 Mini GPT Lab</a>
          <a href="#" className="nav-link">About</a>
        </nav>
      </div>
    </header>
  );
}

