"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui";
import { validatePassword } from "@/lib/password";
import { PasswordChecklist } from "@/components/PasswordChecklist";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { AuthHeading, AuthFootnote, Field, FieldError, PasswordInput, StatusLine, LINK_CLASS } from "../_components/fields";

// Auth states while we resolve whether the recovery link produced a session.
const CHECKING = "checking";
const READY = "ready";
const INVALID = "invalid";

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [authState, setAuthState] = useState(CHECKING);
  const [password, setPassword] = useState("");
  const [pwTouched, setPwTouched] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const pw = validatePassword(password);
  const confirmMismatch = confirm.length > 0 && confirm !== password;

  // The /auth/callback route exchanges the recovery code for a session before
  // redirecting here. Confirm that session exists — a missing one (or an
  // ?error=link_invalid from the callback) means an expired / already-used link
  // or one opened in a different browser.
  useEffect(() => {
    if (searchParams.get("error") === "link_invalid") {
      setAuthState(INVALID);
      return;
    }
    const supabase = createSupabaseBrowserClient();
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setAuthState(data.session ? READY : INVALID);
    });
    return () => {
      active = false;
    };
  }, [searchParams]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!pw.valid) {
      setPwTouched(true);
      setError("Please choose a password that meets all the requirements below.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }

    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setSubmitting(false);
      setError(updateError.message);
      return;
    }
    // Per design: invalidate the recovery session and make them sign in fresh
    // with the new password.
    await supabase.auth.signOut();
    router.push("/login?reset=1");
    router.refresh();
  };

  return (
    <div>
      <AuthHeading title={authState === INVALID ? "Link expired" : "Choose a new password"}>
        {authState === INVALID
          ? "This password reset link is invalid or has expired."
          : "Pick a strong password you don't use anywhere else."}
      </AuthHeading>

      {authState === CHECKING && (
        <p role="status" className="text-[14px] leading-5 text-[color:var(--text-2)]">
          Verifying your link…
        </p>
      )}

      {authState === INVALID && (
        <Button variant="primary" size="lg" full onClick={() => router.push("/forgot-password")}>
          Request a new link
        </Button>
      )}

      {authState === READY && (
        <form onSubmit={onSubmit} className="space-y-6">
          <div>
            <Field label="New password">
              <PasswordInput
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
            <Field label="Confirm new password">
              <PasswordInput
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
                aria-invalid={confirmMismatch}
              />
            </Field>
            {confirmMismatch && <FieldError>The two passwords don&rsquo;t match.</FieldError>}
          </div>

          {error && <StatusLine>{error}</StatusLine>}

          <Button type="submit" variant="primary" size="lg" full disabled={submitting}>
            {submitting ? "Updating password\u2026" : "Update password"}
          </Button>
        </form>
      )}

      <AuthFootnote>
        Back to{" "}
        <Link href="/login" className={LINK_CLASS}>
          Log in
        </Link>
      </AuthFootnote>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}
