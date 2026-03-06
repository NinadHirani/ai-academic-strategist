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

function getMiniGptServerUrl(): string | null {
  const url = process.env.MINI_GPT_SERVER_URL;
  return url && url.trim().length > 0 ? url : null;
}

function missingServerResponse() {
  return NextResponse.json(
    {
      error:
        "Mini GPT backend is not configured. Set MINI_GPT_SERVER_URL to an accessible service URL.",
    },
    { status: 503 }
  );
}

export async function GET(request: NextRequest) {
  const miniGptServer = getMiniGptServerUrl();
  if (!miniGptServer) return missingServerResponse();

  const { searchParams } = new URL(request.url);
  const requestedEndpoint = searchParams.get("endpoint") || "";
  const endpoint = requestedEndpoint === "health" ? "" : requestedEndpoint;
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;
  const url = normalizedEndpoint ? `${miniGptServer}/${normalizedEndpoint}` : miniGptServer;

  try {
    const response = await fetch(url, {
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
        error: "Mini GPT backend not reachable",
        serverUrl: miniGptServer,
      },
      { status: 503 }
    );
  }
}

export async function POST(request: NextRequest) {
  const miniGptServer = getMiniGptServerUrl();
  if (!miniGptServer) return missingServerResponse();

  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get("endpoint") || "";
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;
  const url = normalizedEndpoint ? `${miniGptServer}/${normalizedEndpoint}` : miniGptServer;

  try {
    const body = await request.json();

    const response = await fetch(url, {
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
        error: "Mini GPT backend not reachable",
        serverUrl: miniGptServer,
      },
      { status: 503 }
    );
  }
}
