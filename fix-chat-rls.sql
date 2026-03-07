-- Chat tables RLS hardening (safe defaults)
-- This script enables RLS and applies owner-based policies.

ALTER TABLE IF EXISTS chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS chat_messages ENABLE ROW LEVEL SECURITY;

-- Remove permissive legacy policies
DROP POLICY IF EXISTS "Allow all on chat_sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Allow all on chat_messages" ON chat_messages;
DROP POLICY IF EXISTS "Allow all for chat_sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Allow all for chat_messages" ON chat_messages;
DROP POLICY IF EXISTS "chat_sessions_owner_read" ON chat_sessions;
DROP POLICY IF EXISTS "chat_sessions_owner_insert" ON chat_sessions;
DROP POLICY IF EXISTS "chat_sessions_owner_update" ON chat_sessions;
DROP POLICY IF EXISTS "chat_sessions_owner_delete" ON chat_sessions;
DROP POLICY IF EXISTS "chat_messages_owner_read" ON chat_messages;
DROP POLICY IF EXISTS "chat_messages_owner_insert" ON chat_messages;
DROP POLICY IF EXISTS "chat_messages_owner_delete" ON chat_messages;

-- Ensure base tables exist
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  title TEXT DEFAULT 'New Chat',
  mode TEXT DEFAULT 'study',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  model_used TEXT,
  tokens_used INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

-- Session ownership policies
CREATE POLICY "chat_sessions_owner_read"
  ON chat_sessions
  FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "chat_sessions_owner_insert"
  ON chat_sessions
  FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "chat_sessions_owner_update"
  ON chat_sessions
  FOR UPDATE
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "chat_sessions_owner_delete"
  ON chat_sessions
  FOR DELETE
  USING (auth.uid()::text = user_id);

-- Message ownership policies via parent session
CREATE POLICY "chat_messages_owner_read"
  ON chat_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_sessions s
      WHERE s.id = chat_messages.session_id
      AND s.user_id = auth.uid()::text
    )
  );

CREATE POLICY "chat_messages_owner_insert"
  ON chat_messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_sessions s
      WHERE s.id = chat_messages.session_id
      AND s.user_id = auth.uid()::text
    )
  );

CREATE POLICY "chat_messages_owner_delete"
  ON chat_messages
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM chat_sessions s
      WHERE s.id = chat_messages.session_id
      AND s.user_id = auth.uid()::text
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON chat_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
