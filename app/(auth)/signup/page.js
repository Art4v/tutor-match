"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Chip } from "@/components/ui";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("tutor");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // These end up in auth.users.raw_user_meta_data, where the
        // handle_new_user() trigger reads them to populate the profile rows.
        data: { full_name: fullName, role },
      },
    });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    // Supabase doesn't return an error when the email is already registered (it
    // avoids leaking which emails exist). Instead it returns a user with an
    // empty `identities` array and no new confirmation email is sent. Detect
    // that and tell the user to log in rather than showing the "confirm" copy.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setError("An account with this email already exists. Try logging in instead.");
      return;
    }
    // If email confirmation is enabled in Supabase, session is null until the
    // user clicks the link. Show a message instead of redirecting.
    if (!data.session) {
      setNeedsConfirm(true);
      return;
    }
    router.push("/dashboard");
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
          to finish setting up your account, then come back and log in.
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
              placeholder="At least 8 characters"
              required
              minLength={8}
              autoComplete="new-password"
            />
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
