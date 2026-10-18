import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireGatedTutor, loadOwnRevisionDiff, revisionLinks, emailAdminAboutRevision } from "../shared";

export const runtime = "nodejs";

// Re-send the admin a fresh 30-day link for the caller's submission, without
// withdrawing it. At most once a day: resend_profile_revision enforces that on
// a durable column (admin_notified_at), not the in-memory rate limiter.
export async function POST(request) {
  const supabase = createSupabaseServerClient();
  const gate = await requireGatedTutor(supabase);
  if (gate.res) return gate.res;
  const { me } = gate;

  const { revision, diff } = await loadOwnRevisionDiff(supabase, me);
  if (!revision || revision.status !== "pending") {
    return NextResponse.json({ error: "Nothing is under review." }, { status: 400 });
  }

  let links;
  try {
    links = revisionLinks(request, revision.id);
  } catch (err) {
    console.error("[revisions/resend] could not sign link:", err);
    return NextResponse.json({ error: "Server is not configured for reviews." }, { status: 500 });
  }

  const { error } = await supabase.rpc("resend_profile_revision");
  if (error) {
    const tooSoon = error.hint === "too_soon";
    return NextResponse.json(
      { error: tooSoon ? "You can resend once a day." : error.message || "Could not resend." },
      { status: tooSoon ? 429 : 400 }
    );
  }

  await emailAdminAboutRevision({ links, me, diff, resent: true });
  return NextResponse.json({ ok: true, adminNotifiedAt: new Date().toISOString() });
}
