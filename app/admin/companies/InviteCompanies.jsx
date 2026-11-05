"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";
import { Field, TextInput, Select } from "@/components/profile-edit/sections";
import { AU_STATES } from "@/lib/states";
import { DecisionPanel } from "../_components/DecisionPanel";
import { PageHeader, Panel, Chip } from "../_components/ui";

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
    <p role="alert" className="flex items-start gap-2 mt-3 text-[14px] leading-5 text-error">
      <span className="shrink-0 mt-0.5"><Icon name="alert-triangle" size={16} /></span>
      <span>{children}</span>
    </p>
  );
}

/**
 * /admin/companies. Create a company (hidden until claimed) and copy its
 * claim link, plus the list of every company with a re-copy button on
 * unclaimed ones and hide / show / delete controls. Every write goes through
 * /api/admin/companies/*, whose RPCs are the real permission check and write
 * History.
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
      const res = await fetch("/api/admin/companies/invite", {
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
    <>
      <PageHeader
        title="Companies"
        lead="Create a page for a tutoring company and send them the link. Their page stays hidden until they claim it and choose to make it live."
      />

      {created ? (
        <CreatedCard created={created} onAnother={() => setCreated(null)} />
      ) : (
        <Panel title="Create a company">
          <form
            className="max-w-[680px]"
            onSubmit={(e) => {
              e.preventDefault();
              submit(false);
            }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Field label="Company name">
                  <TextInput value={form.name} onChange={set("name")} maxLength={120} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Website" optional>
                  <TextInput value={form.website} onChange={set("website")} type="url" inputMode="url" />
                </Field>
              </div>
              <Field label="Suburb" optional>
                <TextInput value={form.suburb} onChange={set("suburb")} />
              </Field>
              <Field label="State" optional as="div">
                <Select value={form.state} onChange={set("state")} options={STATE_OPTIONS} />
              </Field>
            </div>

            {state === "duplicate" && (
              <div role="alert" className="mt-6 p-4 rounded border border-warning text-[14px] leading-5 text-[color:var(--text)]">
                <div className="flex items-start gap-2">
                  <span className="shrink-0 mt-0.5 text-warning"><Icon name="alert-triangle" size={16} /></span>
                  <div className="min-w-0">
                    <div className="font-semibold">A company with this name already exists.</div>
                    <ul className="mt-2 space-y-1">
                      {matches.map((m) => (
                        <li key={m.slug}>
                          {m.name}: {m.claimed ? "claimed" : "not claimed yet"}
                          {m.invited_by ? `, invited by ${m.invited_by}` : ""}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 text-[color:var(--text-2)]">
                      If this is a different branch, you can still create it. Otherwise, copy the existing
                      link from the list below.
                    </div>
                    <div className="mt-3">
                      <Button variant="outline" onClick={() => submit(true)} disabled={working}>
                        Create anyway
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {state === "error" && <ErrorNote>{message}</ErrorNote>}

            <div className="mt-6">
              <Button type="submit" disabled={working || state === "duplicate"}>
                {working ? "Creating…" : "Create and get link"}
              </Button>
            </div>
          </form>
        </Panel>
      )}

      <CompanyList companies={initialCompanies} loadFailed={loadFailed} />
    </>
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
      <Button size={size} variant={variant} onClick={onClick} disabled={status === "working"}>
        {status === "copied" ? "Copied" : status === "working" ? "Copying…" : label}
      </Button>
      {status === "error" && <span role="alert" className="mt-1 text-[14px] leading-5 text-error text-right">{error}</span>}
      {shown && (
        <span className="mt-1 px-2 py-1 rounded bg-surface-2 text-[14px] leading-5 text-[color:var(--text)] break-all select-all">
          {shown}
        </span>
      )}
    </span>
  );
}

function CreatedCard({ created, onAnother }) {
  return (
    <Panel title={`${created.name} is ready to invite`}>
      <p className="text-[14px] leading-5 text-[color:var(--text-2)]">
        Copy this link and send it to the company yourself, by email or message. The link works once and
        lasts 90 days. Their page stays hidden until they claim it and make it live.
      </p>
      <div className="mt-4 p-3 rounded bg-surface-2 text-[14px] leading-5 text-[color:var(--text)] break-all select-all">
        {created.link}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <CopyButton text={created.link} size="md" variant="primary" />
        <Button size="md" variant="outline" onClick={onAnother}>
          Invite another
        </Button>
      </div>
    </Panel>
  );
}

function CompanyList({ companies, loadFailed }) {
  const [managing, setManaging] = useState(null); // company id
  const fetchLink = (id) => async () => {
    const res = await fetch("/api/admin/companies/invite/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.link) throw new Error(data?.error || "Could not create a link.");
    return data.link;
  };

  return (
    <Panel
      title="All companies"
      lead="Every company on MatchTutor. Copying a link for an unclaimed company makes a fresh one that lasts 90 days. Manage hides, shows or deletes a company."
      padded={false}
    >
      {loadFailed ? (
        <ErrorNote>Could not load the company list. Refresh the page to try again.</ErrorNote>
      ) : companies.length === 0 ? (
        <p className="py-4 text-[14px] leading-5 text-[color:var(--text-2)]">No companies yet. Create the first one above.</p>
      ) : (
        <ul className="border-t border-rule">
          {companies.map((c) => (
            <li key={c.id} className="border-b border-rule">
              <div className="px-3 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] leading-5 font-semibold text-[color:var(--text)] truncate">
                    {c.hidden ? (
                      c.name
                    ) : (
                      <Link href={`/companies/${c.slug}`} className="text-accent hover:text-accent-hover">
                        {c.name}
                      </Link>
                    )}
                  </div>
                  <div className="text-[12px] leading-4 text-muted">
                    {c.invitedBy ? `Invited by ${c.invitedBy}` : "Added by script"}
                    {c.createdLabel ? ` · ${c.createdLabel}` : ""}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <Chip tone={c.claimed ? "good" : "muted"}>{c.claimed ? "Claimed" : "Not claimed"}</Chip>
                  <Chip tone={c.hidden ? "muted" : "good"}>{c.hidden ? "Hidden" : "Live"}</Chip>
                  {!c.claimed && <CopyButton getText={fetchLink(c.id)} />}
                  <Button
                    size="sm"
                    variant={managing === c.id ? "outline" : "ghost"}
                    onClick={() => setManaging(managing === c.id ? null : c.id)}
                  >
                    Manage
                  </Button>
                </div>
              </div>
              {managing === c.id && <ManageCompany company={c} />}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// Hide / show and delete for one company. Delete asks for the word DELETE,
// since it removes the company's tutors, packages and reviews for good.
function ManageCompany({ company }) {
  return (
    <div className="px-3 pb-4">
      <div className="bg-surface-2 rounded p-4">
        <p className="mb-4 text-[14px] leading-5 text-[color:var(--text-2)]">
          {company.hidden
            ? "Making it live shows the page and its tutors in search."
            : "Hiding takes the page and its tutors out of search. The owner can still edit it."}{" "}
          Deleting removes the company, its tutors, packages and reviews for good; a claimed owner keeps their
          account and picks a new role at next sign-in.
        </p>
        <DecisionPanel
          endpoint="/api/admin/companies"
          body={{ companyId: company.id }}
          reasonHint="For History only."
          actions={[
            company.hidden
              ? { key: "show", label: "Make live", busyLabel: "Saving…", tone: "primary", icon: "eye", path: "visibility", body: { visibility: "public" }, doneText: `${company.name} is live.` }
              : { key: "hide", label: "Hide", busyLabel: "Saving…", tone: "neutral", icon: "eye-off", path: "visibility", body: { visibility: "hidden" }, doneText: `${company.name} is hidden.` },
            { key: "delete", label: "Delete company", busyLabel: "Deleting…", tone: "danger-outline", icon: "trash", path: "delete", confirmWord: "DELETE", doneText: `${company.name} was deleted.` },
          ]}
        />
      </div>
    </div>
  );
}
