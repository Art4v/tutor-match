import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdminRequest, readJson } from "@/lib/admin/route";
import { purgeVerificationDocs } from "@/lib/admin/verificationDocs";

export const runtime = "nodejs";

// POST { tutorId }: retries deleting a tutor's private supporting documents
// after a failed attempt (0079). It removes files flagged by reaching verified
// and uploads no row points at, never a file still attached to a request. It is
// a retry rather than a decision, so nothing is written to History.
export async function POST(request) {
  const gate = await requireAdminRequest();
  if (gate.res) return gate.res;

  const body = await readJson(request);
  if (typeof body?.tutorId !== "string" || !body.tutorId) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const result = await purgeVerificationDocs(createSupabaseAdminClient(), body.tutorId);
  if (!result.ok) {
    return NextResponse.json({ error: "The files could not be deleted. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
