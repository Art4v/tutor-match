import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdminRequest, readJson, cleanReason, adminRpcErrorResponse, revalidateIndexable } from "@/lib/admin/route";

export const runtime = "nodejs";

// Permanently delete a company from /admin/companies: its tutors' shadow
// accounts, packages and reviews go with it, and a claimed owner keeps their
// account with role reset to NULL. POST { companyId, reason? }. The body of
// admin_delete_company (0074) is supabase/utilities/delete_company.sql.
// Storage files are left behind, as with that script.
export async function POST(request) {
  const gate = await requireAdminRequest();
  if (gate.res) return gate.res;

  const body = await readJson(request);
  if (!body?.companyId) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { data: result, error } = await gate.supabase.rpc("admin_delete_company", {
    p_partner_id: body.companyId,
    p_reason: cleanReason(body.reason),
  });
  if (error) return adminRpcErrorResponse(error, "Could not delete the company, please try again.");

  revalidateIndexable(revalidatePath);
  revalidatePath("/companies");
  return NextResponse.json({ ok: true, tutors: result?.tutors ?? 0 });
}
