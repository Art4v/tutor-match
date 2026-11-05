"use client";

// Client chooser for /choose-role. Select tutor or student, then Continue calls
// the one-time choose_role() RPC (sets profiles.role + creates the extension
// row) and routes to the role's home. The choice is not reversible in v1, so
// the radio rows commit nothing and a warning sits right above Continue
// (REDESIGN_DECISIONS.md item 8 replaced the old confirm modal with it).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { homeFor } from "@/lib/roles";
import { AuthHeading, StatusLine } from "../_components/fields";

const OPTIONS = [
  {
    role: "tutor",
    title: "I'm a tutor",
    blurb: "Create a profile, list your subjects and rates, and get discovered by students.",
  },
  {
    role: "student",
    title: "I'm a student or parent",
    blurb: "Browse tutors, compare subjects and rates, and find the right match for you.",
  },
];

export default function ChooseRoleForm() {
  const router = useRouter();
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Exactly what the old modal's Confirm did.
  const onContinue = async () => {
    if (!selected || saving) return;
    setError(null);
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { error: rpcErr } = await supabase.rpc("choose_role", { p_role: selected });
    if (rpcErr) {
      setSaving(false);
      setError("Something went wrong. Please try again.");
      return;
    }
    // Tutors continue into their profile (which routes on to onboarding);
    // students land on the tutor list. Refresh so the nav re-reads the new role.
    router.push(homeFor(selected));
    router.refresh();
  };

  return (
    <div>
      <AuthHeading title="Choose your account type" />

      <fieldset>
        <legend className="sr-only">Account type</legend>
        <div className="space-y-3">
          {OPTIONS.map((opt) => {
            const active = selected === opt.role;
            return (
              <label
                key={opt.role}
                className={`flex items-start gap-3 p-4 border rounded cursor-pointer hover:bg-surface-2 ${
                  active ? "border-accent" : "border-input"
                }`}
                style={{ transition: "background-color 120ms ease-out, border-color 120ms ease-out" }}
              >
                <span className="h-5 flex items-center shrink-0">
                  <input
                    type="radio"
                    name="role"
                    value={opt.role}
                    checked={active}
                    onChange={() => setSelected(opt.role)}
                    disabled={saving}
                    className="h-4 w-4 cursor-pointer"
                    style={{ accentColor: "var(--accent)" }}
                  />
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] leading-5 font-semibold text-[color:var(--text)]">{opt.title}</span>
                  <span className="block text-[14px] leading-5 text-[color:var(--text-2)] mt-1">{opt.blurb}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {error && <StatusLine className="mt-4">{error}</StatusLine>}

      <p className="text-[14px] leading-5 text-warning mt-6">You can&rsquo;t change this later.</p>

      <div className="mt-3">
        <Button variant="primary" size="lg" full onClick={onContinue} disabled={!selected || saving}>
          {saving ? "Setting up\u2026" : "Continue"}
        </Button>
      </div>

      {/* Companies are invite only (choose_role() refuses 'partner'), so a
          company owner who lands here has lost their claim link on the way. */}
      <p className="text-[12px] leading-4 text-muted text-center mt-6">
        Are you a company owner? Go back and click the invitation link you were sent to claim your account.
      </p>
    </div>
  );
}
