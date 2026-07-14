"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Client half of /account-disabled. Log out works; "Request review" is disabled
// (future slice). Kept deliberately minimal — a disabled user has nowhere else
// to go from here.
export function DisabledScreen() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const onLogout = async () => {
    setLoggingOut(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <div className="bg-[color:var(--paper-card)] min-h-screen">
      <div className="max-w-[480px] mx-auto px-6 pt-24 pb-24">
        <section
          className="bg-[color:var(--paper-card)]"
          style={{ border: "1px solid var(--paper-line)", borderRadius: "var(--radius-card)", padding: 28, textAlign: "center" }}
        >
          <span
            className="inline-flex items-center justify-center mb-4"
            style={{ width: 48, height: 48, borderRadius: 999, background: "#FEF2F2", color: "#DC2626" }}
          >
            <Icon name="ban" size={24} />
          </span>
          <h1 className="font-hand text-[32px] leading-none" style={{ color: "var(--ink-graphite)", fontWeight: 700 }}>
            Your account has been disabled
          </h1>
          <p className="text-[14px] text-slate-500 mt-2.5 leading-[1.55]">
            An admin has disabled your account following a report. You can't browse, message, or appear on
            matchtutor while your account is disabled.
          </p>

          <div className="flex flex-col gap-2.5 mt-7">
            {/* Inert placeholder — the review-request flow ships in a later slice. */}
            <button
              type="button"
              disabled
              aria-disabled="true"
              title="Coming soon"
              className="inline-flex items-center justify-center gap-2 font-medium w-full cursor-not-allowed"
              style={{
                background: "var(--desk)",
                color: "var(--ink-muted)",
                border: "1px solid var(--paper-line)",
                padding: "11px 20px",
                fontSize: 15,
                height: 44,
                borderRadius: 10,
                opacity: 0.6,
              }}
            >
              Request review
            </button>
            <button
              type="button"
              onClick={onLogout}
              disabled={loggingOut}
              className="inline-flex items-center justify-center gap-2 font-medium w-full disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "var(--paper-card)",
                color: "var(--ink-graphite)",
                border: "1px solid var(--paper-line)",
                padding: "11px 20px",
                fontSize: 15,
                height: 44,
                borderRadius: 10,
                cursor: loggingOut ? "not-allowed" : "pointer",
              }}
            >
              {loggingOut ? "Logging out…" : "Log out"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
