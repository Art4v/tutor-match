"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";
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
          className="flex-1 min-w-0 flex items-center gap-2 min-h-11 px-3 py-2 rounded bg-surface-2 text-left hover:bg-[color:var(--rule)]"
          style={{ transition: "background-color 120ms ease-out" }}
        >
          <code className="flex-1 min-w-0 truncate text-[14px] leading-5 text-[color:var(--text)]">{link || "Loading…"}</code>
          <span className={`shrink-0 inline-flex items-center gap-1 text-[14px] leading-5 font-semibold ${copied ? "text-success" : "text-accent"}`}>
            <Icon name={copied ? "check" : "copy"} size={16} />
            {copied ? "Copied" : "Copy"}
          </span>
        </button>
        <Button variant="danger" onClick={() => setConfirming(true)}>
          Rotate link
        </Button>
      </div>
      {error && <p role="alert" className="mt-2 text-[14px] leading-5 text-error">{error}</p>}
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
