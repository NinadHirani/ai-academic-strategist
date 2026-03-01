/**
 * Mini GPT Lab — API Proxy Route
 * ================================
 * 
 * Proxies requests from the Next.js frontend to the Mini GPT Python server
 * running on port 8100.
 * 
 * ISOLATION: This route ONLY communicates with the educational sandbox server.
 * It has NO connection to the production AI pipeline (Groq, Supabase, RAG).
 */

import { NextRequest, NextResponse } from "next/server";

const MINI_GPT_SERVER = process.env.MINI_GPT_SERVER_URL || "http://localhost:8100";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get("endpoint") || "";

  try {
    const response = await fetch(`${MINI_GPT_SERVER}/${endpoint}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Server error" }));
      return NextResponse.json(
        { error: error.detail || "Mini GPT server error" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Mini GPT server not reachable. Start it with: cd mini-gpt && python server.py",
        serverUrl: MINI_GPT_SERVER,
      },
      { status: 503 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get("endpoint") || "";

  try {
    const body = await request.json();

    const response = await fetch(`${MINI_GPT_SERVER}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Server error" }));
      return NextResponse.json(
        { error: error.detail || "Mini GPT server error" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Mini GPT server not reachable. Start it with: cd mini-gpt && python server.py",
        serverUrl: MINI_GPT_SERVER,
      },
      { status: 503 }
    );
  }
}
