"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { RequestVerification } from "@/components/RequestVerification";
import { calcCompletion } from "@/components/profile-edit/sections";

/**
 * Owner-only "Your profile" card — the home for the meta controls that aren't
 * profile cards: completion meter, visibility (public/hidden), share link, and
 * the verification request. Rendered at the top of the right sidebar in owner
 * view only; visitors never see it. Replaces the old floating top toolbar.
 *
 * There is no global save in the per-section model, so the visibility toggle
 * persists immediately via `onVisibilityChange` (OwnerProfile owns the write).
 */
export function OwnerCard({ profile, onVisibilityChange, publicHref, publicUrl }) {
  const c = useMemo(() => calcCompletion(profile), [profile]);
  const visibility = profile.visibility ?? "public";

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
    if (value === visibility || savingVis) return;
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
    { value: "public", label: "Public", hint: "Listed on browse and visible to everyone.", icon: "globe" },
    { value: "hidden", label: "Hidden", hint: "Offline. Only you can see it.", icon: "eye" },
  ];

  return (
    <div className="space-y-[10px]">
      <div style={{ backgroundColor: "var(--paper-card)", borderRadius: "var(--radius-card)", padding: "18px 20px", backgroundImage: "repeating-linear-gradient(0deg, var(--line-strong) 0 10px, transparent 10px 20px), repeating-linear-gradient(90deg, var(--line-strong) 0 10px, transparent 10px 20px), repeating-linear-gradient(180deg, var(--line-strong) 0 10px, transparent 10px 20px), repeating-linear-gradient(270deg, var(--line-strong) 0 10px, transparent 10px 20px)", backgroundSize: "2px 100%, 100% 2px, 2px 100%, 100% 2px", backgroundPosition: "0 0, 0 0, 100% 0, 0 100%", backgroundRepeat: "no-repeat" }}>
        <div className="flex items-center gap-2 mb-3">
          <Icon name="eye" size={15} className="text-slate-500" />
          <h3 className="text-[19px] font-light text-slate-800 tracking-tight">Your profile</h3>
          <span className="ml-auto text-[11.5px] text-slate-400">Only you see this</span>
        </div>

        {/* Verification — top of the card so the get-verified nudge leads. */}
        <div className="mb-5 pb-5" style={{ borderBottom: "1px solid var(--desk)" }}>
          <RequestVerification status={profile.verificationStatus} completionPct={c.pct} unstyled />
        </div>

        {/* Completion */}
        <div className="flex items-center justify-between text-[12.5px] mb-1.5">
          <span className="text-slate-500">Profile completion</span>
          <span className="font-medium text-slate-700 tabular-nums">{c.pct}%</span>
        </div>
        <div style={{ height: 6, background: "var(--desk)", borderRadius: 999, overflow: "hidden" }}>
          <div style={{ width: `${c.pct}%`, height: "100%", background: c.pct >= 80 ? "var(--accent)" : "var(--ink)", transition: "width 220ms ease" }} />
        </div>
        <ul className="mt-3.5 space-y-2">
          {c.checks.map((ch) => (
            <li key={ch.key} className="flex items-center gap-2 text-[12.5px]">
              <span className="inline-flex items-center justify-center shrink-0"
                style={{ width: 15, height: 15, borderRadius: "50%", background: ch.ok ? "var(--accent)" : "var(--desk)", color: ch.ok ? "#fff" : "var(--sage)" }}>
                {ch.ok ? <Icon name="check" size={9} strokeWidth={3} /> : <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--sage)" }} />}
              </span>
              <span className={ch.ok ? "text-slate-600 line-through decoration-slate-300" : "text-slate-700"}>{ch.key}</span>
              {ch.soon && (
                <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0"
                  style={{ background: "var(--bg-soft)", border: "1px solid var(--paper-line)", color: "var(--sage)" }}>
                  Coming soon
                </span>
              )}
            </li>
          ))}
        </ul>

        {/* Visibility */}
        <div className="mt-5 pt-5" style={{ borderTop: "1px solid var(--desk)" }}>
          <div className="flex items-center gap-2 mb-2.5">
            <h4 className="text-[13px] font-light text-slate-800">Visibility</h4>
            {savingVis && <span className="text-[11.5px] text-slate-400">Saving…</span>}
            {savedVis && !savingVis && (
              <span className="text-[11.5px] inline-flex items-center gap-1" style={{ color: "var(--accent)" }}>
                <Icon name="check" size={11} strokeWidth={3} /> Saved
              </span>
            )}
          </div>
          <div className="space-y-1.5">
            {visOptions.map((o) => {
              const active = visibility === o.value;
              return (
                <button key={o.value} type="button" onClick={() => changeVisibility(o.value)} disabled={savingVis}
                  className="w-full text-left flex items-start gap-3 px-3 py-2.5 transition-colors"
                  style={{ background: active ? "var(--ink)" : "var(--bg-soft)", color: active ? "#fff" : "var(--ink)", borderRadius: 10, border: `1px solid ${active ? "var(--ink)" : "transparent"}` }}>
                  <span className="inline-flex items-center justify-center shrink-0 mt-0.5"
                    style={{ width: 16, height: 16, borderRadius: "50%", border: `1.5px solid ${active ? "#fff" : "var(--line-strong)"}`, background: active ? "#fff" : "transparent" }}>
                    {active && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ink)" }} />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-1.5 text-[13.5px] font-medium"><Icon name={o.icon} size={13} /> {o.label}</span>
                    <span className={"block text-[12px] mt-0.5 " + (active ? "text-white/70" : "text-slate-500")}>{o.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Share link */}
        <div className="mt-5 pt-5" style={{ borderTop: "1px solid var(--desk)" }}>
          <h4 className="text-[13px] font-light text-slate-800 mb-2">Public profile link</h4>
          <button type="button" onClick={copyLink} title={copied ? "Copied!" : "Click to copy"}
            className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-slate-100"
            style={{ background: "var(--bg-soft)", borderRadius: 10 }}>
            <Icon name={copied ? "check" : "globe"} size={14} className={(copied ? "text-emerald-500" : "text-slate-400") + " shrink-0"} />
            <code className="text-[12.5px] text-slate-700 truncate flex-1 min-w-0">{publicHref}</code>
            <span className={"text-[11px] font-medium shrink-0 " + (copied ? "text-emerald-600" : "text-slate-400")}>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
