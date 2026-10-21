import { NextResponse } from "next/server";
import { requireAdminRequest, readJson, cleanReason, adminRpcErrorResponse } from "@/lib/admin/route";

export const runtime = "nodejs";

// Grant or revoke blog authoring (profiles.can_author_articles) from
// /admin/users. POST { userId, enabled, reason? }. admin_set_author (0074)
// requires a tutor target and refuses admins and the caller. is_admin itself
// has no route: it is granted and revoked only in SQL.
export async function POST(request) {
  const gate = await requireAdminRequest();
  if (gate.res) return gate.res;

  const body = await readJson(request);
  if (!body?.userId || typeof body?.enabled !== "boolean") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { data: result, error } = await gate.supabase.rpc("admin_set_author", {
    p_user_id: body.userId,
    p_enabled: body.enabled,
    p_reason: cleanReason(body.reason),
  });
  if (error) return adminRpcErrorResponse(error, "Could not change authoring, please try again.");

  return NextResponse.json({ ok: true, applied: !!result?.applied, enabled: !!result?.enabled });
}
