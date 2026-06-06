import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validateEmailFormat, getEmailDomain } from "@/lib/email";
import { domainCanReceiveMail } from "@/lib/mailDomain";

export const runtime = "nodejs";

// Server-side "send a password reset link" gate. Mirrors the signup route's
// validation ladder (format -> domain exists) so an obviously-bad address is
// rejected before we ask Supabase to send mail.
//
// Account enumeration: Supabase's resetPasswordForEmail deliberately succeeds
// whether or not the email is registered, and so do we. A well-formed,
// deliverable-domain request always returns { status: "sent" }; we never reveal
// whether an account exists. Only malformed input gets a 400.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { email } = body ?? {};

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }
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

  const supabase = createSupabaseServerClient();
  const origin = request.headers.get("origin") ?? new URL(request.url).origin;

  // The redirect lands on /auth/callback, which exchanges the recovery code for
  // a session and forwards to /reset-password. We ignore the result: Supabase
  // succeeds whether or not the email is registered, and we never surface a
  // Supabase-side error either, so the response stays the same neutral "sent".
  await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  return NextResponse.json({ status: "sent" });
}
