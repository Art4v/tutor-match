"use client";

// Re-consent gate for already-registered users (tutors and students). Mounted
// once in the root layout, it checks the logged-in user's stored consent
// timestamp against the current policy version (lib/policy.js). When the user
// signed up before the current Terms / Privacy Policy took effect (or never
// agreed), it shows a blocking modal that must be accepted to continue.
//
// New signups are stamped now() by handle_new_user() (migrations 0025/0039),
// so they pass needsPolicyConsent() and never see this. Logged-out visitors
// render nothing — no flash on the public pages.

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { needsPolicyConsent } from "@/lib/policy";
import { Button } from "@/components/ui";
import { Modal } from "@/components/Modal";

export default function PolicyConsentGate() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Never block the policy pages themselves — a gated user must be able to read
  // what they're agreeing to (the modal links open these in a new tab, but a
  // direct visit shouldn't be trapped either).
  const onPolicyPage =
    pathname === "/terms-of-service" || pathname === "/privacy-policy";

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    // Re-checks the signed-in user's consent. The component is mounted once in
    // the root layout and survives client-side navigation, so a single on-mount
    // check would miss a login that happens later (SPA nav, no remount). We run
    // it on mount AND on every auth change so signing in re-evaluates.
    const check = async (user) => {
      if (!user) {
        if (!cancelled) setOpen(false);
        return;
      }
      // The stamp lives on the shared profiles row (0039) — one self-read
      // covers every role via the "profile self read" RLS policy.
      const { data, error: qErr } = await supabase
        .from("profiles")
        .select("terms_agreed_at")
        .eq("id", user.id)
        .maybeSingle();

      // Missing row or a read error → don't gate.
      if (cancelled || qErr || !data) return;
      if (needsPolicyConsent(data.terms_agreed_at)) setOpen(true);
    };

    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) check(data?.user);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // Defer out of the callback: issuing a Supabase query synchronously here
      // can deadlock on the auth lock the callback holds.
      const user = session?.user ?? null;
      setTimeout(() => {
        if (!cancelled) check(user);
      }, 0);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const onAccept = async () => {
    setError(null);
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { error: rpcErr } = await supabase.rpc("accept_current_terms");
    setSaving(false);
    if (rpcErr) {
      setError("Something went wrong. Please try again.");
      return;
    }
    setOpen(false);
  };

  if (!open || onPolicyPage) return null;

  // Blocking: no close button, no Escape, no scrim click. A small centred
  // dialog at every width (no sheet).
  return (
    <Modal
      title="We’ve updated our policies"
      dismissable={false}
      width={440}
      zIndex={100}
      footer={
        <Button variant="primary" onClick={onAccept} disabled={!agreed || saving}>
          {saving ? "Saving…" : "Agree and continue"}
        </Button>
      }
    >
      <p className="text-[14px] leading-5 text-[color:var(--text-2)]">
        We&rsquo;ve made changes to our{" "}
        <Link href="/terms-of-service" target="_blank" rel="noopener" className="text-accent underline hover:text-[color:var(--accent-hover)]">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy-policy" target="_blank" rel="noopener" className="text-accent underline hover:text-[color:var(--accent-hover)]">
          Privacy Policy
        </Link>
        . Please review and agree to continue using MatchTutor.
      </p>

      <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="h-4 w-4 shrink-0 cursor-pointer"
          style={{ accentColor: "var(--accent)" }}
        />
        <span className="text-[14px] leading-5 text-[color:var(--text)]">
          I agree to the updated Terms of Service and Privacy Policy.
        </span>
      </label>

      {error && (
        <p role="alert" className="mt-2 text-[14px] leading-5 text-error">
          {error}
        </p>
      )}
    </Modal>
  );
}
