import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkSignupInput } from "@/lib/signupValidation";
import { safeNext } from "@/lib/roles";

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

  const { fullName, email, password, agreed, next } = body ?? {};
  // Re-sanitise rather than trusting the client's own safeNext() call: this
  // value ends up in an email link, which is the last place to be relaxed about
  // an attacker-supplied destination.
  const nextPath = safeNext(next);

  const invalid = await checkSignupInput({ email, password, agreed });
  if (invalid) {
    return NextResponse.json(invalid, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  // Role is no longer chosen at signup (0041) — every new account is created
  // with a NULL role and picks tutor/student at /choose-role after auth.
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      // The confirm-signup email link routes through /auth/callback (token_hash
      // /type=signup, mirroring the recovery flow) so confirmation mints a
      // session and lands the user logged-in. The callback then routes a
      // NULL-role account to /choose-role; the `next` here is just a fallback.
      // A company invite overrides it, so confirming the email lands the company
      // on the claim page instead of a chooser that would reject their role.
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath ?? "/choose-role")}`,
      // full_name ends up in auth.users.raw_user_meta_data, where
      // handle_new_user() reads it to populate the profiles row.
      data: { full_name: fullName ?? "" },
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
