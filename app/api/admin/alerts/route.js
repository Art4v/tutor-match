import { NextResponse } from "next/server";
import { requireAdminRequest, readJson } from "@/lib/admin/route";

export const runtime = "nodejs";

// Mute or unmute the caller's own admin alert emails (profiles.admin_alerts_muted,
// 0074). POST { muted }. Written through "profile self update" on the
// caller's own row, so it can only ever change the caller's setting.
export async function POST(request) {
  const gate = await requireAdminRequest();
  if (gate.res) return gate.res;

  const body = await readJson(request);
  if (typeof body?.muted !== "boolean") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { error } = await gate.supabase
    .from("profiles")
    .update({ admin_alerts_muted: body.muted })
    .eq("id", gate.user.id);
  if (error) {
    console.error("[admin/alerts] update failed:", error);
    return NextResponse.json({ error: "Could not save, please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, muted: body.muted });
}
