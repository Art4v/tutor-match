// Shared by the /api/managed-setup routes (0081; not itself a route): the
// managed tutor's own side of setup. Signed in, enabled, and softly rate
// limited; the RPCs are the boundary (they resolve the caller from the session
// and refuse anyone who is not managed).

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAccountEnabled } from "@/lib/supabase/account";
import { checkRateLimit } from "@/lib/rateLimit";

const RATE = { limit: 20, windowMs: 60 * 60 * 1000 };

/** Returns { supabase, user } or { res }. */
export async function requireTutorRequest(bucket) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { res: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) };
  }
  if (!(await isAccountEnabled(supabase, user.id))) {
    return { res: NextResponse.json({ error: "Your account is disabled." }, { status: 403 }) };
  }
  if (!checkRateLimit(`${bucket}:${user.id}`, RATE).allowed) {
    return { res: NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 }) };
  }
  return { supabase, user };
}

/** Map a tutor-side RPC error onto a response. 22023 messages are written to be shown. */
export function setupRpcErrorResponse(error, fallback) {
  if (error?.hint === "not_managed") {
    return NextResponse.json({ error: "Your profile is not managed by MatchTutor any more.", hint: "not_managed" }, { status: 409 });
  }
  if (error?.code === "22023") {
    return NextResponse.json({ error: error.message || fallback }, { status: 400 });
  }
  if (error?.code === "42501") {
    return NextResponse.json({ error: "Only tutors can do this." }, { status: 403 });
  }
  console.error("[managed-setup]", fallback, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
