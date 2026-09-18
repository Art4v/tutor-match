import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { companyClaimUrl } from "@/lib/companyToken";
import { inviteRpcErrorResponse } from "./errors";

export const runtime = "nodejs";

/**
 * POST { name, website?, suburb?, state?, allowDuplicate? } — create a company
 * from /companies/invite and return its claim link.
 *
 * Runs through the USER-SCOPED client on purpose: create_partner_as_inviter
 * (0068) is SECURITY DEFINER and checks profiles.can_invite_companies against
 * auth.uid() itself, so the database is the gate. There is no flag check here
 * because a second copy of it could only ever disagree with the real one.
 *
 * The company is created HIDDEN. It goes live when the company claims it and
 * clicks "Make my page live".
 *
 * Responses: 401 signed out, 403 not an inviter, 400 bad input,
 * 200 { status: "duplicate", matches } when the name already exists and
 * allowDuplicate is false, 200 { status: "created", slug, link } on success.
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to invite a company." }, { status: 401 });
  }

  const str = (v) => (typeof v === "string" ? v : "");
  const { data, error } = await supabase.rpc("create_partner_as_inviter", {
    p_name: str(body?.name),
    p_website: str(body?.website),
    p_suburb: str(body?.suburb),
    p_state: str(body?.state),
    p_allow_duplicate: body?.allowDuplicate === true,
  });

  if (error) return inviteRpcErrorResponse(error, "Could not create the company.");

  if (data?.status === "duplicate") {
    return NextResponse.json({ status: "duplicate", matches: data.matches ?? [] });
  }

  // Same origin derivation as /api/auth/forgot-password: the link must point
  // at whichever deployment the inviter is using, never at a hardcoded host.
  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  return NextResponse.json({
    status: "created",
    slug: data.slug,
    link: companyClaimUrl(origin, data.id),
  });
}
