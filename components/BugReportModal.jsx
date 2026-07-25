"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// "Report a bug" dialog. Chrome mirrors ReportModal, but this is self-contained:
// it owns its form state and POSTs to /api/bug-report itself. Open to everyone;
// name + email prefill from the logged-in user (still editable). Backdrop click
// + Escape close unless mid-submit (busy).
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

  useEffect(() => {
    const onKey = (e) => {
      // Escape closes the form (unless mid-submit) or dismisses the sent state.
      if (e.key === "Escape" && (sent || !busy)) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, sent, onClose]);

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

  const inputStyle = {
    background: "var(--paper-card)",
    border: "1px solid var(--paper-line)",
    outline: "none",
  };

  // Success state.
  if (sent) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center px-4"
        style={{ background: "rgba(0,30,30,0.5)" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bug-sent-title"
        onClick={onClose}
      >
        <div
          className="bg-[color:var(--paper-card)] w-full"
          style={{ maxWidth: 420, borderRadius: "var(--radius-card)", padding: 24, boxShadow: "0 24px 60px rgba(0,30,30,0.28)", textAlign: "center" }}
          onClick={(e) => e.stopPropagation()}
        >
          <span
            className="inline-flex items-center justify-center mb-3.5"
            style={{ width: 44, height: 44, borderRadius: 999, background: "var(--accent-softer)", color: "var(--accent)" }}
          >
            <Icon name="check-circle" size={22} />
          </span>
          <h2 id="bug-sent-title" className="text-[17px] font-light tracking-tight" style={{ color: "var(--ink)" }}>
            Thanks, we got your report
          </h2>
          <p className="text-[13.5px] text-slate-600 mt-1.5">
            Our team will take a look. If we need more detail, we'll reply to the email you gave us.
          </p>
          <div className="mt-6">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center gap-2 font-medium w-full"
              style={{
                background: "var(--accent)",
                color: "#fff",
                border: "1px solid var(--accent)",
                padding: "10px 20px",
                fontSize: 14,
                height: 42,
                borderRadius: 10,
                cursor: "pointer",
                letterSpacing: "-0.005em",
              }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,30,30,0.5)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bug-modal-title"
      onClick={busy ? undefined : onClose}
    >
      <div
        className="bg-[color:var(--paper-card)] w-full"
        style={{ maxWidth: 440, borderRadius: "var(--radius-card)", padding: 24, boxShadow: "0 24px 60px rgba(0,30,30,0.28)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 id="bug-modal-title" className="text-[17px] font-light tracking-tight" style={{ color: "var(--ink)" }}>
            Report a bug
          </h2>
          <p className="text-[13.5px] text-slate-600 mt-1.5">
            Found something broken? Let us know and we'll look into it.
          </p>
        </div>

        {/* Honeypot: hidden from real users, off the tab order. Bots that fill it
            are silently discarded server-side. */}
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

        <label className="block mt-5">
          <span className="text-[12.5px] font-medium text-slate-500">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 200))}
            disabled={busy}
            placeholder="Your name"
            className="mt-1.5 w-full text-[14px] text-slate-800 rounded-lg px-3 py-2 disabled:opacity-60"
            style={inputStyle}
          />
        </label>

        <label className="block mt-4">
          <span className="text-[12.5px] font-medium text-slate-500">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
            placeholder="you@example.com"
            className="mt-1.5 w-full text-[14px] text-slate-800 rounded-lg px-3 py-2 disabled:opacity-60"
            style={inputStyle}
          />
        </label>

        <label className="block mt-4">
          <span className="text-[12.5px] font-medium text-slate-500">Message</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
            disabled={busy}
            rows={4}
            placeholder="What went wrong? Where did it happen?"
            className="mt-1.5 w-full text-[14px] text-slate-800 rounded-lg px-3 py-2 resize-none disabled:opacity-60"
            style={inputStyle}
          />
        </label>

        {error && <p className="mt-2 text-[13px]" style={{ color: "#DC2626" }}>{error}</p>}

        <div className="flex items-center justify-end gap-2.5 mt-5">
          <Button variant="outline" size="md" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !name.trim() || !email.trim() || !message.trim()}
            className="inline-flex items-center justify-center gap-2 font-medium disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: "var(--accent)",
              color: "#fff",
              border: "1px solid var(--accent)",
              padding: "9px 16px",
              fontSize: 14,
              height: 40,
              borderRadius: 10,
              cursor: busy ? "not-allowed" : "pointer",
              letterSpacing: "-0.005em",
            }}
          >
            <Icon name="send" size={14} />
            {busy ? "Sending…" : "Send report"}
          </button>
        </div>
      </div>
    </div>
  );
}
