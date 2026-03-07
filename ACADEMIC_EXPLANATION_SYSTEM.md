# Academic Explanation System Integration

This project now enforces strict academic explanation rules for all LLM-generated content in Study and DeepExplore modes. The backend prompt system has been updated to:

- Require structured, academically accurate explanations based strictly on provided syllabus context and trusted search summaries.
- Enforce mode-specific output structures (see below) and academic tone.
- Prohibit fabricated URLs, references, or external links in explanations.
- Personalize explanations by Student_Level (Beginner, Intermediate, Advanced) if provided.
- Include an internal self-check to verify output structure and absence of URLs before finalizing.
- Delegate all source/URL display to the frontend only (never in main explanation).

## Output Structures

### Study Mode
- Concept Overview
- Key Principles
- Step-by-Step Explanation
- Example
- Common Mistakes
- Exam Relevance

### DeepExplore Mode
- Concept Overview
- Formal Definition
- Core Theoretical Framework
- Related Concepts
- Advanced Insight
- Practical / System Applications

## Grounding
- Explanations are grounded in internal knowledge, provided syllabus context, and trusted search summaries (from Google Custom Search API).
- Never mention inability to access documents or browse the internet.

## Frontend
- All sources, URLs, and references are handled separately (e.g., collapsible “Sources” button).

## Developer Notes
- See `app/api/chat/route.ts` for prompt logic.
- Update or extend prompt logic here if new academic modes or output structures are required.
