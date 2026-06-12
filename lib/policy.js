// Single source of truth for the legal-agreement version.
//
// Bump this date whenever the Terms of Service or Privacy Policy materially
// change. Any tutor whose tutor_profiles.terms_agreed_at predates it is
// re-prompted by PolicyConsentGate on their next page load. New signups are
// stamped now() by handle_new_user() (migration 0025), so they're always
// past this date and never see the modal.
export const POLICY_EFFECTIVE_DATE = "2026-06-12T00:00:00Z";

// True when a stored consent timestamp is missing or older than the current
// policy version — i.e. the user must (re-)agree.
export function needsPolicyConsent(termsAgreedAt) {
  if (!termsAgreedAt) return true;
  return new Date(termsAgreedAt).getTime() < new Date(POLICY_EFFECTIVE_DATE).getTime();
}
