"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";
import { Field, TextInput, Select } from "@/components/profile-edit/sections";
import { cardStyle } from "@/app/tutor/[slug]/ProfileCards";
import { AU_STATES } from "@/lib/states";

// Same clipboard + textarea fallback as app/tutor/[slug]/OwnerCard.jsx.
async function copyText(text) {
  if (typeof text !== "string") throw new Error("Could not copy the link.");
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}

const EMPTY_FORM = { name: "", website: "", suburb: "", state: "" };

const STATE_OPTIONS = [
  { value: "", label: "Choose a state" },
  ...AU_STATES.map((s) => ({ value: s.slug, label: s.name })),
];

function ErrorNote({ children }) {
  return (
    <div
      className="flex items-start gap-2 text-[13px] mt-3"
      style={{ background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: 12, padding: "11px 13px" }}
    >
      <Icon name="alert-triangle" size={15} />
      <span>{children}</span>
    </div>
  );
}

/**
 * /companies/invite. Create a company (hidden until claimed) and copy its
 * claim link, plus the shared list of every company with a re-copy button on
 * unclaimed ones. Every write goes through /api/companies/invite*, whose RPCs
 * are the real permission check.
 */
export function InviteCompanies({ initialCompanies, loadFailed }) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY_FORM);
  const [state, setState] = useState("idle"); // idle | working | duplicate | error
  const [message, setMessage] = useState("");
  const [matches, setMatches] = useState([]);
  const [created, setCreated] = useState(null); // { name, link }

  const set = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }));
    // Editing the form after a duplicate warning is a fresh attempt.
    if (state === "duplicate" || state === "error") setState("idle");
  };

  const submit = async (allowDuplicate = false) => {
    if (!form.name.trim()) {
      setState("error");
      setMessage("Enter the company's name.");
      return;
    }
    setState("working");
    setMessage("");
    try {
      const res = await fetch("/api/companies/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, allowDuplicate }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        setMessage(data?.error || "Something went wrong, please try again.");
        return;
      }
      if (data.status === "duplicate") {
        setMatches(data.matches ?? []);
        setState("duplicate");
        return;
      }
      setCreated({ name: form.name.trim(), link: data.link });
      setForm(EMPTY_FORM);
      setState("idle");
      // Re-run the server list so the new company appears below.
      router.refresh();
    } catch {
      setState("error");
      setMessage("Network error, please try again.");
    }
  };

  const working = state === "working";

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/companies"
          className="inline-flex items-center gap-1 text-[13px] text-slate-500 hover:text-slate-700"
        >
          <Icon name="chevron-left" size={14} /> Companies
        </Link>
        <h1 className="text-[32px] font-light text-slate-800 tracking-tight mt-2">Invite a company</h1>
        <p className="text-[14.5px] text-slate-500 mt-1 max-w-[620px]">
          Create a page for a tutoring company and send them the link. Their page stays hidden until
          they claim it and choose to make it live.
        </p>
      </div>

      {created ? (
        <CreatedCard created={created} onAnother={() => setCreated(null)} />
      ) : (
        <form
          className="bg-[color:var(--paper-card)] p-5 sm:p-6"
          style={cardStyle}
          onSubmit={(e) => {
            e.preventDefault();
            submit(false);
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Field label="Company name">
                <TextInput value={form.name} onChange={set("name")} placeholder="Acme Tutoring" maxLength={120} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Website" optional>
                <TextInput value={form.website} onChange={set("website")} placeholder="https://acme.com.au" type="url" inputMode="url" />
              </Field>
            </div>
            <Field label="Suburb" optional>
              <TextInput value={form.suburb} onChange={set("suburb")} placeholder="Chatswood" />
            </Field>
            <Field label="State" optional as="div">
              <Select value={form.state} onChange={set("state")} options={STATE_OPTIONS} />
            </Field>
          </div>

          {state === "duplicate" && (
            <div
              className="mt-5 text-[13.5px]"
              style={{ background: "#FFFBEB", color: "#92400E", border: "1px solid #FDE68A", borderRadius: 12, padding: "12px 14px" }}
            >
              <div className="flex items-start gap-2">
                <Icon name="alert-triangle" size={15} />
                <div className="min-w-0">
                  <div className="font-medium">A company with this name already exists.</div>
                  <ul className="mt-1.5 space-y-0.5">
                    {matches.map((m) => (
                      <li key={m.slug}>
                        {m.name}: {m.claimed ? "claimed" : "not claimed yet"}
                        {m.invited_by ? `, invited by ${m.invited_by}` : ""}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2">
                    If this is a different branch, you can still create it. Otherwise, copy the existing
                    link from the list below.
                  </div>
                  <div className="mt-3">
                    <Button size="sm" variant="outline" onClick={() => submit(true)} disabled={working}>
                      Create anyway
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {state === "error" && <ErrorNote>{message}</ErrorNote>}

          <div className="mt-5">
            <Button type="submit" icon="plus" disabled={working || state === "duplicate"}>
              {working ? "Creating…" : "Create and get link"}
            </Button>
          </div>
        </form>
      )}

      <CompanyList companies={initialCompanies} loadFailed={loadFailed} />
    </div>
  );
}

/**
 * `text` copies a link we already have. `getText` fetches a fresh one first.
 *
 * The fetch case is awkward: Safari only allows a clipboard write inside the
 * click that caused it, and awaiting a network call ends that window. Handing
 * ClipboardItem a PROMISE of the text is the sanctioned way round it (the write
 * starts inside the click and resolves later). Where that isn't supported, or
 * any copy fails, the link is shown on screen so it can still be copied by hand.
 */
function CopyButton({ text, getText, label = "Copy link", size = "sm", variant = "outline" }) {
  const [status, setStatus] = useState("idle"); // idle | working | copied | error
  const [error, setError] = useState("");
  const [shown, setShown] = useState("");
  const timer = useRef(null);
  useEffect(() => () => timer.current && clearTimeout(timer.current), []);

  const onClick = async () => {
    setStatus("working");
    setError("");
    setShown("");
    let value = text;
    try {
      if (value == null) {
        const pending = getText();
        pending.then((v) => { value = v; }, () => {});
        if (typeof window !== "undefined" && window.ClipboardItem && navigator.clipboard?.write) {
          try {
            await navigator.clipboard.write([
              new window.ClipboardItem({
                "text/plain": pending.then((v) => new Blob([v], { type: "text/plain" })),
              }),
            ]);
          } catch {
            // Clipboard refused; fall through to a plain write with the text.
            await copyText(await pending);
          }
        } else {
          await copyText(await pending);
        }
      } else {
        await copyText(value);
      }
      setStatus("copied");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setStatus("idle"), 1800);
    } catch (e) {
      setStatus("error");
      if (typeof value === "string") {
        // We have the link, only the clipboard failed.
        setShown(value);
        setError("Couldn't copy automatically. Select the link below and copy it.");
      } else {
        setError(e?.message || "Could not create a link.");
      }
    }
  };

  return (
    <span className="inline-flex flex-col items-end max-w-full">
      <Button size={size} variant={variant} icon={status === "copied" ? "check" : "copy"} onClick={onClick} disabled={status === "working"}>
        {status === "copied" ? "Copied" : status === "working" ? "Copying…" : label}
      </Button>
      {status === "error" && <span className="text-[12px] text-rose-600 mt-1 text-right">{error}</span>}
      {shown && (
        <span
          className="text-[12px] text-slate-700 break-all mt-1 select-all"
          style={{ background: "var(--bg-soft)", borderRadius: 8, padding: "6px 10px" }}
        >
          {shown}
        </span>
      )}
    </span>
  );
}

function CreatedCard({ created, onAnother }) {
  return (
    <div className="bg-[color:var(--paper-card)] p-5 sm:p-6" style={cardStyle}>
      <div className="flex items-center gap-2">
        <span className="inline-flex" style={{ color: "var(--accent)" }}>
          <Icon name="check-circle" size={18} />
        </span>
        <h2 className="text-[20px] font-light text-slate-800 tracking-tight">{created.name} is ready to invite</h2>
      </div>
      <p className="text-[14px] text-slate-500 mt-1.5">
        Copy this link and send it to the company yourself, by email or message. The link works once and
        lasts 90 days. Their page stays hidden until they claim it and make it live.
      </p>
      <div
        className="mt-4 text-[13px] text-slate-700 break-all"
        style={{ background: "var(--bg-soft)", borderRadius: 10, padding: "10px 14px" }}
      >
        {created.link}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <CopyButton text={created.link} size="md" variant="primary" />
        <Button size="md" variant="outline" icon="plus" onClick={onAnother}>
          Invite another
        </Button>
      </div>
    </div>
  );
}

function StatusChip({ children, tone }) {
  const tones = {
    good: { bg: "var(--accent-softer)", color: "var(--accent)", border: "var(--accent-line)" },
    muted: { bg: "var(--bg-soft)", color: "var(--ink-graphite, #475569)", border: "var(--paper-line)" },
  };
  const t = tones[tone] ?? tones.muted;
  return (
    <span
      className="inline-flex items-center text-[11.5px] font-medium"
      style={{ background: t.bg, color: t.color, border: `1px solid ${t.border}`, borderRadius: 999, padding: "2px 9px" }}
    >
      {children}
    </span>
  );
}

function CompanyList({ companies, loadFailed }) {
  const fetchLink = (id) => async () => {
    const res = await fetch("/api/companies/invite/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.link) throw new Error(data?.error || "Could not create a link.");
    return data.link;
  };

  return (
    <div className="bg-[color:var(--paper-card)]" style={cardStyle}>
      <div className="px-5 sm:px-6 pt-5 pb-3">
        <h2 className="text-[20px] font-light text-slate-800 tracking-tight">All companies</h2>
        <p className="text-[13px] text-slate-500 mt-0.5">
          Every company on MatchTutor. Copying a link for an unclaimed company makes a fresh one that lasts 90 days.
        </p>
      </div>

      {loadFailed ? (
        <div className="px-5 sm:px-6 pb-5">
          <ErrorNote>Could not load the company list. Refresh the page to try again.</ErrorNote>
        </div>
      ) : companies.length === 0 ? (
        <p className="px-5 sm:px-6 pb-6 text-[14px] text-slate-500">No companies yet. Create the first one above.</p>
      ) : (
        <ul>
          {companies.map((c) => (
            <li
              key={c.id}
              className="px-5 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4"
              style={{ borderTop: "1px solid var(--paper-line)" }}
            >
              <div className="min-w-0 flex-1">
                <div className="text-[14.5px] font-medium text-slate-800 truncate">
                  {c.hidden ? (
                    c.name
                  ) : (
                    <Link href={`/companies/${c.slug}`} className="hover:underline">
                      {c.name}
                    </Link>
                  )}
                </div>
                <div className="text-[12.5px] text-slate-500 mt-0.5">
                  {c.invitedBy ? `Invited by ${c.invitedBy}` : "Added by script"}
                  {c.createdLabel ? ` · ${c.createdLabel}` : ""}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <StatusChip tone={c.claimed ? "good" : "muted"}>{c.claimed ? "Claimed" : "Not claimed"}</StatusChip>
                <StatusChip tone={c.hidden ? "muted" : "good"}>{c.hidden ? "Hidden" : "Live"}</StatusChip>
                {!c.claimed && <CopyButton getText={fetchLink(c.id)} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
