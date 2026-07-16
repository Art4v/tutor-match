// ============================================================================
// Report helpers (client-readable slice of public.reports).
// ----------------------------------------------------------------------------
// The reports table is service-role-written (0053); the ONLY thing a client can
// do is read its OWN reports (RLS: reporter_id = auth.uid()). This helper backs
// the messages UI guard that stops a reporter filing a second report against
// someone while their first is still pending review.
//
// Pass in a Supabase client — createSupabaseBrowserClient() in client
// components, createSupabaseServerClient() in server components / routes.
// ============================================================================

/**
 * Whether the caller already has a PENDING report against `reportedId`. RLS
 * scopes the read to the caller's own rows, so this can't leak other reporters'
 * reports. Returns false on error / when there's none.
 */
export async function hasPendingReport(supabase, reportedId) {
  if (!reportedId) return false;
  const { data } = await supabase
    .from("reports")
    .select("id")
    .eq("reported_id", reportedId)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();
  return !!data;
}
