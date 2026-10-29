"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { ConfirmModal } from "@/components/ConfirmModal";
import { tutorInviteUrl } from "@/lib/tutorInvite";

// The universal tutor invite link (0076): copy it, or rotate the key so the
// old link stops working. The link is built from this browser's origin, so a
// preview deployment hands out a preview link.
export function InviteLinkCard({ initialKey }) {
  const [key, setKey] = useState(initialKey);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef(null);

  useEffect(() => {
    setOrigin(window.location.origin);
    return () => timer.current && clearTimeout(timer.current);
  }, []);

  const link = key && origin ? tutorInviteUrl(origin, key) : "";

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Couldn't copy. Select the link and copy it instead.");
    }
  };

  const rotate = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/tutor-invite/rotate", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Could not rotate the link, please try again.");
      } else {
        setKey(data.key);
      }
    } catch {
      setError("Network error. Please try again.");
    }
    setBusy(false);
    setConfirming(false);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={copy}
          disabled={!link}
          title="Click to copy"
          className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2.5 text-left"
          style={{ background: "var(--bg-soft)", border: "1px solid var(--paper-line)", borderRadius: 10 }}
        >
          <Icon name={copied ? "check" : "copy"} size={14} className={copied ? "text-emerald-500 shrink-0" : "text-slate-400 shrink-0"} />
          <code className="text-[12.5px] text-slate-700 truncate flex-1 min-w-0">{link || "Loading…"}</code>
          <span className={"text-[11.5px] font-medium shrink-0 " + (copied ? "text-emerald-600" : "text-slate-400")}>
            {copied ? "Copied" : "Copy"}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-[13px] font-medium"
          style={{ background: "var(--paper-card)", color: "#DC2626", border: "1px solid #FECACA", borderRadius: 10 }}
        >
          Rotate link
        </button>
      </div>
      {error && <p className="text-[12.5px] text-red-600 mt-2">{error}</p>}
      {confirming && (
        <ConfirmModal
          title="Rotate the invite link?"
          body="The current link stops working straight away, including anywhere you've already shared it. Tutors who already signed up through it are not affected."
          confirmLabel="Rotate link"
          confirmingLabel="Rotating…"
          busy={busy}
          onCancel={() => { if (!busy) setConfirming(false); }}
          onConfirm={rotate}
        />
      )}
    </div>
  );
}
