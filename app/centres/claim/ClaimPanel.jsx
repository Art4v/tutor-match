"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";

// Claim control for /companies/claim. POSTs the signed token (the GET page never
// mutates). On success it routes straight into the page the company now owns,
// which is the whole friction argument: sign up, one click, you're editing.
export function ClaimPanel({ token, companyName }) {
  const router = useRouter();
  const [state, setState] = useState("idle"); // idle | working | error
  const [message, setMessage] = useState("");

  const submit = async () => {
    setState("working");
    setMessage("");
    try {
      const res = await fetch("/api/companies/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.slug) {
        setState("error");
        setMessage(data?.error || "Something went wrong, please try again.");
        return;
      }
      // Not setState("done"): we leave immediately, and refresh so the nav
      // picks up the new role.
      router.push(`/companies/${data.slug}`);
      router.refresh();
    } catch {
      setState("error");
      setMessage("Network error, please try again.");
    }
  };

  const working = state === "working";

  return (
    <div>
      <Button onClick={submit} disabled={working}>
        {working ? "Claiming…" : `Claim ${companyName}`}
      </Button>

      {state === "error" && (
        <div
          className="flex items-start gap-2 text-[13px] mt-3"
          style={{ background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: 12, padding: "11px 13px" }}
        >
          <Icon name="alert-triangle" size={15} />
          <span>{message}</span>
        </div>
      )}
    </div>
  );
}
