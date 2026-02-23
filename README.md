# AI Academic Strategist 🧠

An intelligent academic companion that combines document processing, retrieval-augmented generation (RAG), and adaptive learning to transform how you study and explore complex topics.

## Capabilities

### Document Intelligence
- **Upload & Process**: Import PDFs, text files, and study materials
- **Smart Chunking**: Automatically segments documents into semantically meaningful chunks
- **Vector Storage**: Embeddings enable semantic search across your entire document library
- **Source Citation**: Every answer references the exact document chunks used

### Retrieval-Augmented Generation (RAG)
- **Context-Aware Answers**: AI pulls relevant information from your uploaded documents
- **Semantic Search**: Find information based on meaning, not just keywords
- **Enhanced Context**: Retrieves up to 5 relevant chunks with source tracking

### Adaptive Learning
- **Conversation Memory**: Maintains context across multiple messages within each session
- **Session Management**: Create, organize, and revisit past conversations
- **Smart Title Generation**: Auto-names sessions based on first message
- **Context Tracking**: Remembers preferences and topics discussed

### Quad-Mode Interface
- **📚 Study Mode**: Concise explanations, flashcards, check-in questions, related concepts
- **🌐 DeepExplore Mode**: Comprehensive analysis with exam relevance and mark distribution
- **🎓 Tutor Mode**: Socratic questioning, hints before answers, adaptive to knowledge level
- **✅ Review Mode**: Practice questions, immediate feedback, mastery tracking

### Modern AI Features
- **Upgraded Model**: llama-3.3-70b-versatile (70B parameters)
- **Enhanced Context**: 15 message history for better continuity
- **Response Formatting**: Markdown support, structured sections, follow-up suggestions
- **Academic Detection**: Auto-detects subject, semester, university from queries

## Getting Started

```
bash
npm run dev:ui
# or
npm run dev -- -p 3001
```

Open [http://localhost:3001](http://localhost:3001)

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **AI**: Groq llama-3.3-70b-versatile
- **Embeddings**: HuggingFace (sentence-transformers/all-MiniLM-L6-v2)
- **Vector Store**: In-memory with pgvector support

## How It Works

1. **Choose Your Mode**: Select Study, DeepExplore, Tutor, or Review mode
2. **Upload Documents**: Add PDFs or text files to your knowledge base
3. **Ask Questions**: Query your materials using natural language
4. **Get Contextual Answers**: AI retrieves relevant passages and generates accurate responses with sources
5. **Track Progress**: Sessions persist, allowing you to resume conversations anytime

## Features Comparison

| Feature | Basic Chatbot | AI Academic Strategist |
|--------|--------------|----------------------|
| Document Upload | ❌ | ✅ PDF, TXT |
| Semantic Search | ❌ | ✅ Vector embeddings |
| Source Citation | ❌ | ✅ Exact chunk references |
| Conversation Memory | Limited | ✅ 15 messages |
| Learning Modes | 1 | 4 (Study, DeepExplore, Tutor, Review) |
| Adaptive Teaching | ❌ | ✅ Socratic method |
| Flashcards | ❌ | ✅ Auto-generated |
| Subject Detection | ❌ | ✅ Auto-detect |

## Limitations

- **Session-Based Memory**: Context is tied to individual sessions; starting a new chat begins fresh
- **Vector Store Persistence**: In development mode, document embeddings are stored in-memory
- **API Rate Limits**: Groq's free tier has request limitations

## Project Structure

```
/app
  /api/chat/           - AI chat with RAG and session management
    route.ts           - Main chat endpoint with 4 modes
    sessions/          - Session CRUD operations
    history/           - Message history retrieval
  /api/documents/      - Document upload and processing
  /api/pyq/           - Past year question analysis
/components            - React UI components
/lib
  rag.ts              - RAG orchestration
  embeddings.ts       - HuggingFace embeddings
  pyq-analyzer.ts    - Exam pattern analysis
  chat-history.ts    - Session & message persistence
  vector-store.ts    - In-memory vector database
```

## Branches

- `main` - Production version (port 3000)
- `ui-updates` - UI/UX enhanced version (port 3001)

---

*AI Academic Strategist - Study smarter, explore deeper.*
