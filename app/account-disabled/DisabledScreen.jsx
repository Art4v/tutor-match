"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Client half of /account-disabled. Log out is the only action. Kept deliberately
// minimal — a disabled user has nowhere else to go from here.
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
    <div className="bg-surface">
      <div className="max-w-[400px] mx-auto px-4 pt-16 pb-16 text-center">
        <h1 className="text-[24px] leading-8 font-semibold text-[color:var(--text)]">
          Your account has been disabled
        </h1>
        <p className="mt-3 text-[14px] leading-5 text-[color:var(--text-2)]">
          An admin has disabled your account following a report. You can't browse, message, or appear on
          MatchTutor while your account is disabled.
        </p>
        <div className="mt-6 flex justify-center">
          <Button variant="outline" onClick={onLogout} disabled={loggingOut}>
            {loggingOut ? "Logging out…" : "Log out"}
          </Button>
        </div>
      </div>
    </div>
  );
}
