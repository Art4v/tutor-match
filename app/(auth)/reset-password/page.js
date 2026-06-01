"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { Button } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { PASSWORD_RULES, validatePassword } from "@/lib/password";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { EASE_OUT } from "@/lib/motion";

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
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.42, ease: EASE_OUT }}
      className="w-full max-w-[440px] bg-white"
      style={{
        border: "1px solid #E5E7EB",
        borderRadius: 16,
        padding: 32,
        boxShadow: "0 30px 80px -40px rgba(15,23,42,0.18)",
      }}
    >
      <div className="mb-6">
        <h1 className="text-[28px] font-semibold text-slate-900 tracking-tight">
          {authState === INVALID ? "Link expired." : "Choose a new password."}
        </h1>
        <p className="text-[14px] text-slate-500 mt-1.5">
          {authState === INVALID
            ? "This password reset link is invalid or has expired."
            : "Pick a strong password you don't use anywhere else."}
        </p>
      </div>

      {authState === CHECKING && (
        <div className="text-[13.5px] text-slate-500">Verifying your link…</div>
      )}

      {authState === INVALID && (
        <Button
          variant="primary"
          size="lg"
          full
          onClick={() => router.push("/forgot-password")}
        >
          Request a new link
        </Button>
      )}

      {authState === READY && (
        <form onSubmit={onSubmit} className="space-y-5">
          <Field label="New password">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setPwTouched(true)}
              placeholder="At least 8 characters"
              required
              minLength={8}
              autoComplete="new-password"
              aria-invalid={pwTouched && !pw.valid}
            />
            {(pwTouched || password.length > 0) && (
              <ul className="mt-2.5 space-y-1.5">
                {PASSWORD_RULES.map((rule) => {
                  const ok = rule.test(password);
                  return (
                    <li
                      key={rule.id}
                      className="flex items-center gap-1.5 text-[12.5px] leading-none transition-colors"
                      style={{ color: ok ? "#16A34A" : "#94A3B8" }}
                    >
                      <Icon name={ok ? "check" : "x"} size={13} strokeWidth={2.25} />
                      {rule.label}
                    </li>
                  );
                })}
              </ul>
            )}
          </Field>

          <Field label="Confirm new password">
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter your password"
              required
              autoComplete="new-password"
              aria-invalid={confirmMismatch}
            />
            {confirmMismatch && (
              <p className="mt-2 text-[12.5px]" style={{ color: "#DC2626" }}>
                The two passwords don&rsquo;t match.
              </p>
            )}
          </Field>

          {error && (
            <div
              className="px-3 py-2 text-[13px] text-red-700"
              style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8 }}
            >
              {error}
            </div>
          )}

          <Button type="submit" variant="primary" size="lg" full disabled={submitting}>
            {submitting ? "Updating password…" : "Update password"}
          </Button>
        </form>
      )}

      <div className="text-[13px] text-slate-500 mt-6 text-center">
        Back to{" "}
        <Link href="/login" className="font-medium accent-link" style={{ color: "var(--accent)" }}>
          Log in
        </Link>
      </div>
    </motion.div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="text-[12.5px] font-semibold text-slate-900 uppercase tracking-wider mb-2.5">
        {label}
      </div>
      {children}
    </label>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      className="w-full h-10 px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none"
      style={{
        border: "1px solid #E5E7EB",
        borderRadius: 8,
        background: "#fff",
        transition: "border-color 180ms ease-out, box-shadow 180ms ease-out",
      }}
    />
  );
}
