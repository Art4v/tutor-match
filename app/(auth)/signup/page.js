"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { PasswordChecklist } from "@/components/PasswordChecklist";
import OAuthButtons from "@/components/OAuthButtons";
import { Wordmark } from "@/components/Logo";
import { validatePassword } from "@/lib/password";
import { validateEmailFormat } from "@/lib/email";
import { safeNext } from "@/lib/roles";
import { AuthHeading, AuthFootnote, Check, Field, FieldError, Input, Notice, PasswordInput, StatusLine, LINK_CLASS } from "../_components/fields";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [password, setPassword] = useState("");
  const [pwTouched, setPwTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [isOver16, setIsOver16] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  const pw = validatePassword(password);
  const emailValid = validateEmailFormat(email);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Client-side gates: instant feedback so the user fixes obvious problems
    // before a round-trip. The /api/auth/signup route re-checks both of these
    // authoritatively (and additionally verifies the email domain exists).
    if (!emailValid) {
      setEmailTouched(true);
      setError("Please enter a valid email address.");
      return;
    }
    if (!pw.valid) {
      setPwTouched(true);
      setError("Please choose a password that meets all the requirements below.");
      return;
    }
    if (!passwordsMatch) {
      setConfirmTouched(true);
      setError("The passwords you entered don't match.");
      return;
    }
    if (!agreed) {
      setError("Please agree to the Terms of Service and Privacy Policy to continue.");
      return;
    }
    if (!isOver16) {
      setError("You must be 16 years or older to create an account.");
      return;
    }

    setSubmitting(true);
    // Read ?next= straight off the URL rather than with useSearchParams: this
    // page has no Suspense boundary (unlike /login), and the handler only ever
    // runs in the browser. safeNext rejects anything that isn't a same-origin
    // path, so this can't become an open redirect.
    const next = safeNext(new URLSearchParams(window.location.search).get("next"));
    let res;
    let payload;
    try {
      res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, password, agreed, next }),
      });
      payload = await res.json();
    } catch {
      setSubmitting(false);
      setError("Something went wrong. Please try again.");
      return;
    }
    setSubmitting(false);

    if (!res.ok) {
      setError(payload?.error ?? "Sign up failed. Please try again.");
      return;
    }
    // Supabase returns a user with an empty `identities` array when the email
    // is already registered — point the user to login rather than "confirm".
    if (payload.status === "exists") {
      setError("An account with this email already exists. Try logging in instead.");
      return;
    }
    // No session means email confirmation is enabled in Supabase.
    if (payload.status === "confirm") {
      setNeedsConfirm(true);
      return;
    }
    // Role is chosen after signup: everyone goes through the /choose-role gate
    // (which creates the tutor/student row) before landing anywhere else. The
    // exception is an invite link, whose ?next= carries them to the claim page
    // instead — a company's role is set by claiming, never by the chooser.
    router.push(next ?? "/choose-role");
    router.refresh();
  };

  return (
    <div>
      <AuthHeading title="Create an account">
        Join <Wordmark matchColor="var(--text-2)" /> as a tutor or a student.
      </AuthHeading>

      {needsConfirm ? (
        <Notice>
          Almost there. We&rsquo;ve sent a confirmation link to{" "}
          <span className="font-semibold">{email}</span>. Open it to finish setting up your account, then come
          back and{" "}
          <Link href="/login" className={LINK_CLASS}>
            log in
          </Link>
          .
        </Notice>
      ) : (
        <>
          <form onSubmit={onSubmit} className="space-y-6">
            <Field label="Full name">
              <Input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
              />
            </Field>

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

            <div>
              <Field label="Password">
                <PasswordInput
                  shown={showPassword}
                  onToggle={() => setShowPassword((v) => !v)}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => setPwTouched(true)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  aria-invalid={pwTouched && !pw.valid}
                />
              </Field>
              <PasswordChecklist password={password} show={pwTouched || password.length > 0} />
            </div>

            <div>
              <Field label="Confirm password">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onBlur={() => setConfirmTouched(true)}
                  required
                  autoComplete="new-password"
                  aria-invalid={confirmTouched && confirmPassword.length > 0 && !passwordsMatch}
                />
              </Field>
              {confirmTouched && confirmPassword.length > 0 && !passwordsMatch && (
                <FieldError>Passwords don&rsquo;t match.</FieldError>
              )}
            </div>

            <div>
              <Check checked={agreed} onChange={setAgreed}>
                I agree to the{" "}
                <Link href="/terms-of-service" target="_blank" rel="noopener" className={LINK_CLASS}>
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy-policy" target="_blank" rel="noopener" className={LINK_CLASS}>
                  Privacy Policy
                </Link>
                .
              </Check>
              <Check checked={isOver16} onChange={setIsOver16}>
                I confirm that I am 16 years of age or older.
              </Check>
            </div>

            {error && <StatusLine>{error}</StatusLine>}

            <Button type="submit" variant="primary" size="lg" full disabled={submitting}>
              {submitting ? "Creating account\u2026" : "Create account"}
            </Button>
          </form>
          {/* Role is chosen after auth (/choose-role), so Google works for
              everyone now — no need to hide it behind a role selection. */}
          <div className="mt-6">
            <OAuthButtons divider="top" />
            <p className="text-[12px] leading-4 text-muted mt-3 text-center">
              By continuing with Google, you agree to our{" "}
              <Link href="/terms-of-service" target="_blank" rel="noopener" className="text-accent hover:text-accent-hover">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy-policy" target="_blank" rel="noopener" className="text-accent hover:text-accent-hover">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </>
      )}

      <AuthFootnote>
        {needsConfirm ? (
          <>Can&rsquo;t find the email? Check your spam or junk folder.</>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className={LINK_CLASS}>
              Log in
            </Link>
          </>
        )}
      </AuthFootnote>
    </div>
  );
}
