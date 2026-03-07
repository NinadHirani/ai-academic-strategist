import { NextRequest } from "next/server";

function getKarpathyServerUrl(): string | null {
  const url = process.env.KARPATHY_GPT_URL;
  return url && url.trim().length > 0 ? url : null;
}

export async function POST(req: NextRequest) {
  const pyServer = getKarpathyServerUrl();
  if (!pyServer) {
    return new Response(
      JSON.stringify({
        error:
          "Karpathy Mini-GPT backend is not configured. Set KARPATHY_GPT_URL to an accessible service URL.",
      }),
      { status: 503 }
    );
  }

  const { endpoint, ...body } = await req.json();
  if (!endpoint || (endpoint !== "train" && endpoint !== "generate")) {
    return new Response(JSON.stringify({ error: "Invalid endpoint" }), { status: 400 });
  }
  const res = await fetch(`${pyServer}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return new Response(JSON.stringify(data), { status: res.status });
}
