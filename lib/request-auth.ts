import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_USER_ID } from "@/lib/config";

type ResolveUserOptions = {
  allowAnonymousInDev?: boolean;
};

type ResolveUserResult =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

export async function resolveRequestUserId(
  request: NextRequest,
  options: ResolveUserOptions = {}
): Promise<ResolveUserResult> {
  const { allowAnonymousInDev = true } = options;
  const isProduction = process.env.NODE_ENV === "production";

  const authHeader = request.headers.get("authorization") || "";
  const bearer = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (bearer && supabaseUrl && supabaseAnonKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data, error } = await supabase.auth.getUser(bearer);
      if (!error && data?.user?.id) {
        return { ok: true, userId: data.user.id };
      }
    } catch {
      // Fall through to auth-required handling below.
    }
  }

  if (!isProduction && allowAnonymousInDev) {
    return { ok: true, userId: DEFAULT_USER_ID };
  }

  return {
    ok: false,
    response: NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    ),
  };
}
