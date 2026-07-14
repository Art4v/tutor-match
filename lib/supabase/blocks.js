// ============================================================================
// Blocking helpers (student <-> tutor mutual block).
// ----------------------------------------------------------------------------
// Thin wrappers over public.blocked_users (supabase/migrations/0049_blocking.sql).
// Block/unblock are plain self-RLS writes: a row where blocker_id = auth.uid()
// means "I have blocked blocked_id". The DB enforces the actual messaging freeze
// (messages INSERT policy + start_conversation guard); these helpers just manage
// the row and let the UI reflect state.
//
// Pass in a Supabase client — createSupabaseBrowserClient() in client
// components, createSupabaseServerClient() in server components / routes.
// ============================================================================

/** Block `blockedId`. Idempotent (PK on-conflict is a no-op). Returns { ok }. */
export async function blockUser(supabase, blockedId) {
  if (!blockedId) return { ok: false, error: "no-target" };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not-authenticated" };
  if (user.id === blockedId) return { ok: false, error: "cannot-block-self" };

  const { error } = await supabase
    .from("blocked_users")
    .upsert({ blocker_id: user.id, blocked_id: blockedId }, { onConflict: "blocker_id,blocked_id" });
  if (error) {
    console.error("[blocks] block failed:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Unblock `blockedId`. No-op if there was no block. Returns { ok }. */
export async function unblockUser(supabase, blockedId) {
  if (!blockedId) return { ok: false, error: "no-target" };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not-authenticated" };

  const { error } = await supabase
    .from("blocked_users")
    .delete()
    .eq("blocker_id", user.id)
    .eq("blocked_id", blockedId);
  if (error) {
    console.error("[blocks] unblock failed:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * The set of user ids the caller has blocked. RLS scopes the read to the
 * caller's own rows, so this is just "select blocked_id". Returns a Set<string>
 * (empty on error / none).
 */
export async function getBlockedIds(supabase, userId) {
  if (!userId) return new Set();
  const { data, error } = await supabase.from("blocked_users").select("blocked_id");
  if (error || !data) return new Set();
  return new Set(data.map((r) => r.blocked_id));
}

/**
 * Whether `otherId` has blocked the caller (the reverse of isBlocked). Uses the
 * is_blocked_by RPC (0051) because blocked_users' RLS hides blocks from the
 * blocked party. Returns false on error / when not blocked.
 */
export async function isBlockedByUser(supabase, otherId) {
  if (!otherId) return false;
  const { data } = await supabase.rpc("is_blocked_by", { p_user_id: otherId });
  return !!data;
}

/** Whether the caller has blocked `otherId`. Convenience over getBlockedIds. */
export async function isBlocked(supabase, otherId) {
  if (!otherId) return false;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("blocked_users")
    .select("blocked_id")
    .eq("blocker_id", user.id)
    .eq("blocked_id", otherId)
    .maybeSingle();
  return !!data;
}
