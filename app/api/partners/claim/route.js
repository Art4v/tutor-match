import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyPartnerInviteToken } from "@/lib/partnerToken";

export const runtime = "nodejs";

/**
 * POST { token } — bind an invited partner to the signed-in account.
 *
 * TWO gates, and they do different jobs:
 *   1. The signed token says WHICH partner may be claimed. It is the invite.
 *   2. The session says WHO is claiming. Unlike the other token routes in this
 *      repo (verification, reports, reviews) a session is genuinely required
 *      here, because the whole point is to write auth.uid() into owner_id.
 *
 * The write runs through the SERVICE ROLE because the caller has no partner
 * permissions yet — at this moment they are a role-less account with no rows to
 * their name. claim_partner() is ungranted to `authenticated` for the same
 * reason: without the token check above it, a signed-in user could otherwise
 * claim any partner by guessing its id.
 *
 * Replay is handled in SQL, not here: claim_partner() only writes
 * `where owner_id is null`, so a forwarded link is inert once used. A null slug
 * back means exactly that, and 409 is the honest status for it.
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { partnerId, error: tokenError } = verifyPartnerInviteToken(body?.token);
  if (tokenError) {
    return NextResponse.json({ error: "This invite link is invalid or has expired." }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to claim this centre." }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server is not configured for claiming." }, { status: 500 });
  }

  // claim_partner reads auth.uid(), which the service-role client does not set,
  // so the caller is passed explicitly and the function is called as them.
  const { data: slug, error } = await admin.rpc("claim_partner_as", {
    p_partner_id: partnerId,
    p_user_id: user.id,
  });

  if (error) {
    // The RPC raises with a readable message for the cases worth explaining
    // (wrong account type, already manages a centre).
    return NextResponse.json({ error: error.message || "Could not claim this centre." }, { status: 400 });
  }

  if (!slug) {
    return NextResponse.json(
      { error: "This centre has already been claimed." },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true, slug });
}
