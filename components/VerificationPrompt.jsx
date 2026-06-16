"use client";

// Soft nudge for unverified tutors. Mounted once in the root layout, it checks
// the logged-in tutor's verification_status and — when it's 'none' or 'rejected'
// (i.e. they've never requested, or were rejected and could resubmit) — shows a
// dismissible modal prompting them to complete their profile and get verified.
//
// Unlike PolicyConsentGate this is NOT a hard gate: "Maybe later" closes it for
// the rest of the browser session (sessionStorage), and it never appears while
// verification is 'pending' or 'verified'. Logged-out visitors and students
// render nothing — no flash on the public pages.

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { lockScroll, unlockScroll } from "@/lib/scrollLock";
import { Button } from "@/components/ui";

const DISMISS_KEY = "mt:verify-prompt-dismissed";

// True once the tutor has chosen "Maybe later" this session. Guarded for SSR /
// privacy modes where sessionStorage may be unavailable.
function dismissedThisSession() {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    sessionStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* ignore */
  }
}

function clearDismissed() {
  try {
    sessionStorage.removeItem(DISMISS_KEY);
  } catch {
    /* ignore */
  }
}

export default function VerificationPrompt() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Don't intrude on flows where the prompt is redundant or in the way:
  // onboarding, auth pages, and the policy pages. (The tutor's own profile
  // editor is intentionally NOT excluded — it's where they land after login.)
  const onExcludedPage =
    pathname === "/onboarding" ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/terms-of-service" ||
    pathname === "/privacy-policy" ||
    pathname.startsWith("/auth");

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    // Re-checks the signed-in tutor's verification status. Mounted once in the
    // root layout and surviving client-side navigation, so a single on-mount
    // check would miss a login that happens later (SPA nav, no remount). We run
    // it on mount AND on every auth change so signing in re-evaluates.
    const check = async (user) => {
      if (!user) {
        // Signed out: reset so a subsequent sign-in (even in the same tab) is
        // re-evaluated from scratch.
        if (!cancelled) setOpen(false);
        clearDismissed();
        return;
      }
      const { data, error: qErr } = await supabase
        .from("tutor_profiles")
        .select("verification_status")
        .eq("id", user.id)
        .maybeSingle();

      // No tutor row (e.g. a student) or a read error → don't prompt.
      if (cancelled || qErr || !data) return;
      const status = data.verification_status ?? "none";
      if ((status === "none" || status === "rejected") && !dismissedThisSession()) {
        setOpen(true);
      }
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

  // Lock page scroll (including the Lenis smooth-scroll layer) while the modal
  // is showing.
  const visible = open && !onExcludedPage;
  useEffect(() => {
    if (!visible) return;
    lockScroll();
    return () => unlockScroll();
  }, [visible]);

  const onMaybeLater = () => {
    markDismissed();
    setOpen(false);
  };

  const onCompleteNow = () => {
    markDismissed();
    setOpen(false);
    // /profile resolves the owner's slug → the /tutor/[slug] inline editor,
    // where the "Get verified" card lives in the sidebar.
    router.push("/profile");
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ background: "rgba(42, 58, 46, 0.45)", backdropFilter: "blur(2px)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="verify-prompt-title"
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
          id="verify-prompt-title"
          className="font-hand text-[34px] leading-none"
          style={{ color: "var(--ink-graphite)", fontWeight: 700 }}
        >
          Get verified on matchtutor.
        </h2>
        <p className="text-[14px] text-slate-600 mt-3 leading-[1.55]">
          Verified tutors get a badge next to their name across matchtutor and rank
          higher in search. Finish your profile and request a review.
        </p>

        <div className="mt-6 flex flex-col gap-2.5">
          <Button
            variant="primary"
            size="lg"
            full
            icon="shield-check"
            onClick={onCompleteNow}
          >
            Complete and verify now
          </Button>
          <Button variant="ghost" size="lg" full onClick={onMaybeLater}>
            Maybe later
          </Button>
        </div>
      </div>
    </div>
  );
}
