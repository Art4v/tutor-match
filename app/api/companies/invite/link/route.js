import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { companyClaimUrl } from "@/lib/companyToken";
import { inviteRpcErrorResponse } from "../errors";

export const runtime = "nodejs";

/**
 * POST { companyId } — a freshly signed claim link for an unclaimed company.
 * The in-app equivalent of `npm run create:company -- --link <uuid>`.
 *
 * Nothing is stored: every call signs a new token, which also restarts the
 * 90-day expiry. partner_link_target (0068) is the gate. It raises for anyone
 * without can_invite_companies and says whether the company is still
 * unclaimed, because a link for a claimed company would be inert.
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const companyId = typeof body?.companyId === "string" ? body.companyId : "";
  if (!/^[0-9a-f-]{36}$/i.test(companyId)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to invite a company." }, { status: 401 });
  }

  const { data: unclaimed, error } = await supabase.rpc("partner_link_target", { p_id: companyId });
  if (error) return inviteRpcErrorResponse(error, "Could not create a link.");

  if (unclaimed === null) {
    return NextResponse.json({ error: "That company no longer exists." }, { status: 404 });
  }
  if (unclaimed === false) {
    return NextResponse.json({ error: "This company has already been claimed." }, { status: 409 });
  }

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  return NextResponse.json({ link: companyClaimUrl(origin, companyId) });
}
