"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// "Report a bug" dialog on the shared Modal shell (a full-screen sheet below
// 640px). Self-contained: it owns its form state and POSTs to /api/bug-report
// itself. Open to everyone; name + email prefill from the logged-in user (still
// editable). Scrim click + Escape close unless mid-submit (busy).
const MAX_MESSAGE = 5000;

export function BugReportModal({ onClose }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [company, setCompany] = useState(""); // honeypot
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  // Prefill from the logged-in user, if any. Fields stay editable.
  useEffect(() => {
    let active = true;
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data?.user;
      if (!active || !user) return;
      if (user.email) setEmail((v) => v || user.email);
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      const fullName = profile?.full_name || user.user_metadata?.full_name || "";
      if (active && fullName) setName((v) => v || fullName);
    });
    return () => {
      active = false;
    };
  }, []);

  // Modal re-runs its effect when onClose changes identity; the caller passes
  // an inline arrow, so hand it a stable function that reads the latest one.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const close = useCallback(() => closeRef.current?.(), []);

  const submit = async () => {
    if (busy) return;
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError("Please fill in your name, email, and a message.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/bug-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), message: message.trim(), company }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Something went wrong. Please try again.");
        return;
      }
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    "mt-2 block w-full h-11 rounded border border-input bg-surface px-3 text-[14px] leading-5 text-[color:var(--text)] placeholder:text-placeholder focus:border-accent disabled:opacity-50";
  const labelCls = "text-[14px] leading-5 font-semibold text-[color:var(--text)]";

  // Success state.
  if (sent) {
    return (
      <Modal
        title="Thanks, we got your report"
        onClose={close}
        width={420}
        zIndex={80}
        footer={<Button variant="primary" onClick={onClose}>Done</Button>}
      >
        <p className="text-[14px] leading-5 text-[color:var(--text-2)]">
          Our team will take a look. If we need more detail, we'll reply to the email you gave us.
        </p>
      </Modal>
    );
  }

  const incomplete = !name.trim() || !email.trim() || !message.trim();

  return (
    <Modal
      title="Report a bug"
      onClose={close}
      dismissable={!busy}
      sheet
      width={480}
      zIndex={80}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={busy || incomplete}>
            {busy ? "Sending…" : "Send report"}
          </Button>
        </>
      }
    >
      <p className="text-[14px] leading-5 text-[color:var(--text-2)]">
        Found something broken? Let us know and we'll look into it.
      </p>

      <label className="mt-6 block">
        <span className={labelCls}>Name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 200))}
          disabled={busy}
          autoComplete="name"
          className={inputCls}
        />
      </label>

      <label className="mt-4 block">
        <span className={labelCls}>Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
          autoComplete="email"
          className={inputCls}
        />
      </label>

      <label className="mt-4 block">
        <span className={labelCls}>Message</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
          disabled={busy}
          rows={4}
          placeholder="What went wrong? Where did it happen?"
          className="mt-2 block w-full resize-none rounded border border-input bg-surface px-3 py-2 text-[14px] leading-5 text-[color:var(--text)] placeholder:text-placeholder focus:border-accent disabled:opacity-50"
        />
      </label>

      {/* Honeypot: hidden from real users, off the tab order. Bots that fill it
          are silently discarded server-side. Placed after the real fields so the
          Modal's initial focus lands on Name, not here. */}
      <input
        type="text"
        name="company"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
      />

      {error && <p role="alert" className="mt-2 text-[14px] leading-5 text-error">{error}</p>}
    </Modal>
  );
}
