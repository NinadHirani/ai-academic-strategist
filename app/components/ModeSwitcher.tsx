"use client";

import React from "react";

interface ModeSwitcherProps {
  activeMode: "study" | "deepExplore";
  onModeChange: (mode: "study" | "deepExplore") => void;
}

export default function ModeSwitcher({ activeMode, onModeChange }: ModeSwitcherProps) {
  return (
    <div className="mode-switcher">
      <button
        className={`mode-btn ${activeMode === "study" ? "active study" : ""}`}
        onClick={() => onModeChange("study")}
      >
        <span className="mode-icon">📚</span>
        <span className="mode-label">Study Mode</span>
      </button>
      <button
        className={`mode-btn ${activeMode === "deepExplore" ? "active deep-explore" : ""}`}
        onClick={() => onModeChange("deepExplore")}
      >
        <span className="mode-icon">🌐</span>
        <span className="mode-label">DeepExplore Mode</span>
      </button>
    </div>
  );
}

