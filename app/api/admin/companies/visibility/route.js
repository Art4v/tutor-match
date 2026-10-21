import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdminRequest, readJson, cleanReason, adminRpcErrorResponse, revalidateIndexable } from "@/lib/admin/route";

export const runtime = "nodejs";

// Hide or show a company from /admin/companies.
// POST { companyId, visibility: "public" | "hidden", reason? }. The 0065
// cascade trigger carries the change to the company's tutors.
export async function POST(request) {
  const gate = await requireAdminRequest();
  if (gate.res) return gate.res;

  const body = await readJson(request);
  if (!body?.companyId || !["public", "hidden"].includes(body?.visibility)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { data: result, error } = await gate.supabase.rpc("admin_set_company_visibility", {
    p_partner_id: body.companyId,
    p_visibility: body.visibility,
    p_reason: cleanReason(body.reason),
  });
  if (error) return adminRpcErrorResponse(error, "Could not change the company, please try again.");

  if (result?.applied) {
    revalidateIndexable(revalidatePath);
    revalidatePath("/companies");
  }
  return NextResponse.json({ ok: true, applied: !!result?.applied, visibility: result?.visibility ?? body.visibility });
}
