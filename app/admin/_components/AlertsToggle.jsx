"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

// Mute or unmute this admin's alert emails. Only the caller's own setting:
// /api/admin/alerts writes the caller's own profiles row.
export function AlertsToggle({ initialMuted }) {
  const [muted, setMuted] = useState(initialMuted);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const toggle = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ muted: !muted }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not save, please try again.");
      setMuted(data.muted);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <p className="flex-1 text-[14px] leading-5 text-[color:var(--text-2)]">
        {muted
          ? "You won't get alert emails. Other admins still do."
          : "You get an email when a verification, review, report or profile change is waiting."}
      </p>
      <Button variant={muted ? "primary" : "outline"} onClick={toggle} disabled={saving}>
        {saving ? "Saving…" : muted ? "Turn alerts on" : "Mute alerts"}
      </Button>
      {error && <span role="alert" className="text-[14px] leading-5 text-error">{error}</span>}
    </div>
  );
}
