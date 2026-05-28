"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Chip } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { PASSWORD_RULES, validatePassword } from "@/lib/password";
import { validateEmailFormat } from "@/lib/email";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [password, setPassword] = useState("");
  const [pwTouched, setPwTouched] = useState(false);
  const [role, setRole] = useState("tutor");
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

    setSubmitting(true);
    let res;
    let payload;
    try {
      res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, password, role }),
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
    router.push("/settings");
    router.refresh();
  };

  return (
    <div
      className="w-full max-w-[440px] bg-white"
      style={{ border: "1px solid #E5E7EB", borderRadius: 16, padding: 32 }}
    >
      <div className="mb-6">
        <h1 className="text-[24px] font-semibold text-slate-900 tracking-tight">
          Create your account
        </h1>
        <p className="text-[14px] text-slate-500 mt-1">
          Join tutormatch as a tutor or a student.
        </p>
      </div>

      {needsConfirm ? (
        <div
          className="p-4 text-[13.5px] text-slate-700 leading-[1.55]"
          style={{ background: "#F8FAFC", border: "1px solid #E5E7EB", borderRadius: 10 }}
        >
          Almost there — we&rsquo;ve sent a confirmation link to{" "}
          <span className="font-medium text-slate-900">{email}</span>. Open it
          to finish setting up your account, then come back and{" "}
          <Link href="/login" className="font-medium text-slate-900 underline">
            log in
          </Link>
          .{" "}
          <span className="text-slate-500">
            Can&rsquo;t find the email? Check your spam or junk folder.
          </span>
        </div>
      ) : (
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
      )}

      <div className="text-[13px] text-slate-500 mt-6 text-center">
        Already have an account?{" "}
        <Link href="/login" className="text-slate-900 hover:underline font-medium">
          Log in
        </Link>
      </div>
    </div>
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
      style={{ border: "1px solid #E5E7EB", borderRadius: 8, background: "#fff" }}
    />
  );
}
