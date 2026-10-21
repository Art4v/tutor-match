import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdminRequest, readJson, cleanReason, adminRpcErrorResponse, revalidateIndexable } from "@/lib/admin/route";

export const runtime = "nodejs";

// Disable or re-enable an account from /admin/users.
// POST { userId, status: "enabled" | "disabled", reason? }.
// admin_set_account_status (0074) refuses admins and the caller themselves;
// demoting or disabling an admin is a SQL job (grant_admin.sql).
export async function POST(request) {
  const gate = await requireAdminRequest();
  if (gate.res) return gate.res;

  const body = await readJson(request);
  if (!body?.userId || !["enabled", "disabled"].includes(body?.status)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { data: result, error } = await gate.supabase.rpc("admin_set_account_status", {
    p_user_id: body.userId,
    p_status: body.status,
    p_reason: cleanReason(body.reason),
  });
  if (error) return adminRpcErrorResponse(error, "Could not change the account, please try again.");

  // A tutor entering or leaving the public set changes the cached listings.
  if (result?.applied) revalidateIndexable(revalidatePath);

  return NextResponse.json({ ok: true, applied: !!result?.applied, status: result?.status ?? body.status });
}
