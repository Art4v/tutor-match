"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { RequestVerification } from "@/components/RequestVerification";
import { calcCompletion } from "@/components/profile-edit/sections";

/**
 * Floating owner-only bar pinned under the nav on the tutor's own profile.
 * Holds the meta controls that aren't profile "cards": completion meter,
 * visibility (public/hidden), verification request, and the share link.
 * Details open in a popover so the bar itself stays slim and its height stays
 * constant (the SaveBar sticks directly below it).
 */
export function OwnerToolbar({ tutor, set, publicHref, publicUrl, top = "var(--nav-h)" }) {
  const c = useMemo(() => calcCompletion(tutor), [tutor]);
  const isPublic = tutor.visibility === "public";

  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef(null);
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);

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

  return (
    <div className="sticky z-20" style={{ top }}>
      <div className="bg-[rgba(251,247,236,0.92)] backdrop-blur" style={{ borderBottom: "1px solid var(--paper-line)" }}>
        <div className="max-w-[1200px] mx-auto px-6 h-[46px] flex items-center gap-3 text-[12.5px]">
          <span className="hidden sm:flex items-center gap-1.5 text-slate-500 shrink-0">
            <Icon name="eye" size={14} /> You're viewing your own profile
          </span>
          <span className="hidden sm:inline text-slate-300">·</span>

          {/* Completion */}
          <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 min-w-0 group">
            <span className="inline-block w-[70px] h-1.5 rounded-full overflow-hidden shrink-0" style={{ background: "var(--desk)" }}>
              <span className="block h-full" style={{ width: `${c.pct}%`, background: c.pct >= 80 ? "var(--accent)" : "var(--ink)", transition: "width 220ms ease" }} />
            </span>
            <span className="text-slate-700 font-medium tabular-nums shrink-0">{c.pct}% complete</span>
          </button>

          <span className="text-slate-300">·</span>

          {/* Visibility quick toggle */}
          <button
            type="button"
            onClick={() => set({ visibility: isPublic ? "hidden" : "public" })}
            title={isPublic ? "Visible to everyone — click to hide" : "Hidden — click to make public"}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full transition-colors hover:bg-slate-100 shrink-0"
            style={{ color: isPublic ? "var(--ink)" : "#B45309" }}
          >
            <Icon name={isPublic ? "globe" : "eye"} size={13} />
            {isPublic ? "Public" : "Hidden"}
          </button>

          <div className="flex-1" />

          {/* Share link */}
          <button
            type="button"
            onClick={copyLink}
            title={copied ? "Copied!" : "Copy public link"}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-colors hover:bg-slate-100 shrink-0"
            style={{ color: copied ? "var(--accent)" : "var(--ink-muted)" }}
          >
            <Icon name={copied ? "check" : "globe"} size={13} />
            <span className="hidden sm:inline">{copied ? "Copied" : "Share"}</span>
          </button>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full transition-colors hover:bg-slate-100 shrink-0 text-slate-600"
          >
            Details <Icon name={open ? "chevron-up" : "chevron-down"} size={13} />
          </button>
        </div>
      </div>

      {/* Popover details — absolutely positioned so the bar height stays fixed. */}
      {open && (
        <div className="absolute right-0 left-0 top-[46px] pointer-events-none">
          <div className="max-w-[1200px] mx-auto px-6">
            <div
              className="ml-auto w-full sm:w-[380px] pointer-events-auto bg-[color:var(--paper-card)] p-4 space-y-4"
              style={{ border: "1px solid var(--paper-line)", borderRadius: "var(--radius-card)", boxShadow: "0 12px 34px rgba(15,23,42,0.14)" }}
            >
              <RequestVerification status={tutor.verificationStatus} completionPct={c.pct} />

              <div>
                <div className="text-[13px] font-semibold text-slate-900 mb-1.5">Profile visibility</div>
                <div className="flex gap-2">
                  {[
                    { value: "public", label: "Public", icon: "globe" },
                    { value: "hidden", label: "Hidden", icon: "eye" },
                  ].map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => set({ visibility: o.value })}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[13px] font-medium transition-colors"
                      style={{
                        background: tutor.visibility === o.value ? "var(--ink)" : "var(--bg-soft)",
                        color: tutor.visibility === o.value ? "#fff" : "var(--ink)",
                        borderRadius: 10,
                        border: `1px solid ${tutor.visibility === o.value ? "var(--ink)" : "transparent"}`,
                      }}
                    >
                      <Icon name={o.icon} size={13} /> {o.label}
                    </button>
                  ))}
                </div>
                <div className="text-[12px] text-slate-500 mt-1.5">
                  {isPublic ? "Listed on browse and visible to everyone." : "Your profile is offline — only you can see it."}
                </div>
              </div>

              <div>
                <div className="text-[13px] font-semibold text-slate-900 mb-2">Profile completion</div>
                <ul className="space-y-2">
                  {c.checks.map((ch) => (
                    <li key={ch.key} className="flex items-center gap-2 text-[13px]">
                      <span className="inline-flex items-center justify-center shrink-0"
                        style={{ width: 16, height: 16, borderRadius: "50%", background: ch.ok ? "var(--accent)" : "var(--desk)", color: ch.ok ? "#fff" : "var(--sage)" }}>
                        {ch.ok ? <Icon name="check" size={10} strokeWidth={3} /> : <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--sage)" }} />}
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
              </div>

              <div>
                <div className="text-[13px] font-semibold text-slate-900 mb-1.5">Public profile link</div>
                <button
                  type="button"
                  onClick={copyLink}
                  title={copied ? "Copied!" : "Click to copy"}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-slate-100"
                  style={{ background: "var(--bg-soft)", borderRadius: 10 }}
                >
                  <Icon name={copied ? "check" : "globe"} size={14} className={(copied ? "text-emerald-500" : "text-slate-400") + " shrink-0"} />
                  <code className="text-[12.5px] text-slate-700 truncate flex-1 min-w-0">{publicHref}</code>
                  <span className={"text-[11px] font-medium shrink-0 " + (copied ? "text-emerald-600" : "text-slate-400")}>{copied ? "Copied" : "Copy"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
