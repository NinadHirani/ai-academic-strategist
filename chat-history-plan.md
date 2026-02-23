# Chat History Feature Plan

## Objective
Make the AI remember previous messages in a conversation, like ChatGPT does, so users get context-aware responses.

## Changes Required

### 1. Database Schema Updates (supabase-schema.sql)
- Create `chat_sessions` table - stores conversation sessions
- Create `chat_messages` table - stores individual messages in sessions

### 2. New Library (lib/chat-history.ts)
- Functions to manage chat sessions and messages:
  - `createSession(userId)` - Create new chat session
  - `getSession(sessionId)` - Get session details
  - `addMessage(sessionId, role, content)` - Add message to session
  - `getSessionMessages(sessionId, limit)` - Get conversation history
  - `getUserSessions(userId, limit)` - Get all sessions for user

### 3. API Updates (app/api/chat/route.ts)
- Accept `sessionId` in request body
- Load previous messages from database
- Send conversation history to AI
- Save each message to database
- Return session ID in response for continued conversations

### 4. Frontend Updates (app/components/ChatPanel.tsx)
- Track session ID in state
- Send session ID with each message
- Display session ID in UI (optional)
- Add "New Chat" button to start fresh conversations

## Implementation Order
1. Update database schema
2. Create chat-history.ts library
3. Update chat API route
4. Update ChatPanel component
