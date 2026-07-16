// ============================================================================
// Account-status helper.
// ----------------------------------------------------------------------------
// Whether an authenticated caller's account is enabled (profiles.status, 0052).
// middleware.js gates disabled users to /account-disabled for PAGE navigation but
// deliberately exempts /api (an API route must return JSON, not a redirect), so the
// sensitive routes call this to reject a disabled caller at the account layer.
//
// Pass a server client bound to the caller's own session — the read runs under the
// profiles self-read RLS (0001), which a disabled user can still see for their own
// row. Fail-open on a read miss/error (mirrors middleware): only an explicit
// 'disabled' blocks, so a transient DB blip never locks out a legitimate user.
// ============================================================================

export async function isAccountEnabled(supabase, userId) {
  if (!userId) return false;
  const { data } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", userId)
    .maybeSingle();
  return data?.status !== "disabled";
}
