# Five Brains Implementation Plan

## Goal: Implement all 5 Brains with persistent storage using Supabase

---

## Phase 1: Database Setup (Supabase)

### 1.1 Create Supabase Project
- [ ] Create new Supabase project at supabase.com
- [ ] Get project URL and anon key
- [ ] Add to .env.local

### 1.2 Create Database Tables
- [ ] **users** - User profiles and settings
- [ ] **pyqs** - Previous Year Questions storage
- [ ] **user_memories** - Weakness tracking
- [ ] **user_interactions** - Chat history
- [ ] **documents** - Uploaded document metadata
- [ ] **document_chunks** - Vector embeddings storage

---

## Phase 2: Knowledge Brain (RAG + Supabase Vector)

### 2.1 Update Dependencies
- [ ] Install @supabase/supabase-js
- [ ] Install pgvector for vector similarity search

### 2.2 Update lib/vector-store.ts
- [ ] Connect to Supabase instead of in-memory
- [ ] Implement vector similarity search with pgvector

### 2.3 Update lib/rag.ts
- [ ] Use Supabase for document storage
- [ ] Implement semantic retrieval

---

## Phase 3: Strategy Brain (PYQ Intelligence)

### 3.1 Create Supabase Schema
```sql
-- PYQs table
CREATE TABLE pyqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  unit TEXT NOT NULL,
  topic TEXT,
  question_text TEXT NOT NULL,
  question_type TEXT,
  marks INTEGER,
  year INTEGER,
  semester INTEGER,
  university TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable vector extension for future ML
CREATE EXTENSION IF NOT EXISTS vector;
```

### 3.2 Update lib/pyq-store.ts
- [ ] Connect to Supabase
- [ ] CRUD operations for PYQs
- [ ] Import sample PYQs

---

## Phase 4: Memory Brain (Weakness Tracking)

### 4.1 Create Supabase Schema
```sql
-- User profiles
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE NOT NULL,
  weak_topics TEXT[],
  repeated_questions TEXT[],
  learning_patterns JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User interactions
CREATE TABLE user_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  message TEXT NOT NULL,
  response TEXT NOT NULL,
  topics_detected TEXT[],
  confidence_level TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 4.2 Update lib/weakness-analyzer.ts
- [ ] Connect to Supabase
- [ ] Track repeated questions
- [ ] Detect weak topics
- [ ] Update learning patterns

### 4.3 Update lib/student-memory.ts
- [ ] Persist to Supabase
- [ ] Load user profiles

---

## Phase 5: Context Brain (Enhancement)

### 5.1 Create Supabase Schema
```sql
-- Academic context presets
CREATE TABLE context_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_code TEXT UNIQUE NOT NULL,
  university_name TEXT NOT NULL,
  subjects JSONB,
  semesters INTEGER[]
);
```

### 5.2 Seed Default Data
- [ ] Add GTU, MIT, Stanford presets
- [ ] Add common subject codes

---

## Phase 6: Environment Configuration

### 6.1 Update .env.local
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 6.2 Create Supabase Client
- [ ] Create lib/supabase.ts
- [ ] Implement auth helpers

---

## Phase 7: Testing & Deployment

### 7.1 Local Testing
- [ ] Test all API endpoints
- [ ] Verify vector search
- [ ] Test weakness tracking

### 7.2 Deploy Updates
- [ ] Push changes to GitHub
- [ ] Deploy to Vercel

---

## Tech Stack Summary

| Component | Technology |
|-----------|------------|
| Database | Supabase (PostgreSQL) |
| Vector Search | pgvector |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| API | Next.js API Routes |

---

## Files to Modify

1. `lib/supabase.ts` - NEW
2. `lib/vector-store.ts` - Update
3. `lib/rag.ts` - Update
4. `lib/pyq-store.ts` - Update
5. `lib/weakness-analyzer.ts` - Update
6. `lib/student-memory.ts` - Update
7. `.env.local` - Add variables
8. `package.json` - Add dependencies

