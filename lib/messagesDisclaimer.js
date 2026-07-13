// Single source of truth for the messages-disclaimer version.
//
// Bump this date whenever the "About these messages" disclaimer copy materially
// changes. Any user whose profiles.messages_disclaimer_ack_at predates it (or is
// null) is re-prompted by the first-open gate on /messages. Unlike the policy
// consent, this is NOT stamped on signup, so brand-new users see it once too.
export const DISCLAIMER_EFFECTIVE_DATE = "2026-07-13T00:00:00Z";

// True when a stored acknowledgment timestamp is missing or older than the
// current disclaimer version — i.e. the user must (re-)acknowledge.
export function needsMessagesDisclaimer(ackAt) {
  if (!ackAt) return true;
  return new Date(ackAt).getTime() < new Date(DISCLAIMER_EFFECTIVE_DATE).getTime();
}
