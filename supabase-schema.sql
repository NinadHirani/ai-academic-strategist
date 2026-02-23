-- =============================================
-- Five Brains Database Schema for Supabase
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- =============================================
-- USERS & PROFILES
-- =============================================

-- User profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT UNIQUE NOT NULL,
  weak_topics TEXT[] DEFAULT '{}',
  repeated_questions TEXT[] DEFAULT '{}',
  learning_patterns JSONB DEFAULT '{}',
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User interactions history
CREATE TABLE IF NOT EXISTS user_interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  message TEXT NOT NULL,
  response TEXT NOT NULL,
  topics_detected TEXT[] DEFAULT '{}',
  confidence_level TEXT,
  mode TEXT DEFAULT 'study',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster user lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_user_id ON user_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_created_at ON user_interactions(created_at DESC);

-- =============================================
-- PYQ (Previous Year Questions)
-- =============================================

-- PYQs storage table
CREATE TABLE IF NOT EXISTS pyqs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject TEXT NOT NULL,
  unit TEXT NOT NULL,
  topic TEXT,
  question_text TEXT NOT NULL,
  question_type TEXT DEFAULT 'short_answer',
  marks INTEGER DEFAULT 5,
  year INTEGER,
  semester INTEGER,
  university TEXT DEFAULT 'GTU',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for PYQ queries
CREATE INDEX IF NOT EXISTS idx_pyqs_subject ON pyqs(subject);
CREATE INDEX IF NOT EXISTS idx_pyqs_unit ON pyqs(unit);
CREATE INDEX IF NOT EXISTS idx_pyqs_university ON pyqs(university);
CREATE INDEX IF NOT EXISTS idx_pyqs_semester ON pyqs(semester);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_pyqs_subject_unit ON pyqs(subject, unit);

-- =============================================
-- DOCUMENTS & VECTORS
-- =============================================

-- Documents metadata
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  content TEXT,
  chunk_count INTEGER DEFAULT 0,
  user_id TEXT DEFAULT 'anonymous',
  status TEXT DEFAULT 'processing',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Document chunks with embeddings (using vector extension)
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- Indexes for document queries
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);

-- Vector similarity search index (cosine distance)
-- Note: You'll need pgvector extension installed
-- CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding ON document_chunks 
-- USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- =============================================
-- ACADEMIC CONTEXT PRESETS
-- =============================================

-- University and subject presets
CREATE TABLE IF NOT EXISTS context_presets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_code TEXT UNIQUE NOT NULL,
  university_name TEXT NOT NULL,
  subjects JSONB DEFAULT '{}',
  semesters INTEGER[] DEFAULT '{1,2,3,4,5,6,7,8}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- SEED DATA
-- =============================================

-- Seed sample PYQs
INSERT INTO pyqs (subject, unit, unit, topic, question_text, question_type, marks, year, semester, university) VALUES
-- DSA
('DSA', 'Unit 1', 'Arrays', 'Explain the difference between arrays and linked lists.', 'short_answer', 5, 2023, 3, 'GTU'),
('DSA', 'Unit 1', 'Arrays', 'Write a program to find maximum subarray sum using Kadane''s algorithm.', 'long_answer', 10, 2023, 3, 'GTU'),
('DSA', 'Unit 1', 'Arrays', 'Explain time complexity of array operations.', 'short_answer', 5, 2022, 3, 'GTU'),
('DSA', 'Unit 2', 'Linked Lists', 'Implement a doubly linked list with insertion and deletion.', 'long_answer', 10, 2022, 3, 'GTU'),
('DSA', 'Unit 2', 'Linked Lists', 'What are advantages of linked lists over arrays?', 'short_answer', 5, 2022, 3, 'GTU'),
('DSA', 'Unit 3', 'Stacks', 'Explain stack with example and state its applications.', 'short_answer', 5, 2023, 3, 'GTU'),
('DSA', 'Unit 3', 'Queues', 'Explain circular queue and its advantages.', 'short_answer', 5, 2023, 3, 'GTU'),
('DSA', 'Unit 4', 'Trees', 'Explain binary tree traversal methods.', 'short_answer', 5, 2022, 3, 'GTU'),
('DSA', 'Unit 4', 'Trees', 'Implement BST search operation.', 'long_answer', 10, 2023, 3, 'GTU'),
('DSA', 'Unit 5', 'Graphs', 'Explain BFS and DFS with examples.', 'short_answer', 5, 2022, 3, 'GTU'),
-- Operating Systems
('OS', 'Unit 1', 'Introduction', 'What is OS? Explain its functions.', 'short_answer', 5, 2023, 4, 'GTU'),
('OS', 'Unit 2', 'Process', 'Explain process control block.', 'short_answer', 5, 2022, 4, 'GTU'),
('OS', 'Unit 3', 'Scheduling', 'Explain FCFS scheduling algorithm with example.', 'short_answer', 5, 2023, 4, 'GTU'),
('OS', 'Unit 3', 'Scheduling', 'Compare FCFS, SJF, and Round Robin scheduling.', 'long_answer', 10, 2022, 4, 'GTU'),
('OS', 'Unit 4', 'Memory Management', 'Explain paging and segmentation with advantages.', 'short_answer', 5, 2023, 4, 'GTU'),
('OS', 'Unit 4', 'Memory Management', 'Explain virtual memory concept.', 'short_answer', 5, 2022, 4, 'GTU'),
('OS', 'Unit 5', 'File Systems', 'Explain file allocation methods (contiguous, linked, indexed).', 'short_answer', 5, 2022, 4, 'GTU'),
-- AJP (Advanced Java Programming)
('AJP', 'Unit 1', 'JDBC', 'Explain JDBC architecture and drivers.', 'short_answer', 5, 2023, 5, 'GTU'),
('AJP', 'Unit 1', 'JDBC', 'Write a program to perform CRUD operations using JDBC.', 'long_answer', 10, 2022, 5, 'GTU'),
('AJP', 'Unit 2', 'Servlets', 'Explain servlet lifecycle.', 'short_answer', 5, 2023, 5, 'GTU'),
('AJP', 'Unit 2', 'Servlets', 'Explain difference between GET and POST methods.', 'short_answer', 5, 2022, 5, 'GTU'),
('AJP', 'Unit 3', 'JSP', 'Explain JSP implicit objects.', 'short_answer', 5, 2023, 5, 'GTU'),
('AJP', 'Unit 3', 'JSP', 'Explain difference between Servlet and JSP.', 'short_answer', 5, 2022, 5, 'GTU'),
('AJP', 'Unit 4', 'Hibernate', 'Explain Hibernate ORM framework.', 'short_answer', 5, 2023, 5, 'GTU'),
('AJP', 'Unit 5', 'Spring', 'Explain Spring framework and its modules.', 'short_answer', 5, 2022, 5, 'GTU'),
-- Internet of Things
('IOT', 'Unit 1', 'Introduction', 'What is IoT? Explain its architecture.', 'short_answer', 5, 2023, 6, 'GTU'),
('IOT', 'Unit 1', 'Introduction', 'Explain IoT enabled devices and sensors.', 'short_answer', 5, 2022, 6, 'GTU'),
('IOT', 'Unit 2', 'Communication', 'Explain MQTT protocol in IoT.', 'short_answer', 5, 2023, 6, 'GTU'),
('IOT', 'Unit 3', 'Cloud', 'Explain IoT cloud platforms.', 'short_answer', 5, 2022, 6, 'GTU'),
('IOT', 'Unit 4', 'Security', 'Explain IoT security challenges.', 'short_answer', 5, 2023, 6, 'GTU')
ON CONFLICT DO NOTHING;

-- Seed university presets
INSERT INTO context_presets (university_code, university_name, subjects, semesters) VALUES
('GTU', 'Gujarat Technological University', 
 '{"DSA": ["Data Structures and Algorithms", "Unit 1-5"], "OS": ["Operating Systems", "Unit 1-5"], "AJP": ["Advanced Java Programming", "Unit 1-5"], "IOT": ["Internet of Things", "Unit 1-5"]}', 
 '{1,2,3,4,5,6,7,8}'),
('MU', 'Mumbai University',
 '{"DS": ["Data Structures", "Unit 1-4"], "OS": ["Operating Systems", "Unit 1-5"], "WT": ["Web Technologies", "Unit 1-4"]}',
 '{1,2,3,4,5,6,7,8}'),
('DU', 'Delhi University',
 '{"CS": ["Computer Science", "Unit 1-5"], "AI": ["Artificial Intelligence", "Unit 1-4"]}',
 '{1,2,3,4,5,6,7,8}')
ON CONFLICT (university_code) DO NOTHING;

-- =============================================
-- CHAT SESSIONS & MESSAGES (For ChatGPT-like history)
-- =============================================

-- Chat sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  title TEXT DEFAULT 'New Chat',
  mode TEXT DEFAULT 'study',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat messages table
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

-- Indexes for chat queries
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON chat_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- =============================================
-- ROW LEVEL SECURITY (Optional)
-- =============================================

-- Enable RLS (uncomment if needed)
-- ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_interactions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to access their own data
-- CREATE POLICY "Users can view own profile" ON user_profiles
--   FOR SELECT USING (auth.uid()::text = user_id);

-- =============================================
-- FUNCTIONS
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update timestamps
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

