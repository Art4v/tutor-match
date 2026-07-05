import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validatePassword } from "@/lib/password";
import { validateEmailFormat, getEmailDomain } from "@/lib/email";
import { domainCanReceiveMail } from "@/lib/mailDomain";

export const runtime = "nodejs";

// Server-side signup gate. The browser form validates the password too, but
// this route is the authoritative check: it re-runs the policy and only then
// performs the actual auth.signUp, so a client that skips validation (JS off,
// raw POST) still can't create a weak-password account. The server client also
// writes the session cookies onto this response when confirmation is disabled.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { fullName, email, password, role, agreed } = body ?? {};

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 }
    );
  }

  // Email: syntax first (cheap), then confirm the domain actually exists.
  if (!validateEmailFormat(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 }
    );
  }
  if (!(await domainCanReceiveMail(getEmailDomain(email)))) {
    return NextResponse.json(
      { error: "That email domain doesn't appear to exist. Check for typos." },
      { status: 400 }
    );
  }

  const { valid, failed } = validatePassword(password);
  if (!valid) {
    return NextResponse.json(
      {
        error: "Password does not meet the security requirements.",
        failed: failed.map((rule) => rule.id),
      },
      { status: 400 }
    );
  }

  // Legal agreement is required to create an account. The browser gates the
  // submit button on this too, but a raw POST must not bypass it.
  if (agreed !== true) {
    return NextResponse.json(
      { error: "You must agree to the Terms of Service and Privacy Policy." },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServerClient();
  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  // Allowlist the client-sent role; anything unexpected collapses to student —
  // the least-privileged role (no slug, no public profile page). The DB-side
  // default is the opposite: handle_new_user() coalesces a MISSING role to
  // 'tutor', which OAuth signups (no role metadata) rely on and never hits
  // this route.
  const normalizedRole = role === "tutor" ? "tutor" : "student";
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      // The confirm-signup email link routes through /auth/callback (token_hash
      // /type=signup, mirroring the recovery flow) so confirmation mints a
      // session and lands the user logged-in — tutors at /profile (which
      // resolves their slug), students at / (no profile page yet) — and gives
      // the callback an app-side hook to send the welcome.
      emailRedirectTo: `${origin}/auth/callback?next=${normalizedRole === "student" ? "/" : "/profile"}`,
      // These end up in auth.users.raw_user_meta_data, where the
      // handle_new_user() trigger reads them to populate the profile rows.
      data: { full_name: fullName ?? "", role: normalizedRole },
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Supabase doesn't error when the email is already registered (it avoids
  // leaking which emails exist) — it returns a user with an empty `identities`
  // array. Surface that as a distinct status so the client can point to login.
  if (
    data.user &&
    Array.isArray(data.user.identities) &&
    data.user.identities.length === 0
  ) {
    return NextResponse.json({ status: "exists" });
  }

  // No session means email confirmation is enabled — the user must click the
  // link before they're logged in.
  if (!data.session) {
    return NextResponse.json({ status: "confirm" });
  }

  return NextResponse.json({ status: "session" });
}
