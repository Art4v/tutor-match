"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";
import { RequestVerification } from "@/components/RequestVerification";
import { ProfileReviewStatus } from "./ProfileReviewStatus";
import { calcCompletion } from "@/components/profile-edit/sections";

/**
 * Owner-only "Your profile" section: the home for the meta controls that
 * aren't profile sections: the verification notice, the completion checklist,
 * visibility (public/hidden), the share link. Rendered at the top of the right sidebar in owner
 * view only; visitors never see it. Replaces the old floating top toolbar.
 *
 * There is no global save in the per-section model, so the visibility toggle
 * persists immediately via `onVisibilityChange` (OwnerProfile owns the write).
 * `onVerificationRequested` lifts a new request into OwnerProfile, which needs
 * to know a request is pending so a later save can warn that it withdraws it.
 * `review` (verified tutors only, 0072) carries the draft's review state and
 * handlers for ProfileReviewStatus; null for everyone else.
 *
 * Admin-managed tutors (0076): the tutor sees a "managed by MatchTutor" note,
 * no verification request (admins set it) and a read-only visibility toggle.
 * `adminMode` is the admin editing that tutor: visibility works, and the
 * tutor-only controls are hidden.
 */
export function OwnerCard({ profile, onVisibilityChange, onVerificationRequested, review, publicHref, publicUrl, adminMode = false }) {
  const c = useMemo(() => calcCompletion(profile), [profile]);
  const visibility = profile.visibility ?? "public";
  const managedByUs = !!profile.managed && !adminMode;
  const visibilityLocked = managedByUs;

  const [savingVis, setSavingVis] = useState(false);
  const [savedVis, setSavedVis] = useState(false);
  const savedTimer = useRef(null);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef(null);
  useEffect(() => () => {
    if (savedTimer.current) clearTimeout(savedTimer.current);
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  const changeVisibility = async (value) => {
    if (value === visibility || savingVis || visibilityLocked) return;
    setSavingVis(true);
    setSavedVis(false);
    const ok = await onVisibilityChange(value);
    setSavingVis(false);
    if (ok) {
      setSavedVis(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSavedVis(false), 1800);
    }
  };

  const copyLink = async () => {
    const toCopy = publicUrl || publicHref;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(toCopy);
      } else {
        const ta = document.createElement("textarea");
        ta.value = toCopy;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const visOptions = [
    { value: "public", label: "Public", hint: "Listed on browse and visible to everyone." },
    { value: "hidden", label: "Hidden", hint: "Offline. Only you can see it." },
  ];
  const sub = "border-t border-rule pt-6 mt-6";

  // A flat section in the right column (DESIGN.md §6 "Section"): no card, no
  // shadow, no dashed border. Groups inside are divided by rules.
  return (
    <section className="border-b border-rule py-6" aria-labelledby="owner-card-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="owner-card-title" className="text-[20px] leading-7 font-semibold text-[color:var(--text)]">Your profile</h2>
        <span className="text-[12px] leading-4 text-muted">{adminMode ? "Admin view" : "Only you see this"}</span>
      </div>

      {managedByUs && (
        <div className="mt-4">
          <p className="text-[14px] leading-5 text-[color:var(--text-2)]">
            <span className="font-semibold text-[color:var(--text)]">MatchTutor manages your profile.</span>{" "}
            {profile.managedSetupDone
              ? "Changes you make are sent to us for approval, and we decide when it is shown."
              : "We're setting it up for you and will make it public when it's ready. Changes you make are sent to us for approval."}{" "}
            You can stop this in{" "}
            <a href="/account" className="text-accent underline hover:text-accent-hover">Account settings</a>.
          </p>
          {!profile.inviteMaterialsSubmitted && (
            <a
              href="/join/details"
              className="mt-2 inline-flex min-h-6 items-center text-[14px] leading-5 font-semibold text-accent hover:text-accent-hover"
              style={{ transition: "color 120ms ease-out" }}
            >
              Send us your resume, certificates or links
            </a>
          )}
        </div>
      )}

      {/* Verified tutors: where their reviewed draft stands. Leads, since it is
          the thing they act on. */}
      {review && (
        <div className="mt-6">
          <ProfileReviewStatus {...review} />
        </div>
      )}

      {/* Verification nudge (REDESIGN_DECISIONS.md item 7): one plain notice
          with the button, then the checklist of what is missing. Not for
          managed tutors: admins set their verification (0076). */}
      {!adminMode && !profile.managed && (
        <div className={review ? sub : "mt-6"}>
          {/* Keyed on the status: RequestVerification seeds its own state once,
              so a withdrawal (a save while pending, 0072) must remount it. */}
          <RequestVerification
            key={profile.verificationStatus ?? "none"}
            status={profile.verificationStatus}
            completionPct={c.pct}
            onRequested={onVerificationRequested}
            unstyled
          />
        </div>
      )}

      {/* Checklist: plain items, a --success check when done. No percentage
          bar, no dots. Same definition as the ranking (lib/ranking.js). */}
      <div className={sub}>
        <h3 className="text-[16px] leading-6 font-semibold text-[color:var(--text)]">Profile checklist</h3>
        <p className="mt-1 text-[12px] leading-4 text-muted">
          {c.done} of {c.total} done. A complete profile ranks higher in search.
        </p>
        <ul className="mt-2">
          {c.checks.map((ch) => (
            <li key={ch.key} className="flex min-h-6 items-center gap-2 py-1 text-[14px] leading-5">
              <span className="inline-flex w-4 shrink-0 justify-center" style={{ color: "var(--success)" }}>
                {ch.ok && <Icon name="check" size={16} />}
              </span>
              <span className={ch.ok ? "text-[color:var(--text-2)]" : "text-[color:var(--text)]"}>
                {ch.key}
                {ch.ok && <span className="sr-only"> (done)</span>}
                {ch.soon && <span className="text-[12px] leading-4 text-muted"> (coming soon)</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Visibility: two plain radio rows. Persists immediately. */}
      <fieldset className={sub} disabled={savingVis || visibilityLocked}>
        <legend className="sr-only">Visibility</legend>
        <div className="flex items-center gap-2">
          <h3 className="text-[16px] leading-6 font-semibold text-[color:var(--text)]" aria-hidden="true">Visibility</h3>
          <span className="text-[12px] leading-4 text-muted" role="status">
            {savingVis ? "Saving…" : savedVis ? "Saved" : ""}
          </span>
        </div>
        {visibilityLocked && (
          <p className="mt-1 text-[12px] leading-4 text-muted">MatchTutor decides when your profile is shown while we manage it.</p>
        )}
        <div className="mt-2">
          {visOptions.map((o) => (
            <label
              key={o.value}
              className={"flex min-h-11 items-start gap-3 py-2 " + (visibilityLocked ? "cursor-not-allowed opacity-50" : "cursor-pointer")}
            >
              <span className="flex h-5 shrink-0 items-center">
                <input
                  type="radio"
                  name="profile-visibility"
                  value={o.value}
                  checked={visibility === o.value}
                  onChange={() => changeVisibility(o.value)}
                  className="h-4 w-4"
                  style={{ accentColor: "var(--accent)" }}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] leading-5 font-semibold text-[color:var(--text)]">{o.label}</span>
                <span className="mt-1 block text-[12px] leading-4 text-muted">{o.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Share link */}
      <div className={sub}>
        <h3 className="text-[16px] leading-6 font-semibold text-[color:var(--text)]">Public profile link</h3>
        <div className="mt-2 flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[14px] leading-5 text-[color:var(--text-2)]">{publicHref}</span>
          <Button variant="outline" onClick={copyLink} ariaLabel={copied ? "Link copied" : "Copy profile link"}>
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>
    </section>
  );
}
