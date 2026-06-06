"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Button } from "@/components/ui";
import { validateEmailFormat } from "@/lib/email";
import { EASE_OUT } from "@/lib/motion";

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
          Reset your password.
        </h1>
        <p className="text-[14px] text-slate-500 mt-1.5">
          Enter your account email and we&rsquo;ll send you a link to set a new
          password.
        </p>
      </div>

      {sent ? (
        <div
          className="p-4 text-[13.5px] text-slate-700 leading-[1.55]"
          style={{ background: "#F8FAFC", border: "1px solid #E5E7EB", borderRadius: 10 }}
        >
          If an account exists for{" "}
          <span className="font-medium text-slate-900">{email}</span>, we&rsquo;ve
          sent it a link to reset your password. Open it to choose a new password,
          then come back and{" "}
          <Link href="/login" className="font-medium text-slate-900 underline">
            log in
          </Link>
          .
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setEmailTouched(true)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              aria-invalid={emailTouched && !emailValid}
            />
            {emailTouched && email.length > 0 && !emailValid && (
              <p className="mt-2 text-[12.5px]" style={{ color: "#DC2626" }}>
                Enter a valid email address, e.g. you@example.com
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
            {submitting ? "Sending link…" : "Send reset link"}
          </Button>
        </form>
      )}

      <div className="text-[13px] text-slate-500 mt-6 text-center">
        {sent ? (
          <>Can&rsquo;t find the email? Check your spam or junk folder.</>
        ) : (
          <>
            Remembered it?{" "}
            <Link href="/login" className="font-medium accent-link" style={{ color: "var(--accent)" }}>
              Log in
            </Link>
          </>
        )}
      </div>
    </motion.div>
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
