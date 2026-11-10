"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";

/** Shown when a tutor is verified but their private files are still stored. */
export function RetryPurgeButton({ tutorId, count }) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const retry = async () => {
    setWorking(true);
    setError("");
    try {
      const res = await fetch("/api/admin/verification/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tutorId }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || "Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    }
    setWorking(false);
  };

  return (
    <div className="text-[13.5px]" style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "14px 16px" }}>
      <p className="font-medium" style={{ color: "#B91C1C" }}>Files still stored</p>
      <p className="text-slate-600 mt-0.5">
        {count === 1 ? "1 private document" : `${count} private documents`} should have been deleted when this tutor was verified, but the deletion failed.
      </p>
      <button
        type="button"
        onClick={retry}
        disabled={working}
        className="inline-flex items-center gap-1.5 mt-2.5 font-medium disabled:opacity-60"
        style={{ color: "#B91C1C" }}
      >
        <Icon name="trash" size={13} />
        {working ? "Deleting…" : "Retry delete"}
      </button>
      {error && <p className="mt-1.5 text-[12.5px]" style={{ color: "#DC2626" }}>{error}</p>}
    </div>
  );
}
