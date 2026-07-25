import { NextResponse } from "next/server";
import { sendEmail, bugReportEmail } from "@/lib/email/send";
import { validateEmailFormat } from "@/lib/email";
import { checkRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "matchtutoraustralia@gmail.com";
const MAX_NAME = 200;
const MAX_MESSAGE = 5000;
const RATE_LIMIT = 5; // reports per window per IP
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Anyone (logged in or not) can file a bug report; it's emailed to the team
// inbox with the reporter's address as Reply-To. Deliberately NOT auth-gated so
// a logged-out visitor who hits a bug can still tell us. Defended by a hidden
// honeypot field + a best-effort per-IP rate limit (see lib/rateLimit.js). No
// DB storage: the report is the email.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Honeypot: real users never fill a hidden field. Bots that do get a fake
  // success so they learn nothing, and nothing is sent.
  if (typeof body?.company === "string" && body.company.trim() !== "") {
    return NextResponse.json({ status: "sent" });
  }

  const name = typeof body?.name === "string" ? body.name.trim().slice(0, MAX_NAME) : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim().slice(0, MAX_MESSAGE) : "";

  if (!name) {
    return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  }
  if (!validateEmailFormat(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ error: "Please describe the bug." }, { status: 400 });
  }

  // Rate limit on the client IP (first hop of x-forwarded-for). Soft cap only.
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  const { allowed } = checkRateLimit(`bug-report:${ip}`, { limit: RATE_LIMIT, windowMs: RATE_WINDOW_MS });
  if (!allowed) {
    return NextResponse.json(
      { error: "You've sent a few reports already. Please try again later." },
      { status: 429 }
    );
  }

  const result = await sendEmail({
    to: ADMIN_EMAIL,
    replyTo: email,
    subject: `Bug report from ${name}`,
    html: bugReportEmail({ name, email, message }),
  });

  if (!result.ok) {
    return NextResponse.json({ error: "Could not send your report. Please try again." }, { status: 502 });
  }

  return NextResponse.json({ status: "sent" });
}
