"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";
import { MAX_NOTE_LENGTH } from "@/lib/tutorInvite";

const MAX_NOTE = MAX_NOTE_LENGTH; // mirrored by save_managed_note (0081)
const MAX_CHANGE_NOTE = 500; // must match respond_managed_setup (0081)

const formatDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "Australia/Sydney" })
    : "";

async function post(path, body) {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.error || "Something went wrong. Please try again." };
    return { ok: true, ...data };
  } catch {
    return { ok: false, error: "Network error. Please try again." };
  }
}

/**
 * The managed tutor's side of setup (0081), in the owner card. Their profile
 * is read-only while MatchTutor sets it up; this panel says where setup
 * stands and holds the two things they can do:
 *
 *   stage "setup"             we are still working on it
 *   stage "sent"              Approve, or Request changes with a note
 *   stage "changes_requested" we have their note and are editing
 *   stage "approved"          waiting for us to verify and publish
 *
 * plus one note for the team they can rewrite at any stage (admins are
 * emailed on each change). `setup` is get_my_managed_setup's row from the
 * server: { stage, sent_at, admin_message, change_note, tutor_note }.
 */
export function ManagedSetupPanel({ setup, inviteMaterialsSubmitted }) {
  const router = useRouter();
  const [stage, setStage] = useState(setup?.stage ?? "setup");
  const [changeNote, setChangeNote] = useState(setup?.change_note ?? "");
  const [asking, setAsking] = useState(false); // the "request changes" form is open
  const [request, setRequest] = useState("");
  const [busy, setBusy] = useState(null); // "approve" | "changes" | "note"
  const [error, setError] = useState("");

  const [savedNote, setSavedNote] = useState(setup?.tutor_note ?? "");
  const [note, setNote] = useState(setup?.tutor_note ?? "");
  const [noteError, setNoteError] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);

  const respond = async (decision) => {
    setBusy(decision);
    setError("");
    const r = await post("/api/managed-setup/respond", { decision, note: decision === "changes" ? request.trim() : undefined });
    setBusy(null);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    // Not applied: we recalled the profile (or they answered in another tab)
    // since this page loaded. Show where it really stands.
    setStage(r.stage ?? "setup");
    if (r.applied && decision === "changes") setChangeNote(r.changeNote ?? request.trim());
    if (!r.applied) setError("This changed while the page was open, so your answer was not sent. Here is where your profile stands now.");
    setAsking(false);
    setRequest("");
    router.refresh();
  };

  const saveNote = async () => {
    setBusy("note");
    setNoteError("");
    setNoteSaved(false);
    const r = await post("/api/managed-setup/note", { note });
    setBusy(null);
    if (!r.ok) {
      setNoteError(r.error);
      return;
    }
    setSavedNote(r.note ?? "");
    setNote(r.note ?? "");
    setNoteSaved(true);
  };

  const head = {
    setup: {
      icon: "clock",
      title: "We're setting up your profile",
      body: "Our team is building your profile. We'll email you when it is ready for you to review. It stays hidden until you approve it and we verify you.",
    },
    sent: {
      icon: "eye",
      title: "Your profile is ready to review",
      body: `Look over your profile on this page${setup?.sent_at ? ` (sent ${formatDate(setup.sent_at)})` : ""}. Approve it if you're happy, or tell us what to change.`,
    },
    changes_requested: {
      icon: "pencil",
      title: "We're making your changes",
      body: "Thanks, we have your note. We'll email you when the profile is ready to review again.",
    },
    approved: {
      icon: "check-circle",
      title: "You approved your profile",
      body: "Our team will now verify you and make your profile public. We'll email you when it is live.",
    },
  }[stage] ?? { icon: "clock", title: "We're setting up your profile", body: "" };

  const noteDirty = note.trim() !== savedNote.trim();

  return (
    <div>
      <div className="flex items-start gap-2">
        <span className="shrink-0 mt-0.5" style={{ color: "var(--accent)" }}>
          <Icon name={head.icon} size={15} />
        </span>
        <div className="min-w-0">
          <h3 className="text-[14px] font-medium tracking-tight" style={{ color: "var(--ink)" }}>{head.title}</h3>
          <p className="text-[12.5px] leading-[1.5] mt-0.5" style={{ color: "var(--ink-muted)" }}>{head.body}</p>
        </div>
      </div>

      {stage === "sent" && setup?.admin_message && (
        <p className="mt-3 text-[12.5px] leading-[1.5] whitespace-pre-wrap break-words px-3 py-2.5" style={{ background: "var(--bg-soft)", borderRadius: 10, color: "var(--ink)" }}>
          <span className="font-medium">Note from the team:</span> {setup.admin_message}
        </p>
      )}

      {stage === "changes_requested" && changeNote && (
        <p className="mt-3 text-[12.5px] leading-[1.5] whitespace-pre-wrap break-words px-3 py-2.5" style={{ background: "var(--bg-soft)", borderRadius: 10, color: "var(--ink)" }}>
          <span className="font-medium">You asked for:</span> {changeNote}
        </p>
      )}

      {stage === "sent" && !asking && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" icon="check" onClick={() => respond("approve")} disabled={busy !== null}>
            {busy === "approve" ? "Approving…" : "Approve profile"}
          </Button>
          <Button size="sm" variant="outline" icon="pencil" onClick={() => { setAsking(true); setError(""); }} disabled={busy !== null}>
            Request changes
          </Button>
        </div>
      )}

      {stage === "sent" && asking && (
        <div className="mt-3">
          <label htmlFor="managed-change-note" className="block text-[12.5px] font-medium mb-1.5" style={{ color: "var(--ink)" }}>
            What should we change?
          </label>
          <textarea
            id="managed-change-note"
            value={request}
            onChange={(e) => setRequest(e.target.value.slice(0, MAX_CHANGE_NOTE))}
            rows={3}
            className="w-full px-3 py-2 text-[13px]"
            style={{ border: "1px solid var(--paper-line)", borderRadius: 10, outline: "none", resize: "vertical", color: "var(--ink)", background: "var(--paper-card)" }}
          />
          <div className="text-right text-[11px] tabular-nums" style={{ color: "var(--ink-muted)" }}>{request.length}/{MAX_CHANGE_NOTE}</div>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <Button size="sm" icon="send" onClick={() => respond("changes")} disabled={busy !== null || !request.trim()}>
              {busy === "changes" ? "Sending…" : "Send to the team"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setAsking(false); setError(""); }} disabled={busy !== null}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-[12.5px]" style={{ color: "#DC2626" }} role="alert">{error}</p>}

      {/* The one note for the team, at any stage. */}
      <div className="mt-4">
        <label htmlFor="managed-note" className="block text-[12.5px] font-medium mb-1" style={{ color: "var(--ink)" }}>
          Note for the MatchTutor team
        </label>
        <p className="text-[12px] mb-1.5" style={{ color: "var(--ink-muted)" }}>
          Anything we should know or include. Only our team sees it, and you can change it at any time.
        </p>
        <textarea
          id="managed-note"
          value={note}
          onChange={(e) => { setNote(e.target.value.slice(0, MAX_NOTE)); setNoteSaved(false); }}
          rows={3}
          className="w-full px-3 py-2 text-[13px]"
          style={{ border: "1px solid var(--paper-line)", borderRadius: 10, outline: "none", resize: "vertical", color: "var(--ink)", background: "var(--paper-card)" }}
        />
        <div className="flex items-center gap-2 mt-1.5">
          <Button size="sm" variant="outline" onClick={saveNote} disabled={busy !== null || !noteDirty}>
            {busy === "note" ? "Saving…" : "Save note"}
          </Button>
          {noteSaved && !noteDirty && (
            <span className="text-[11.5px] inline-flex items-center gap-1" style={{ color: "var(--accent)" }}>
              <Icon name="check" size={11} strokeWidth={3} /> Saved
            </span>
          )}
          <span className="ml-auto text-[11px] tabular-nums" style={{ color: "var(--ink-muted)" }}>{note.length}/{MAX_NOTE}</span>
        </div>
        {noteError && <p className="mt-1.5 text-[12.5px]" style={{ color: "#DC2626" }} role="alert">{noteError}</p>}
      </div>

      {!inviteMaterialsSubmitted && (
        <a href="/quick-join/details" className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium" style={{ color: "var(--accent)" }}>
          <Icon name="upload" size={13} /> Send us your resume, certificates or links
        </a>
      )}

      <p className="mt-3 text-[12px] leading-[1.5]" style={{ color: "var(--ink-muted)" }}>
        You can&apos;t edit your profile while we set it up. To take it back and do it yourself, go to{" "}
        <a href="/account" className="underline underline-offset-2">Account settings</a>.
      </p>
    </div>
  );
}
