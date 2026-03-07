import { NextRequest, NextResponse } from "next/server";
import { getSessionMessages } from "@/lib/chat-history";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    const messages = await getSessionMessages(sessionId);

    const messageResponses = messages.map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      createdAt: msg.createdAt.toISOString(),
    }));

    return NextResponse.json({ success: true, sessionId, messages: messageResponses, count: messageResponses.length });
  } catch (error) {
    console.error("[Chat History API] Error fetching messages:", error);
    return NextResponse.json({ error: "Failed to fetch chat history" }, { status: 500 });
  }
}

