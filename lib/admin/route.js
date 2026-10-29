// Shared by every /api/admin route (SERVER-ONLY).
//
// The routes are the convenience layer: the boundary is the SECURITY DEFINER
// admin RPCs from 0074, which each re-check is_admin() and run through the
// caller's own session client. These helpers just give a clean 401/403 and map
// the RPCs' errcodes onto HTTP statuses the same way everywhere.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const MAX_REASON = 500; // must match the admin_actions CHECK

/**
 * Signed in and an enabled admin. Returns { supabase, user } or { res }.
 * `supabase` is the user-scoped client: call the admin RPCs through it, never
 * through the service role, or the RPC's own check sees no caller.
 */
export async function requireAdminRequest() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { res: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) };
  }
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) {
    return { res: NextResponse.json({ error: "Admins only." }, { status: 403 }) };
  }
  return { supabase, user };
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function cleanReason(value) {
  return typeof value === "string" ? value.trim().slice(0, MAX_REASON) : "";
}

/**
 * 42501 = not an admin, 22023 = refused input (message written to be shown),
 * P0002 = no such row. Anything else is a 500 with `fallback`.
 * 42501 with hint not_managed (0076) is the exception: the caller IS an admin,
 * the tutor just isn't managed any more (they opted out), so say that.
 */
export function adminRpcErrorResponse(error, fallback) {
  if (error?.code === "42501" && error.hint === "not_managed") {
    return NextResponse.json({ error: "This tutor is not managed by MatchTutor any more." }, { status: 409 });
  }
  if (error?.code === "42501") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }
  if (error?.code === "22023") {
    // 0074's messages are lowercase with no full stop; some later ones are
    // whole sentences already. Capitalise, and end with exactly one stop.
    const msg = error.message
      ? error.message.charAt(0).toUpperCase() + error.message.slice(1) + (/[.!?]$/.test(error.message) ? "" : ".")
      : fallback;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  if (error?.code === "P0002") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  console.error("[admin]", fallback, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

/** Origin of the request, for absolute links in notification emails. */
export function originOf(request) {
  return new URL(request.url).origin;
}

/**
 * The latest History row for a target, so an "already decided" answer can say
 * who decided and when. Read through the caller's client (admin-only RLS).
 * `actionPrefix` narrows it to one kind of decision: a tutor collects several
 * (verification, and the 0076 managed-profile actions), and the newest row of
 * another kind is not the one that decided this.
 */
export async function lastAdminAction(supabase, targetType, targetId, actionPrefix = null) {
  let query = supabase
    .from("admin_actions")
    .select("action, admin_name, created_at")
    .eq("target_type", targetType)
    .eq("target_id", targetId);
  if (actionPrefix) query = query.like("action", `${actionPrefix}%`);
  const { data } = await query
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? { by: data.admin_name || "another admin", at: data.created_at, action: data.action } : null;
}

/** Refresh the hourly-cached machine-facing pages after the indexable set changes. */
export function revalidateIndexable(revalidatePath) {
  try {
    revalidatePath("/tutors", "layout");
    revalidatePath("/sitemap.xml");
    revalidatePath("/llms.txt");
    revalidatePath("/llms-full.txt");
  } catch (err) {
    console.error("[admin] revalidate failed:", err);
  }
}
