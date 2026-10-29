import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAccountEnabled } from "@/lib/supabase/account";
import { sweepInviteMaterials } from "@/lib/supabase/storage";

export const runtime = "nodejs";

// POST { docs: [{ path, title }], links: [url] } from /join/details, after the
// browser has uploaded the files to the private bucket. The RPC is the
// boundary: it checks the caller is managed, has not submitted before, owns
// every path and stays within the caps. Empty arrays = Skip.
export async function POST(request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!(await isAccountEnabled(supabase, user.id))) {
    return NextResponse.json({ error: "Your account is disabled." }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const docs = Array.isArray(body?.docs) ? body.docs : [];
  const links = Array.isArray(body?.links) ? body.links : [];

  const { error } = await supabase.rpc("submit_invite_materials", { p_docs: docs, p_links: links });
  if (error) {
    if (error.hint === "already_submitted") {
      return NextResponse.json({ status: "already" });
    }
    const status = error.code === "22023" ? 400 : error.code === "42501" ? 403 : 500;
    if (status === 500) console.error("[join] submit materials failed:", error);
    return NextResponse.json(
      { error: status === 500 ? "Could not send your documents. Please try again." : error.message },
      { status }
    );
  }
  // Now registered: exactly `docs`. Anything else in the folder came from an
  // earlier attempt that never got here (a failed send, a file removed from
  // the form, or Skip after a failed send); nobody can see it and the tutor
  // can't delete it, so remove it.
  await sweepInviteMaterials(createSupabaseAdminClient(), user.id, {
    keep: docs.map((d) => d?.path).filter((p) => typeof p === "string"),
  });
  return NextResponse.json({ status: "submitted" });
}
