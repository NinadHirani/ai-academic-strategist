# AI Academic Copilot — Documentation

## Overview

The Academic Copilot searches for official university syllabi from the web, parses them into structured JSON, generates a study roadmap, and provides deep topic expansions with real, verified web resources.

## Setup

### Required Environment Variables

Add these to `.env.local`:

```bash
# Already required by existing app
GROQ_API_KEY=your_groq_api_key

# Web Search — at least ONE of these is required
TAVILY_API_KEY=your_tavily_api_key        # Recommended (free tier at tavily.com)
SERPAPI_KEY=your_serpapi_key               # Alternative (serpapi.com)
```

### Getting API Keys

| Service | URL | Free Tier |
|---------|-----|-----------|
| **Tavily** | https://tavily.com | 1,000 searches/month |
| **SerpAPI** | https://serpapi.com | 100 searches/month |
| **Groq** | https://console.groq.com | Already configured |

## Architecture

```
User Query ("TOC, Semester 6, GTU")
         │
         ▼
┌─────────────────────────┐
│  /api/copilot/search    │  ← Single pipeline endpoint
│  ┌───────────────────┐  │
│  │ 1. Web Search     │  │  Tavily / SerpAPI
│  │ 2. Syllabus Parse │  │  Groq LLM (JSON mode)
│  │ 3. Roadmap Gen    │  │  Groq LLM (JSON mode)
│  └───────────────────┘  │
└─────────┬───────────────┘
          │
          ▼
   Structured Roadmap
   (units → topics → subtopics)
          │
          ▼ (on topic click)
┌─────────────────────────┐
│  /api/copilot/expand    │
│  ┌───────────────────┐  │
│  │ 1. Article Search │  │  3-5 real articles
│  │ 2. YouTube Search │  │  2-3 YouTube playlists
│  │ 3. Academic Search│  │  Study materials/refs
│  │ 4. LLM Expansion  │  │  Deep explanation
│  └───────────────────┘  │
└─────────────────────────┘
```

## API Endpoints

### `POST /api/copilot/search`

Runs the full pipeline: search → parse → roadmap.

**Request:**
```json
{
  "query": "TOC, Semester 6, GTU"
}
```

**Response:**
```json
{
  "success": true,
  "syllabus": {
    "subject": "Theory of Computation",
    "university": "Gujarat Technological University",
    "semester": "Semester 6",
    "units": [...],
    "totalTopics": 24
  },
  "roadmap": {
    "units": [...],
    "totalEstimatedHours": 20,
    "revisionStrategy": "...",
    "suggestedSchedule": [...]
  },
  "meta": {
    "elapsedMs": 12000,
    "totalTopics": 24,
    "totalHours": 20
  }
}
```

### `POST /api/copilot/expand`

Expands a single topic with deep explanation and real resources.

**Request:**
```json
{
  "topic": {
    "id": "unit-1-topic-1",
    "name": "Finite Automata",
    "subtopics": [{"name": "DFA"}, {"name": "NFA"}],
    ...
  },
  "subject": "Theory of Computation",
  "university": "GTU"
}
```

**Response:**
```json
{
  "success": true,
  "expansion": {
    "topicId": "unit-1-topic-1",
    "conceptOverview": "...",
    "mathematicalExplanation": "...",
    "examples": ["...", "..."],
    "pastYearPatterns": "...",
    "articles": [...],
    "youtubeResources": [...],
    "academicReferences": [...]
  }
}
```

## Data Flow

1. **User enters query** → e.g., "TOC, Semester 6, GTU"
2. **Web search** → Tavily/SerpAPI finds syllabus pages
3. **LLM parsing** → Groq extracts structured units/topics JSON
4. **Roadmap generation** → Groq assigns difficulty, time, prerequisites, order
5. **UI renders** clickable tree of units → topics → subtopics
6. **Topic click** → triggers `/api/copilot/expand`:
   - Searches web for articles, YouTube, academic refs
   - Injects all into LLM for deep structured explanation
   - Returns verified resources + explanation
7. **All links are real** — sourced from actual web search, never hallucinated

## Error Handling

| Error | Cause | Fix |
|-------|-------|-----|
| "No search API configured" | Missing env vars | Set `TAVILY_API_KEY` or `SERPAPI_KEY` |
| "GROQ_API_KEY is not set" | Missing Groq key | Set `GROQ_API_KEY` in `.env.local` |
| "LLM returned invalid JSON" | Parse failure | Retry — Groq JSON mode reduces this |
| "Pipeline failed" | General error | Check server logs for details |

## Files

| File | Purpose |
|------|---------|
| `lib/copilot-types.ts` | All TypeScript interfaces |
| `lib/copilot-engine.ts` | Core engine: search, parse, roadmap, expand |
| `app/api/copilot/search/route.ts` | Full pipeline API endpoint |
| `app/api/copilot/expand/route.ts` | Topic expansion API endpoint |
| `app/copilot/page.tsx` | Frontend: search bar + roadmap tree UI |
| `app/globals.css` | Copilot-specific CSS classes |

## Demo

1. Start the dev server: `npm run dev`
2. Navigate to `http://localhost:3000/copilot`
3. Enter: **TOC, Semester 6, GTU**
4. Wait for the pipeline to complete (~10-15 seconds)
5. Click any topic in the roadmap tree to see deep expansion
