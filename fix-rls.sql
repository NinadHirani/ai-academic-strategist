-- =============================================
-- FIX: RLS Policies for Chat History
-- =============================================

-- Option 1: Disable RLS (simpler for now)
-- Run these if you want to disable RLS completely:

ALTER TABLE chat_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_interactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE pyqs DISABLE ROW LEVEL SECURITY;

-- Option 2: If you want to keep RLS enabled, run this instead:
/*
-- Allow anyone to create/read/update/delete chat sessions
CREATE POLICY "Allow all for chat_sessions" ON chat_sessions
  FOR ALL USING (true) WITH CHECK (true);

-- Allow anyone to create/read/update/delete chat messages
CREATE POLICY "Allow all for chat_messages" ON chat_messages
  FOR ALL USING (true) WITH CHECK (true);

-- Allow anyone to create/read user interactions
CREATE POLICY "Allow all for user_interactions" ON user_interactions
  FOR ALL USING (true) WITH CHECK (true);

-- Allow anyone to read PYQs
CREATE POLICY "Allow read for pyqs" ON pyqs
  FOR SELECT USING (true);
*/
