"use client";

// Re-consent gate for already-registered tutors. Mounted once in the root
// layout, it checks the logged-in user's stored consent timestamp against the
// current policy version (lib/policy.js). When the user signed up before the
// current Terms / Privacy Policy took effect (or never agreed), it shows a
// blocking modal that must be accepted to continue.
//
// New signups are stamped now() by handle_new_user() (migration 0025), so they
// pass needsPolicyConsent() and never see this. Logged-out visitors render
// nothing — no flash on the public pages.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getLenis } from "@/components/SmoothScrollProvider";
import { needsPolicyConsent } from "@/lib/policy";
import { Button } from "@/components/ui";

export default function PolicyConsentGate() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const overlayRef = useRef(null);

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
      const { data, error: qErr } = await supabase
        .from("tutor_profiles")
        .select("terms_agreed_at")
        .eq("id", user.id)
        .maybeSingle();

      // No tutor row (e.g. a student) or a read error → don't gate.
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

  // Lock background scroll while the blocking modal is visible (but not on the
  // policy pages, where we render nothing). Scrolling is driven by Lenis
  // (SmoothScrollProvider) — its own wheel listener + RAF loop bypass
  // overflow:hidden entirely, so it must be stop()ped explicitly. The
  // overflow:hidden + non-passive wheel/touchmove blockers remain as the
  // fallback for when Lenis is disabled (reduced motion / coarse pointers,
  // where native scrolling is in effect). Everything restores on close/unmount.
  const blocking = open && !onPolicyPage;
  useEffect(() => {
    if (!blocking) return;
    const lenis = getLenis();
    lenis?.stop();

    const html = document.documentElement;
    const { body } = document;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";

    const block = (e) => e.preventDefault();
    const overlay = overlayRef.current;
    overlay?.addEventListener("wheel", block, { passive: false });
    overlay?.addEventListener("touchmove", block, { passive: false });

    return () => {
      lenis?.start();
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
      overlay?.removeEventListener("wheel", block);
      overlay?.removeEventListener("touchmove", block);
    };
  }, [blocking]);

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

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(42, 58, 46, 0.45)", backdropFilter: "blur(2px)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="policy-consent-title"
    >
      <div
        className="w-full max-w-[440px] bg-[color:var(--paper-card)]"
        style={{
          border: "1px solid var(--paper-line)",
          borderRadius: "var(--radius-card)",
          padding: 32,
          boxShadow: "0 30px 80px -40px rgba(15,23,42,0.35)",
        }}
      >
        <h2
          id="policy-consent-title"
          className="font-hand text-[34px] leading-none"
          style={{ color: "var(--ink-graphite)", fontWeight: 700 }}
        >
          We&rsquo;ve updated our policies.
        </h2>
        <p className="text-[14px] text-slate-600 mt-3 leading-[1.55]">
          We&rsquo;ve made changes to our{" "}
          <Link href="/terms-of-service" target="_blank" rel="noopener" className="accent-link accent-link--glow" style={{ color: "var(--accent)" }}>
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy-policy" target="_blank" rel="noopener" className="accent-link accent-link--glow" style={{ color: "var(--accent)" }}>
            Privacy Policy
          </Link>
          . Please review and agree to continue using matchtutor.
        </p>

        <label className="flex items-start gap-2.5 cursor-pointer mt-5">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer"
            style={{ accentColor: "var(--accent)" }}
          />
          <span className="text-[13px] text-slate-600 leading-[1.5]">
            I agree to the updated{" "}
            <Link href="/terms-of-service" target="_blank" rel="noopener" className="accent-link accent-link--glow" style={{ color: "var(--accent)" }} onClick={(e) => e.stopPropagation()}>
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy-policy" target="_blank" rel="noopener" className="accent-link accent-link--glow" style={{ color: "var(--accent)" }} onClick={(e) => e.stopPropagation()}>
              Privacy Policy
            </Link>
            .
          </span>
        </label>

        {error && (
          <div
            className="px-3 py-2 text-[13px] text-red-700 mt-4"
            style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8 }}
          >
            {error}
          </div>
        )}

        <div className="mt-6">
          <Button
            variant="primary"
            size="lg"
            full
            onClick={onAccept}
            disabled={!agreed || saving}
          >
            {saving ? "Saving…" : "Agree and continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
