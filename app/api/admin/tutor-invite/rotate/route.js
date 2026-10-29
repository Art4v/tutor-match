import { NextResponse } from "next/server";
import { requireAdminRequest, adminRpcErrorResponse, originOf } from "@/lib/admin/route";
import { tutorInviteUrl } from "@/lib/tutorInvite";

export const runtime = "nodejs";

// POST (no body): replace the tutor invite key (0076). The old link stops
// working at once; accounts that already redeemed it are unaffected.
export async function POST(request) {
  const gate = await requireAdminRequest();
  if (gate.res) return gate.res;
  const { data, error } = await gate.supabase.rpc("admin_rotate_tutor_invite_key");
  if (error) return adminRpcErrorResponse(error, "Could not rotate the link, please try again.");
  return NextResponse.json({ ok: true, key: data.key, link: tutorInviteUrl(originOf(request), data.key), rotatedAt: data.rotated_at });
}
