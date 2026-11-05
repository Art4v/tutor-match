"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { validateEmailFormat } from "@/lib/email";
import { AuthHeading, AuthFootnote, Field, FieldError, Input, Notice, StatusLine, LINK_CLASS } from "../_components/fields";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  const emailValid = validateEmailFormat(email);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Instant client-side feedback; /api/auth/forgot-password re-checks the
    // format and additionally verifies the domain can receive mail.
    if (!emailValid) {
      setEmailTouched(true);
      setError("Please enter a valid email address.");
      return;
    }

    setSubmitting(true);
    let res;
    let payload;
    try {
      res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      payload = await res.json();
    } catch {
      setSubmitting(false);
      setError("Something went wrong. Please try again.");
      return;
    }
    setSubmitting(false);

    if (!res.ok) {
      setError(payload?.error ?? "Couldn't send the reset email. Please try again.");
      return;
    }
    // Always a neutral confirmation — we never reveal whether the email exists.
    setSent(true);
  };

  return (
    <div>
      <AuthHeading title="Reset your password">
        Enter your account email and we&rsquo;ll send you a link to set a new password.
      </AuthHeading>

      {sent ? (
        <Notice>
          If an account exists for <span className="font-semibold">{email}</span>, we&rsquo;ve sent it a link to
          reset your password. Open it to choose a new password, then come back and{" "}
          <Link href="/login" className={LINK_CLASS}>
            log in
          </Link>
          .
        </Notice>
      ) : (
        <form onSubmit={onSubmit} className="space-y-6">
          <div>
            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setEmailTouched(true)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                aria-invalid={emailTouched && email.length > 0 && !emailValid}
              />
            </Field>
            {emailTouched && email.length > 0 && !emailValid && (
              <FieldError>Enter a valid email address, e.g. you@example.com</FieldError>
            )}
          </div>

          {error && <StatusLine>{error}</StatusLine>}

          <Button type="submit" variant="primary" size="lg" full disabled={submitting}>
            {submitting ? "Sending link\u2026" : "Send reset link"}
          </Button>
        </form>
      )}

      <AuthFootnote>
        {sent ? (
          <>Can&rsquo;t find the email? Check your spam or junk folder.</>
        ) : (
          <>
            Remembered it?{" "}
            <Link href="/login" className={LINK_CLASS}>
              Log in
            </Link>
          </>
        )}
      </AuthFootnote>
    </div>
  );
}
