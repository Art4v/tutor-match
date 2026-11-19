import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdminRequest, readJson, adminRpcErrorResponse, originOf } from "@/lib/admin/route";
import { isUuid, notifySetupReady } from "../shared";

export const runtime = "nodejs";

// POST { tutorId } (0081). Email the tutor again while their answer is
// outstanding. Applies only in `sent`; the original message is repeated.
export async function POST(request) {
  const gate = await requireAdminRequest();
  if (gate.res) return gate.res;
  const { supabase } = gate;

  const body = await readJson(request);
  if (!isUuid(body?.tutorId)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { data: result, error } = await supabase.rpc("admin_resend_managed_setup", { p_tutor_id: body.tutorId });
  if (error) return adminRpcErrorResponse(error, "Could not resend the email, please try again.");
  if (!result?.applied) {
    // The tutor answered, or another admin recalled it, in the meantime.
    return NextResponse.json({ ok: true, applied: false, status: result?.status ?? null });
  }

  await notifySetupReady(createSupabaseAdminClient(), body.tutorId, {
    name: result.name,
    message: result.message,
    origin: originOf(request),
    reminder: true,
  });
  return NextResponse.json({ ok: true, status: result.status });
}
