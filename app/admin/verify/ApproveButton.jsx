"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";

// Confirm-and-approve control for /admin/verify. POSTs the signed token to the
// approve route (the GET page never mutates). Shows a success state in place so
// the admin gets immediate feedback without a redirect.
export function ApproveButton({ token, tutorName, profileHref }) {
  const [state, setState] = useState("idle"); // idle | working | done | error
  const [message, setMessage] = useState("");

  const approve = async () => {
    setState("working");
    setMessage("");
    try {
      const res = await fetch("/api/verification/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        setMessage(data?.error || "Couldn't approve — please try again.");
        return;
      }
      setState("done");
    } catch {
      setState("error");
      setMessage("Network error — please try again.");
    }
  };

  if (state === "done") {
    return (
      <div
        className="flex items-center gap-2.5 text-[14px] font-medium"
        style={{ background: "var(--accent-softer)", color: "var(--accent)", border: "1px solid var(--accent-line)", borderRadius: 12, padding: "14px 16px" }}
      >
        <Icon name="shield-check" size={18} />
        <span>{tutorName} is now verified.</span>
        {profileHref && (
          <a href={profileHref} className="ml-auto inline-flex items-center gap-1 underline underline-offset-2">
            View <Icon name="arrow-right" size={13} />
          </a>
        )}
      </div>
    );
  }

  return (
    <div>
      <Button variant="primary" size="lg" icon="check" onClick={approve} disabled={state === "working"} full>
        {state === "working" ? "Approving…" : "Approve verification"}
      </Button>
      {state === "error" && (
        <p className="mt-2.5 text-[13px]" style={{ color: "#DC2626" }}>{message}</p>
      )}
    </div>
  );
}
