"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { Button } from "@/components/ui";
import { Icon } from "@/components/Icon";
import OAuthButtons from "@/components/OAuthButtons";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { postAuthDest } from "@/lib/roles";
import { EASE_OUT } from "@/lib/motion";

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justReset = searchParams.get("reset") === "1";
  const errorParam = searchParams.get("error");
  const oauthError = errorParam === "oauth";
  const linkError = errorParam === "link_invalid";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    router.push(postAuthDest(role));
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
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.42, ease: EASE_OUT }}
      className="w-full max-w-[440px] bg-[color:var(--paper-card)]"
      style={{
        border: "1px solid var(--paper-line)",
        borderRadius: "var(--radius-card)",
        padding: 32,
        boxShadow: "0 30px 80px -40px rgba(0,30,30,0.18)",
      }}
    >
      <div className="mb-6">
        <h1 className="text-[42px] leading-none" style={{ color: "var(--ink-graphite)", fontWeight: 300, letterSpacing: "-0.025em" }}>
          Welcome back.
        </h1>
        <p className="text-[14px] text-slate-500 mt-1.5">
          Sign in to your{" "}
          <span style={{ fontWeight: 500 }}>
            <span className="text-slate-700">match</span>
            <span style={{ color: "var(--accent)" }}>tutor</span>
          </span>{" "}
          account.
        </p>
      </div>

      {justReset && (
        <div
          className="px-3 py-2 mb-5 text-[13px]"
          style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, color: "#15803D" }}
        >
          Password updated — sign in with your new password.
        </div>
      )}

      {(oauthError || linkError) && (
        <div
          className="px-3 py-2 mb-5 text-[13px] text-red-700"
          style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8 }}
        >
          {linkError
            ? "That confirmation link is invalid or has expired — please sign in, or sign up again."
            : "Couldn’t sign in — please try again."}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-5">
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

        <Field label="Password">
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              required
              autoComplete="current-password"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <Icon name={showPassword ? "eye-off" : "eye"} size={17} />
            </button>
          </div>
          <div className="mt-2 text-right">
            <Link
              href="/forgot-password"
              className="text-[12.5px] font-medium accent-link"
              style={{ color: "var(--accent)" }}
            >
              Forgot password?
            </Link>
          </div>
        </Field>

        {error && (
          <div
            className="px-3 py-2 text-[13px] text-red-700"
            style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8 }}
          >
            {error}
            {needsConfirm && (
              resent === "ok" ? (
                <span className="ml-1.5 text-red-700">Sent — check your inbox.</span>
              ) : (
                <>
                  {" "}
                  <button
                    type="button"
                    onClick={onResendConfirmation}
                    disabled={resent === "sending"}
                    className="font-medium underline text-red-700 disabled:opacity-60"
                  >
                    {resent === "sending" ? "Sending…" : "Resend?"}
                  </button>
                  {resent === "error" && <span className="ml-1.5 text-red-700">Couldn&rsquo;t resend.</span>}
                </>
              )
            )}
          </div>
        )}

        <Button type="submit" variant="primary" size="lg" full disabled={submitting}>
          {submitting ? "Logging in…" : "Log in"}
        </Button>
      </form>

      <div className="mt-5">
        <OAuthButtons divider="top" />
      </div>

      <div className="text-[13px] text-slate-500 mt-6 text-center">
        Don&rsquo;t have an account?{" "}
        <Link href="/signup" className="font-medium accent-link" style={{ color: "var(--accent)" }}>
          Sign up
        </Link>
      </div>
    </motion.div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="text-[12.5px] font-medium text-slate-900 uppercase tracking-wider mb-2.5">
        {label}
      </div>
      {children}
    </label>
  );
}

function Input({ className = "", style, ...props }) {
  return (
    <input
      {...props}
      className={`w-full h-10 px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none ${className}`}
      style={{
        border: "1px solid var(--paper-line)",
        borderRadius: 8,
        background: "var(--paper-card)",
        transition: "border-color 180ms ease-out, box-shadow 180ms ease-out",
        ...style,
      }}
    />
  );
}
