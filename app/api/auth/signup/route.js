import { NextResponse } from "next/server";
import dns from "node:dns/promises";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validatePassword } from "@/lib/password";
import { validateEmailFormat, getEmailDomain } from "@/lib/email";

export const runtime = "nodejs";

// Does the domain actually exist and accept mail? A deliverable domain has MX
// records; some smaller domains accept mail via an implicit MX (their A/AAAA
// record), so we fall back to that. A typo'd domain ("gmial.con") resolves to
// neither and is rejected. Returns false on any lookup failure.
async function domainCanReceiveMail(domain) {
  try {
    const mx = await dns.resolveMx(domain);
    if (mx.length > 0) return true;
  } catch {
    // No MX records (or NXDOMAIN) — fall through to the A/AAAA check.
  }
  try {
    await dns.lookup(domain);
    return true;
  } catch {
    return false;
  }
}

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

  const { fullName, email, password, role } = body ?? {};

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

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      // These end up in auth.users.raw_user_meta_data, where the
      // handle_new_user() trigger reads them to populate the profile rows.
      data: { full_name: fullName ?? "", role: role === "student" ? "student" : "tutor" },
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
