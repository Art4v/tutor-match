// ============================================================================
// Server-side signup checks (SERVER-ONLY), shared by /api/auth/signup and the
// tutor invite signup (/api/join/signup) so the two can never disagree on what
// a valid account is.
// ============================================================================

import { validatePassword } from "@/lib/password";
import { validateEmailFormat, getEmailDomain } from "@/lib/email";
import { domainCanReceiveMail } from "@/lib/mailDomain";

/**
 * Returns null when the input is acceptable, else { error, failed? } to send
 * back with a 400.
 */
export async function checkSignupInput({ email, password, agreed }) {
  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  // Email: syntax first (cheap), then confirm the domain actually exists.
  if (!validateEmailFormat(email)) {
    return { error: "Please enter a valid email address." };
  }
  if (!(await domainCanReceiveMail(getEmailDomain(email)))) {
    return { error: "That email domain doesn't appear to exist. Check for typos." };
  }

  const { valid, failed } = validatePassword(password);
  if (!valid) {
    return {
      error: "Password does not meet the security requirements.",
      failed: failed.map((rule) => rule.id),
    };
  }

  // Legal agreement is required to create an account. The browser gates the
  // submit button on this too, but a raw POST must not bypass it.
  if (agreed !== true) {
    return { error: "You must agree to the Terms of Service and Privacy Policy." };
  }
  return null;
}
