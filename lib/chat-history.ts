/**
 * Chat History Management - Supabase Database Integration
 */

import { supabase } from './supabase';

export type ChatMode = 'study' | 'deepExplore' | 'tutor' | 'review';

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  mode: ChatMode;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  modelUsed?: string;
  tokensUsed?: number;
  createdAt: Date;
}

function getClient() {
  if (!supabase) {
    console.warn('[ChatHistory] Supabase not configured, using in-memory fallback');
    return null;
  }
  return supabase;
}

const inMemorySessions: Map<string, ChatSession> = new Map();
const inMemoryMessages: Map<string, ChatMessage[]> = new Map();
let sessionCounter = 0;

export async function createSession(
  userId: string,
  mode: ChatMode = 'study',
  title?: string
): Promise<ChatSession> {
  const client = getClient();
  
  const sessionData = {
    user_id: userId,
    title: title || 'New Chat',
    mode,
  };

  if (client) {
    const { data, error } = await client
      .from('chat_sessions')
      .insert(sessionData)
      .select()
      .single();

    if (error) {
      console.error('[ChatHistory] Error creating session:', error);
      throw error;
    }

    return {
      id: data.id,
      userId: data.user_id,
      title: data.title,
      mode: data.mode,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  const id = `session-${Date.now()}-${++sessionCounter}`;
  const session: ChatSession = {
    id,
    userId,
    title: title || 'New Chat',
    mode,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  inMemorySessions.set(id, session);
  inMemoryMessages.set(id, []);
  return session;
}

export async function getSession(sessionId: string): Promise<ChatSession | null> {
  const client = getClient();

  if (client) {
    const { data, error } = await client
      .from('chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      userId: data.user_id,
      title: data.title,
      mode: data.mode,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  return inMemorySessions.get(sessionId) || null;
}

export async function getUserSessions(
  userId: string,
  limit: number = 20
): Promise<ChatSession[]> {
  const client = getClient();

  if (client) {
    const { data, error } = await client
      .from('chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[ChatHistory] Error fetching sessions:', error);
      return [];
    }

    return (data || []).map((session) => ({
      id: session.id,
      userId: session.user_id,
      title: session.title,
      mode: session.mode,
      createdAt: new Date(session.created_at),
      updatedAt: new Date(session.updated_at),
    }));
  }

  return Array.from(inMemorySessions.values())
    .filter(s => s.userId === userId)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, limit);
}

export async function updateSession(
  sessionId: string,
  updates: { title?: string; mode?: ChatMode }
): Promise<ChatSession | null> {
  const client = getClient();

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  
  if (updates.title) updateData.title = updates.title;
  if (updates.mode) updateData.mode = updates.mode;

  if (client) {
    const { data, error } = await client
      .from('chat_sessions')
      .update(updateData)
      .eq('id', sessionId)
      .select()
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      userId: data.user_id,
      title: data.title,
      mode: data.mode,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  const session = inMemorySessions.get(sessionId);
  if (session) {
    if (updates.title) session.title = updates.title;
    if (updates.mode) session.mode = updates.mode;
    session.updatedAt = new Date();
    return session;
  }
  return null;
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  const client = getClient();

  if (client) {
    const { error } = await client
      .from('chat_sessions')
      .delete()
      .eq('id', sessionId);

    if (error) {
      console.error('[ChatHistory] Error deleting session:', error);
      return false;
    }
    return true;
  }

  inMemoryMessages.delete(sessionId);
  return inMemorySessions.delete(sessionId);
}

async function touchSession(sessionId: string): Promise<void> {
  const client = getClient();

  if (client) {
    await client
      .from('chat_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId);
  } else {
    const session = inMemorySessions.get(sessionId);
    if (session) session.updatedAt = new Date();
  }
}

export async function addMessage(
  sessionId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  modelUsed?: string,
  tokensUsed?: number
): Promise<ChatMessage> {
  const client = getClient();

  const messageData = {
    session_id: sessionId,
    role,
    content,
    model_used: modelUsed,
    tokens_used: tokensUsed,
  };

  if (client) {
    const { data, error } = await client
      .from('chat_messages')
      .insert(messageData)
      .select()
      .single();

    if (error) {
      console.error('[ChatHistory] Error adding message:', error);
      throw error;
    }

    await touchSession(sessionId);

    return {
      id: data.id,
      sessionId: data.session_id,
      role: data.role,
      content: data.content,
      modelUsed: data.model_used,
      tokensUsed: data.tokens_used,
      createdAt: new Date(data.created_at),
    };
  }

  const messages = inMemoryMessages.get(sessionId) || [];
  const message: ChatMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    sessionId,
    role,
    content,
    modelUsed,
    tokensUsed,
    createdAt: new Date(),
  };
  messages.push(message);
  inMemoryMessages.set(sessionId, messages);
  await touchSession(sessionId);
  
  return message;
}

export async function getSessionMessages(
  sessionId: string,
  limit: number = 100
): Promise<ChatMessage[]> {
  const client = getClient();

  if (client) {
    const { data, error } = await client
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('[ChatHistory] Error fetching messages:', error);
      return [];
    }

    return (data || []).map((msg) => ({
      id: msg.id,
      sessionId: msg.session_id,
      role: msg.role,
      content: msg.content,
      modelUsed: msg.model_used,
      tokensUsed: msg.tokens_used,
      createdAt: new Date(msg.created_at),
    }));
  }

  const messages = inMemoryMessages.get(sessionId) || [];
  return messages.slice(-limit);
}

export async function getConversationContext(
  sessionId: string,
  maxMessages: number = 10
): Promise<Array<{ role: 'user' | 'assistant' | 'system'; content: string }>> {
  const messages = await getSessionMessages(sessionId, maxMessages);
  
  return messages.map(msg => ({
    role: msg.role,
    content: msg.content,
  }));
}

export async function deleteMessage(messageId: string): Promise<boolean> {
  const client = getClient();

  if (client) {
    const { error } = await client
      .from('chat_messages')
      .delete()
      .eq('id', messageId);

    if (error) {
      console.error('[ChatHistory] Error deleting message:', error);
      return false;
    }
    return true;
  }

  for (const [sessionId, messages] of inMemoryMessages.entries()) {
    const index = messages.findIndex(m => m.id === messageId);
    if (index !== -1) {
      messages.splice(index, 1);
      return true;
    }
  }
  return false;
}

export async function clearSessionMessages(sessionId: string): Promise<boolean> {
  const client = getClient();

  if (client) {
    const { error } = await client
      .from('chat_messages')
      .delete()
      .eq('session_id', sessionId);

    if (error) {
      console.error('[ChatHistory] Error clearing messages:', error);
      return false;
    }
    
    await touchSession(sessionId);
    return true;
  }

  inMemoryMessages.set(sessionId, []);
  await touchSession(sessionId);
  return true;
}

export async function generateSessionTitle(firstMessage: string): Promise<string> {
  const words = firstMessage.trim().split(/\s+/);
  if (words.length <= 5) return words.join(' ');
  return words.slice(0, 5).join(' ') + '...';
}

export async function getOrCreateSession(
  userId: string,
  sessionId?: string,
  mode?: ChatMode
): Promise<ChatSession> {
  if (sessionId) {
    const existingSession = await getSession(sessionId);
    if (existingSession && existingSession.userId === userId) {
      return existingSession;
    }
  }
  
  return await createSession(userId, mode);
}

export async function getSessionMessageCount(sessionId: string): Promise<number> {
  const client = getClient();

  if (client) {
    const { count, error } = await client
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId);

    return error ? 0 : (count || 0);
  }

  const messages = inMemoryMessages.get(sessionId);
  return messages ? messages.length : 0;
}

