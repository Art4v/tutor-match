"use client";

// Client chooser for /choose-role. Select tutor or student, then Continue calls
// the one-time choose_role() RPC (sets profiles.role + creates the extension
// row) and routes to the role's home. The choice is not reversible in v1, so we
// use a select-then-confirm step rather than firing on a single click.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Button } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { EASE_OUT } from "@/lib/motion";

const OPTIONS = [
  {
    role: "tutor",
    icon: "graduation",
    title: "I'm a tutor",
    blurb: "Create a profile, list your subjects and rates, and get discovered by students.",
  },
  {
    role: "student",
    icon: "search",
    title: "I'm a student/parent",
    blurb: "Browse tutors, compare subjects and rates, and find the right match for you.",
  },
];

export default function ChooseRoleForm() {
  const router = useRouter();
  const [selected, setSelected] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const selectedOption = OPTIONS.find((o) => o.role === selected) ?? null;

  // The role is irreversible in v1, so Continue opens a confirmation step rather
  // than committing straight away. The RPC only fires once the user confirms.
  const onContinue = () => {
    if (!selected || saving) return;
    setError(null);
    setConfirming(true);
  };

  const onConfirm = async () => {
    if (!selected || saving) return;
    setError(null);
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { error: rpcErr } = await supabase.rpc("choose_role", { p_role: selected });
    if (rpcErr) {
      setSaving(false);
      setConfirming(false);
      setError("Something went wrong. Please try again.");
      return;
    }
    // Tutors continue into their profile (which routes on to onboarding);
    // students land on the home page. Refresh so the nav re-reads the new role.
    router.push(selected === "tutor" ? "/profile" : "/");
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
        boxShadow: "0 30px 80px -40px rgba(0,30,30,0.18)",
      }}
    >
      <div className="mb-6">
        <h1 className="text-[30px] leading-tight" style={{ color: "var(--ink-graphite)", fontWeight: 300, letterSpacing: "-0.025em" }}>
          How will you use{" "}
          <span style={{ fontWeight: 500 }}>
            <span className="text-slate-700">match</span>
            <span style={{ color: "var(--accent)" }}>tutor</span>
          </span>
          ?
        </h1>
        <p className="text-[14px] text-slate-500 mt-1.5">
          Choose your account type. You can&rsquo;t change this later.
        </p>
      </div>

      <div className="space-y-2.5" role="radiogroup" aria-label="Account type">
        {OPTIONS.map((opt) => {
          const active = selected === opt.role;
          return (
            <button
              key={opt.role}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setSelected(opt.role)}
              className="w-full flex items-start gap-3.5 text-left transition-colors"
              style={{
                padding: 16,
                background: active ? "var(--bg-soft)" : "var(--paper-card)",
                border: `1px solid ${active ? "var(--accent)" : "var(--paper-line)"}`,
                borderRadius: 12,
                cursor: "pointer",
              }}
            >
              <span
                className="shrink-0 inline-flex items-center justify-center"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: active ? "var(--accent)" : "var(--desk)",
                  color: active ? "#fff" : "var(--sage)",
                }}
              >
                <Icon name={opt.icon} size={20} strokeWidth={1.75} />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-medium" style={{ color: "var(--ink-graphite)" }}>
                  {opt.title}
                </span>
                <span className="block text-[13px] text-slate-500 leading-[1.5] mt-0.5">{opt.blurb}</span>
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <div
          className="px-3 py-2 text-[13px] text-red-700 mt-4"
          style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8 }}
        >
          {error}
        </div>
      )}

      <div className="mt-6">
        <Button variant="primary" size="lg" full onClick={onContinue} disabled={!selected}>
          Continue
        </Button>
      </div>

      {confirming && selectedOption && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: "rgba(0,49,47, 0.45)", backdropFilter: "blur(2px)" }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="choose-role-confirm-title"
        >
          <div
            className="w-full max-w-[400px] bg-[color:var(--paper-card)]"
            style={{
              border: "1px solid var(--paper-line)",
              borderRadius: "var(--radius-card)",
              padding: 32,
              boxShadow: "0 30px 80px -40px rgba(0,30,30,0.35)",
            }}
          >
            <h2
              id="choose-role-confirm-title"
              className="text-[30px] leading-tight"
              style={{ color: "var(--ink-graphite)", fontWeight: 300, letterSpacing: "-0.025em" }}
            >
              Continue as {selected === "tutor" ? "a tutor" : "a student/parent"}?
            </h2>
            <p className="text-[14px] text-slate-600 mt-3 leading-[1.55]">
              You&rsquo;re signing up as {selected === "tutor" ? "a tutor" : "a student/parent"}. You
              can&rsquo;t change this later.
            </p>

            {error && (
              <div
                className="px-3 py-2 text-[13px] text-red-700 mt-4"
                style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8 }}
              >
                {error}
              </div>
            )}

            <div className="flex gap-2.5 mt-6">
              <Button
                variant="outline"
                size="lg"
                full
                onClick={() => setConfirming(false)}
                disabled={saving}
              >
                Go back
              </Button>
              <Button variant="primary" size="lg" full onClick={onConfirm} disabled={saving}>
                {saving ? "Setting up…" : "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
