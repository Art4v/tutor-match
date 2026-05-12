"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/");
    router.refresh();
  };

  return (
    <div
      className="w-full max-w-[440px] bg-white"
      style={{ border: "1px solid #E5E7EB", borderRadius: 16, padding: 32 }}
    >
      <div className="mb-6">
        <h1 className="text-[24px] font-semibold text-slate-900 tracking-tight">
          Log in
        </h1>
        <p className="text-[14px] text-slate-500 mt-1">
          Welcome back. Sign in to your tutormatch account.
        </p>
      </div>

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

      <div className="text-[13px] text-slate-500 mt-6 text-center">
        Don&rsquo;t have an account?{" "}
        <Link href="/signup" className="text-slate-900 hover:underline font-medium">
          Sign up
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
