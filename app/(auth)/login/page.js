"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { Button } from "@/components/ui";
import OAuthButtons from "@/components/OAuthButtons";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    const role = data?.user?.user_metadata?.role;
    router.push(role === "tutor" ? "/settings" : "/");
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
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            required
            autoComplete="current-password"
          />
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
