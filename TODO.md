# TODO: DeepExplore Mode Implementation

## Task
Implement "DeepExplore Mode" in the AI Academic Strategist project with structured, analytical, and exploratory AI responses.

## Steps to Complete

- [ ] 1. Update backend prompt logic (`app/api/chat/route.ts`)
  - Enhance deepExplore mode instruction with structured output requirements
  - Add section formatting guidelines
  - Define the 6 required sections

- [ ] 2. Add CSS styling for structured responses (`app/globals.css`)
  - Style DeepExplore section headers
  - Style content blocks and special sections
  - Add visual hierarchy for readability

- [ ] 3. Update ChatPanel for structured display (`app/components/ChatPanel.tsx`)
  - Add logic to detect and format DeepExplore responses
  - Render sections differently based on mode

## Required Sections for DeepExplore Mode
1. Concept Overview
2. Key Principles
3. Related Topics
4. Common Confusions
5. Practical Applications
6. Exam Relevance

