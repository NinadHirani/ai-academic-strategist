-- =============================================
-- SAFE RLS SETUP (PRODUCTION-ORIENTED)
-- =============================================
-- This script ENABLES RLS and adds explicit scoped policies.
-- It intentionally does NOT disable RLS.

-- Ensure RLS is enabled on key tables
ALTER TABLE IF EXISTS chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pyqs ENABLE ROW LEVEL SECURITY;

-- Drop broad legacy policies (if present)
DROP POLICY IF EXISTS "Allow all for chat_sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Allow all for chat_messages" ON chat_messages;
DROP POLICY IF EXISTS "Allow all for user_interactions" ON user_interactions;
DROP POLICY IF EXISTS "Allow read for pyqs" ON pyqs;
DROP POLICY IF EXISTS "chat_sessions_owner_read" ON chat_sessions;
DROP POLICY IF EXISTS "chat_sessions_owner_insert" ON chat_sessions;
DROP POLICY IF EXISTS "chat_sessions_owner_update" ON chat_sessions;
DROP POLICY IF EXISTS "chat_sessions_owner_delete" ON chat_sessions;
DROP POLICY IF EXISTS "chat_messages_owner_read" ON chat_messages;
DROP POLICY IF EXISTS "chat_messages_owner_insert" ON chat_messages;
DROP POLICY IF EXISTS "chat_messages_owner_delete" ON chat_messages;
DROP POLICY IF EXISTS "user_interactions_owner_all" ON user_interactions;
DROP POLICY IF EXISTS "pyqs_public_read" ON pyqs;

-- Session isolation by owner user_id
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

-- Message isolation by joining parent session ownership
CREATE POLICY "chat_messages_owner_read"
  ON chat_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM chat_sessions s
      WHERE s.id = chat_messages.session_id
      AND s.user_id = auth.uid()::text
    )
  );

CREATE POLICY "chat_messages_owner_insert"
  ON chat_messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM chat_sessions s
      WHERE s.id = chat_messages.session_id
      AND s.user_id = auth.uid()::text
    )
  );

CREATE POLICY "chat_messages_owner_delete"
  ON chat_messages
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM chat_sessions s
      WHERE s.id = chat_messages.session_id
      AND s.user_id = auth.uid()::text
    )
  );

-- Interaction isolation by owner
CREATE POLICY "user_interactions_owner_all"
  ON user_interactions
  FOR ALL
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- PYQ table policy kept permissive for reads (if intended public)
CREATE POLICY "pyqs_public_read"
  ON pyqs
  FOR SELECT
  USING (true);
