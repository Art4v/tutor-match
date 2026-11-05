"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui";
import OAuthButtons from "@/components/OAuthButtons";
import { Wordmark } from "@/components/Logo";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { postAuthDest, safeNext } from "@/lib/roles";
import { AuthHeading, AuthFootnote, Field, Input, PasswordInput, StatusLine, LINK_CLASS } from "../_components/fields";

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justReset = searchParams.get("reset") === "1";
  const errorParam = searchParams.get("error");
  const oauthError = errorParam === "oauth";
  const linkError = errorParam === "link_invalid";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  // When the sign-in failure is specifically an unconfirmed email, we surface a
  // "resend confirmation" action inside the error banner. `resent` tracks that
  // request: null | "sending" | "ok" | "error".
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [resent, setResent] = useState(null);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setNeedsConfirm(false);
    setResent(null);
    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      // Supabase returns code `email_not_confirmed` here; match the message too
      // as a fallback in case the code isn't populated.
      setNeedsConfirm(error.code === "email_not_confirmed" || /email not confirmed/i.test(error.message || ""));
      return;
    }
    // profiles.role is the source of truth (0041). A user who signed up but
    // never picked a role (role NULL) is sent to the /choose-role gate.
    let role = null;
    if (data?.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();
      role = profile?.role ?? null;
    }
    // ?next= wins when present and safe, so a company arriving from an invite
    // link lands back on the claim page instead of their role's home surface.
    router.push(safeNext(searchParams.get("next")) ?? postAuthDest(role));
    router.refresh();
  };

  const onResendConfirmation = async () => {
    if (resent === "sending" || !email) return;
    setResent("sending");
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.resend({ type: "signup", email });
    setResent(error ? "error" : "ok");
  };

  return (
    <div>
      <AuthHeading title="Log in">
        To your <Wordmark matchColor="var(--text-2)" /> account.
      </AuthHeading>

      {justReset && (
        <StatusLine tone="success" className="mb-6">
          Password updated. Log in with your new password.
        </StatusLine>
      )}

      {(oauthError || linkError) && (
        <StatusLine className="mb-6">
          {linkError
            ? "That confirmation link is invalid or has expired. Please log in, or sign up again."
            : "Couldn’t log in. Please try again."}
        </StatusLine>
      )}

      <form onSubmit={onSubmit} className="space-y-6">
        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </Field>

        <div>
          <Field label="Password">
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </Field>
          <div className="mt-2 flex justify-end">
            <Link href="/forgot-password" className={`inline-flex items-center min-h-6 text-[14px] leading-5 ${LINK_CLASS}`}>
              Forgot password?
            </Link>
          </div>
        </div>

        {error && (
          <StatusLine>
            {error}
            {needsConfirm && (
              resent === "ok" ? (
                <> Sent. Check your inbox.</>
              ) : (
                <>
                  {" "}
                  <button
                    type="button"
                    onClick={onResendConfirmation}
                    disabled={resent === "sending"}
                    className="font-semibold underline disabled:opacity-50"
                  >
                    {resent === "sending" ? "Sending…" : "Resend confirmation email"}
                  </button>
                  {resent === "error" && <> Couldn&rsquo;t resend.</>}
                </>
              )
            )}
          </StatusLine>
        )}

        <Button type="submit" variant="primary" size="lg" full disabled={submitting}>
          {submitting ? "Logging in…" : "Log in"}
        </Button>
      </form>

      <div className="mt-6">
        <OAuthButtons divider="top" />
      </div>

      <AuthFootnote>
        Don&rsquo;t have an account?{" "}
        <Link href="/signup" className={LINK_CLASS}>
          Sign up
        </Link>
      </AuthFootnote>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
