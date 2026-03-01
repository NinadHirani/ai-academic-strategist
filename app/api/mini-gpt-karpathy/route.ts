import { NextRequest } from "next/server";

const PY_SERVER = process.env.KARPATHY_GPT_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  const { endpoint, ...body } = await req.json();
  if (!endpoint || (endpoint !== "train" && endpoint !== "generate")) {
    return new Response(JSON.stringify({ error: "Invalid endpoint" }), { status: 400 });
  }
  const res = await fetch(`${PY_SERVER}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return new Response(JSON.stringify(data), { status: res.status });
}
