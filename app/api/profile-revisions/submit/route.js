import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notifications";
import { revisionSubmittedEmail } from "@/lib/email/send";
import { checkRateLimit } from "@/lib/rateLimit";
import { requireGatedTutor, loadOwnRevisionDiff, revisionLinks, emailAdminAboutRevision } from "../shared";

export const runtime = "nodejs";

// Soft cap so one account can't flood the admin inbox (in-process, see
// lib/rateLimit.js). The real gate is that nothing goes live unapproved.
const RATE = { limit: 10, windowMs: 60 * 60 * 1000 };

// A verified tutor sends their draft for review. Auth-gated. Refuses an empty
// diff (nothing to review), flips the draft to 'pending' via
// submit_profile_revision, then notifies the tutor and alerts the admins with a
// dashboard link.
export async function POST(request) {
  const supabase = createSupabaseServerClient();
  const gate = await requireGatedTutor(supabase);
  if (gate.res) return gate.res;
  const { user, me } = gate;

  const { allowed } = checkRateLimit(`revision-submit:${user.id}`, RATE);
  if (!allowed) {
    return NextResponse.json({ error: "You're submitting too often. Try again later." }, { status: 429 });
  }

  const { revision, diff } = await loadOwnRevisionDiff(supabase, me);
  if (!revision || revision.status !== "draft") {
    return NextResponse.json({ error: "There are no changes to submit." }, { status: 400 });
  }
  if (diff.length === 0) {
    return NextResponse.json({ error: "Your draft matches your live profile, so there is nothing to review." }, { status: 400 });
  }

  // Submitting keeps the row id, so the dashboard link is stable.
  const links = revisionLinks(request, revision.id);

  const { error: rpcError } = await supabase.rpc("submit_profile_revision");
  if (rpcError) {
    return NextResponse.json({ error: rpcError.message || "Could not submit your changes." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  await notifyUser(admin, user.id, {
    type: "profile_revision_submitted",
    title: "Your changes are in review",
    body: "Students keep seeing your current profile until our team approves your changes.",
    email: { subject: "Your profile changes are in review", html: revisionSubmittedEmail({ name: me.name }) },
  });
  await emailAdminAboutRevision({ links, me, diff });

  const now = new Date().toISOString();
  return NextResponse.json({ ok: true, status: "pending", submittedAt: now, adminNotifiedAt: now });
}
