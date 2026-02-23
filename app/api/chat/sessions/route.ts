import { NextRequest, NextResponse } from "next/server";
import { getUserSessions, deleteSession, createSession } from "@/lib/chat-history";

interface SessionResponse {
  id: string;
  title: string;
  mode: string;
  createdAt: string;
  updatedAt: string;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId") || "anonymous";
    const limit = parseInt(searchParams.get("limit") || "100");

    const sessions = await getUserSessions(userId, limit);

    const sessionResponses: SessionResponse[] = sessions.map((session) => ({
      id: session.id,
      title: session.title,
      mode: session.mode,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    }));

    return NextResponse.json({ success: true, sessions: sessionResponses, count: sessionResponses.length });
  } catch (error) {
    console.error("[Chat Sessions API] Error fetching sessions:", error);
    return NextResponse.json({ error: "Failed to fetch chat sessions" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, mode, title } = body;

    const newSession = await createSession(userId || "anonymous", mode || "study", title || "New Chat");

    return NextResponse.json({
      success: true,
      session: {
        id: newSession.id,
        title: newSession.title,
        mode: newSession.mode,
        createdAt: newSession.createdAt.toISOString(),
        updatedAt: newSession.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[Chat Sessions API] Error creating session:", error);
    return NextResponse.json({ error: "Failed to create chat session" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    const success = await deleteSession(sessionId);

    if (success) {
      return NextResponse.json({ success: true, message: "Session deleted successfully" });
    }
    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
  } catch (error) {
    console.error("[Chat Sessions API] Error deleting session:", error);
    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
  }
}

