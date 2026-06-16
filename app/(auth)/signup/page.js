"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Button, Chip } from "@/components/ui";
import { Icon } from "@/components/Icon";
import OAuthButtons from "@/components/OAuthButtons";
import { PASSWORD_RULES, validatePassword } from "@/lib/password";
import { validateEmailFormat } from "@/lib/email";
import { EASE_OUT } from "@/lib/motion";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [password, setPassword] = useState("");
  const [pwTouched, setPwTouched] = useState(false);
  const [role, setRole] = useState("tutor");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  const pw = validatePassword(password);
  const emailValid = validateEmailFormat(email);

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
    if (!agreed) {
      setError("Please agree to the Terms of Service and Privacy Policy to continue.");
      return;
    }

    setSubmitting(true);
    let res;
    let payload;
    try {
      res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, password, role, agreed }),
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
    router.push("/profile");
    router.refresh();
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
        boxShadow: "0 30px 80px -40px rgba(15,23,42,0.18)",
      }}
    >
      <div className="mb-6">
        <h1 className="font-hand text-[42px] leading-none" style={{ color: "var(--ink-graphite)", fontWeight: 700 }}>
          Create your account.
        </h1>
        <p className="text-[14px] text-slate-500 mt-1.5">
          Join{" "}
          <span style={{ fontWeight: 500 }}>
            <span className="text-slate-700">match</span>
            <span style={{ color: "var(--accent)" }}>tutor</span>
          </span>{" "}
          as a tutor or a student.
        </p>
      </div>

      {needsConfirm ? (
        <div
          className="p-4 text-[13.5px] text-slate-700 leading-[1.55]"
          style={{ background: "var(--bg-soft)", border: "1px solid var(--paper-line)", borderRadius: 10 }}
        >
          Almost there — we&rsquo;ve sent a confirmation link to{" "}
          <span className="font-medium text-slate-900">{email}</span>. Open it
          to finish setting up your account, then come back and{" "}
          <Link href="/login" className="font-medium text-slate-900 underline">
            log in
          </Link>
          .
        </div>
      ) : (
        <>
          <form onSubmit={onSubmit} className="space-y-5">
          <Field label="I am a">
            <div className="flex gap-1.5">
              <Chip active={role === "tutor"} onClick={() => setRole("tutor")}>
                Tutor
              </Chip>
              <Chip disabled>Student · Coming soon</Chip>
            </div>
          </Field>

          <Field label="Full name">
            <Input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Alex Nguyen"
              required
              autoComplete="name"
            />
          </Field>

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

          <Field label="Password">
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
                      style={{ color: ok ? "#16A34A" : "var(--sage)" }}
                    >
                      <Icon name={ok ? "check" : "x"} size={13} strokeWidth={2.25} />
                      {rule.label}
                    </li>
                  );
                })}
              </ul>
            )}
          </Field>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer"
              style={{ accentColor: "var(--accent)" }}
            />
            <span className="text-[13px] text-slate-600 leading-[1.5]">
              I agree to the{" "}
              <Link href="/terms-of-service" target="_blank" rel="noopener" className="accent-link accent-link--glow" style={{ color: "var(--accent)" }}>
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy-policy" target="_blank" rel="noopener" className="accent-link accent-link--glow" style={{ color: "var(--accent)" }}>
                Privacy Policy
              </Link>
              .
            </span>
          </label>

          {error && (
            <div
              className="px-3 py-2 text-[13px] text-red-700"
              style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8 }}
            >
              {error}
            </div>
          )}

          <Button type="submit" variant="primary" size="lg" full disabled={submitting}>
            {submitting ? "Creating account…" : "Create account"}
          </Button>
        </form>
          <div className="mt-5">
            <OAuthButtons divider="top" />
            <p className="text-[12px] text-slate-500 mt-3 text-center leading-[1.5]">
              By continuing with Google, you agree to our{" "}
              <Link href="/terms-of-service" target="_blank" rel="noopener" className="accent-link accent-link--glow" style={{ color: "var(--accent)" }}>
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy-policy" target="_blank" rel="noopener" className="accent-link accent-link--glow" style={{ color: "var(--accent)" }}>
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </>
      )}

      <div className="text-[13px] text-slate-500 mt-6 text-center">
        {needsConfirm ? (
          <>Can&rsquo;t find the email? Check your spam or junk folder.</>
        ) : (
          <>
            Already have an account?{" "}
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
      className="w-full h-9 px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-slate-400"
      style={{ border: "1px solid var(--paper-line)", borderRadius: 8, background: "var(--paper-card)" }}
    />
  );
}
