"use client";

import { useMemo, useRef, useState, Fragment } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Avatar, VerifiedTick, OnlineDot, Chip, Button } from "@/components/ui";

/* ============================================================
   Tutor dashboard sections — ported from the claude.ai/design
   bundle (62iWgxnY32ZnT0_dN7rKWQ). The visual language matches
   /tutor/[id]/page.js. The state shape mirrors lib/data.js.
   ============================================================ */

export const AVATAR_SWATCHES = [
  "oklch(0.92 0.04 80)", "oklch(0.9 0.06 30)", "oklch(0.88 0.07 140)", "oklch(0.9 0.05 220)",
  "oklch(0.88 0.06 280)", "oklch(0.91 0.05 340)", "oklch(0.93 0.03 110)", "oklch(0.86 0.04 50)",
];

export const LANGUAGE_SUGGESTIONS = [
  "English", "Vietnamese", "Mandarin", "Cantonese", "Korean", "Japanese",
  "Spanish", "French", "Hindi", "Arabic",
];

export const RESPONSE_OPTIONS = [
  "Usually responds in <1 hr",
  "Usually responds in <4 hrs",
  "Usually responds within a day",
  "Usually responds within 2 days",
];

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const HOUR_LABELS = ["9 am", "10 am", "11 am", "12 pm", "2 pm", "4 pm", "6 pm", "8 pm"];

export function buildInitialAvailability() {
  return Array.from({ length: 8 }, () => Array(7).fill(0));
}

/* ============================================================
   Form primitives
   ============================================================ */

function Field({ label, hint, error, children, optional, full = true }) {
  return (
    <label className={"block " + (full ? "w-full" : "")}>
      {label && (
        <div className="text-[11.5px] text-slate-500 uppercase tracking-wider font-medium mb-1.5 flex items-center gap-2">
          <span>{label}</span>
          {optional && <span className="text-slate-400 normal-case tracking-normal text-[11px]">Optional</span>}
        </div>
      )}
      {children}
      {(hint || error) && (
        <div className={"text-[12px] mt-1.5 " + (error ? "text-rose-600" : "text-slate-500")}>{error || hint}</div>
      )}
    </label>
  );
}

function TextInput({ value, onChange, placeholder, type = "text", inputMode, prefix, suffix, multiline, rows = 4, maxLength }) {
  const [focus, setFocus] = useState(false);
  const Tag = multiline ? "textarea" : "input";
  return (
    <div
      className="flex items-stretch"
      style={{
        background: "#FAFAFA",
        borderRadius: 10,
        border: `1px solid ${focus ? "#0F172A" : "transparent"}`,
        transition: "border-color 120ms ease",
      }}
    >
      {prefix && <span className="flex items-center pl-3 pr-1 text-[14px] text-slate-500 tabular-nums">{prefix}</span>}
      <Tag
        type={multiline ? undefined : type}
        inputMode={inputMode}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        placeholder={placeholder}
        rows={multiline ? rows : undefined}
        maxLength={maxLength}
        className="w-full bg-transparent outline-none text-[14.5px] text-slate-900 placeholder:text-slate-400"
        style={{
          padding: multiline ? "10px 12px" : "9px 12px",
          paddingLeft: prefix ? 4 : undefined,
          paddingRight: suffix ? 4 : undefined,
          resize: multiline ? "vertical" : "none",
          lineHeight: multiline ? 1.55 : 1.3,
          fontFamily: "inherit",
          letterSpacing: "-0.003em",
        }}
      />
      {suffix && <span className="flex items-center pl-1 pr-3 text-[14px] text-slate-500 tabular-nums">{suffix}</span>}
    </div>
  );
}

function Select({ value, onChange, options }) {
  const [focus, setFocus] = useState(false);
  return (
    <div
      className="relative"
      style={{
        background: "#FAFAFA",
        borderRadius: 10,
        border: `1px solid ${focus ? "#0F172A" : "transparent"}`,
        transition: "border-color 120ms ease",
      }}
    >
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        className="w-full bg-transparent outline-none text-[14.5px] text-slate-900 appearance-none"
        style={{ padding: "9px 36px 9px 12px", fontFamily: "inherit", letterSpacing: "-0.003em" }}
      >
        {options.map((o) => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
      </select>
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
        <Icon name="chevron-down" size={14} />
      </span>
    </div>
  );
}

function Toggle({ value, onChange, label, hint }) {
  return (
    <button type="button" onClick={() => onChange(!value)} className="flex items-start gap-3 w-full text-left py-1">
      <span className="relative inline-block shrink-0 mt-0.5"
        style={{ width: 36, height: 22, borderRadius: 999, background: value ? "#0F172A" : "#E5E7EB", transition: "background 140ms ease" }}>
        <span className="absolute top-0.5 inline-block bg-white"
          style={{ width: 18, height: 18, borderRadius: "50%", left: value ? 16 : 2, transition: "left 140ms ease", boxShadow: "0 1px 2px rgba(0,0,0,0.15)" }} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-medium text-slate-900">{label}</span>
        {hint && <span className="block text-[12.5px] text-slate-500 mt-0.5">{hint}</span>}
      </span>
    </button>
  );
}

function Card({ children, padding = 24, className = "" }) {
  return (
    <section className={"bg-white " + className} style={{ border: "1px solid #E5E7EB", borderRadius: 16, padding }}>
      {children}
    </section>
  );
}

function SectionHeader({ title, subtitle, right, icon }) {
  return (
    <header className="flex items-start justify-between gap-4 mb-5">
      <div className="min-w-0">
        <h2 className="text-[18px] font-semibold text-slate-900 tracking-tight flex items-center gap-2">
          {icon && <span className="text-slate-400"><Icon name={icon} size={16} /></span>}{title}
        </h2>
        {subtitle && <p className="text-[13px] text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </header>
  );
}

function MetaLabel({ children }) {
  return <div className="text-[11.5px] text-slate-500 uppercase tracking-wider font-medium">{children}</div>;
}

function move(arr, from, to) {
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function ReorderRow({ index, count, onMove, onRemove, children }) {
  return (
    <div className="group relative flex items-stretch gap-3 py-3" style={{ borderTop: index === 0 ? "none" : "1px solid #F1F5F9" }}>
      <div className="flex flex-col items-center justify-center pt-2 text-slate-300 select-none">
        <button type="button" onClick={() => onMove(Math.max(0, index - 1))} disabled={index === 0} className="hover:text-slate-700 disabled:opacity-30" aria-label="Move up"><Icon name="chevron-up" size={14} /></button>
        <span className="text-slate-300 my-0.5"><Icon name="grip" size={14} /></span>
        <button type="button" onClick={() => onMove(Math.min(count - 1, index + 1))} disabled={index === count - 1} className="hover:text-slate-700 disabled:opacity-30" aria-label="Move down"><Icon name="chevron-down" size={14} /></button>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
      <button type="button" onClick={onRemove} className="self-start mt-2 text-slate-400 hover:text-rose-600 transition-colors" aria-label="Remove" title="Remove">
        <Icon name="trash" size={15} />
      </button>
    </div>
  );
}

function TagInput({ values, onChange, suggestions = [], placeholder = "Add" }) {
  const [draft, setDraft] = useState("");
  const [focus, setFocus] = useState(false);
  const ref = useRef(null);
  const add = (v) => {
    const t = (v || "").trim();
    if (!t || values.includes(t)) return;
    onChange([...values, t]);
    setDraft("");
  };
  const remaining = suggestions
    .filter((s) => !values.includes(s) && (!draft || s.toLowerCase().includes(draft.toLowerCase())))
    .slice(0, 6);
  return (
    <div>
      <div
        className="flex flex-wrap items-center gap-1.5"
        onClick={() => ref.current?.focus()}
        style={{
          background: "#FAFAFA",
          borderRadius: 10,
          border: `1px solid ${focus ? "#0F172A" : "transparent"}`,
          padding: "7px 9px",
          minHeight: 40,
          cursor: "text",
          transition: "border-color 120ms ease",
        }}
      >
        {values.map((v) => (
          <Chip key={v} tone="grey" onRemove={() => onChange(values.filter((x) => x !== v))}>{v}</Chip>
        ))}
        <input
          ref={ref}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(draft); }
            else if (e.key === "Backspace" && !draft && values.length) onChange(values.slice(0, -1));
          }}
          placeholder={values.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[100px] bg-transparent outline-none text-[14px] text-slate-900 placeholder:text-slate-400"
          style={{ padding: "2px 4px" }}
        />
      </div>
      {focus && remaining.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {remaining.map((s) => (
            <button
              type="button"
              key={s}
              onMouseDown={(e) => { e.preventDefault(); add(s); }}
              className="text-[12px] text-slate-500 hover:text-slate-900 px-2 py-1 rounded-full"
              style={{ background: "#F8FAFC", border: "1px solid #F1F5F9" }}
            >+ {s}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Sections
   ============================================================ */

export function BannerAvatarSection({ tutor, set }) {
  return (
    <Card>
      <SectionHeader title="Banner & avatar" subtitle="The colour band, your initial and badges visible at the top of your profile." />
      <div className="flex items-stretch gap-5">
        <div className="relative shrink-0 overflow-hidden" style={{ width: 220, height: 96, background: tutor.avatarBg, opacity: 0.85, border: "1px solid #E5E7EB", borderRadius: 12 }}>
          <div className="absolute left-4 -bottom-6"><Avatar tutor={tutor} size={64} ring /></div>
        </div>
        <div className="flex-1 min-w-0">
          <MetaLabel>Banner colour</MetaLabel>
          <div className="flex flex-wrap gap-2 mt-2">
            {AVATAR_SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => set({ avatarBg: c })}
                style={{ width: 32, height: 32, borderRadius: 999, background: c, border: `2px solid ${tutor.avatarBg === c ? "#0F172A" : "transparent"}`, boxShadow: "inset 0 0 0 1px #E5E7EB" }}
                aria-label="Pick swatch"
              />
            ))}
          </div>
          <div className="mt-4">
            <MetaLabel>Avatar image</MetaLabel>
            <div className="flex items-center gap-2 mt-2">
              <Button
                variant="outline"
                size="sm"
                icon="upload"
                disabled
                onClick={() => {}}
              >
                Upload photo
              </Button>
              <span className="text-[12px] text-slate-400" title="File upload lands in a later slice">Coming soon</span>
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-7 pt-5" style={{ borderTop: "1px solid #F1F5F9" }}>
        <Toggle value={tutor.verified} onChange={(v) => set({ verified: v })} label="Show verified tick" hint="Visible only once your government ID is approved." />
        <Toggle value={tutor.online} onChange={(v) => set({ online: v })} label="Show as online now" hint="Auto-cleared after 20 min of inactivity." />
        <Toggle value={tutor.deliversInPerson} onChange={(v) => set({ deliversInPerson: v })} label="Accepts in-person lessons" hint="Inside the service area you set below." />
        <Toggle value={tutor.deliversOnline} onChange={(v) => set({ deliversOnline: v })} label="Accepts online lessons" hint="Over Zoom or Google Meet." />
      </div>
      <div className="mt-6">
        <Field label="Response time">
          <Select value={tutor.responsiveText} onChange={(v) => set({ responsiveText: v })} options={RESPONSE_OPTIONS} />
        </Field>
      </div>
    </Card>
  );
}

export function IdentitySection({ tutor, set }) {
  return (
    <Card>
      <SectionHeader title="Identity" subtitle="Shown directly under your avatar on the public profile." />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Full name" hint="Use the name that matches your government ID."><TextInput value={tutor.name} onChange={(v) => set({ name: v, initial: (v || " ").charAt(0).toUpperCase() })} placeholder="Amelia Tran" /></Field>
        <Field label="Headline" hint="One-line role — appears as the subtitle."><TextInput value={tutor.role} onChange={(v) => set({ role: v })} placeholder="ATAR 99.85 · UNSW Med" /></Field>
        <Field label="Suburb"><TextInput value={tutor.suburb} onChange={(v) => set({ suburb: v })} placeholder="Chatswood" /></Field>
        <Field label="City"><TextInput value={tutor.city} onChange={(v) => set({ city: v })} placeholder="Sydney, NSW" /></Field>
        <Field label="Location override" optional hint="Replaces 'Suburb · City' on cards. Use sparingly.">
          <TextInput value={tutor.locationOverride} onChange={(v) => set({ locationOverride: v })} placeholder="Greater Sydney" />
        </Field>
        <Field label="Years tutoring">
          <TextInput type="number" inputMode="numeric" value={tutor.yearsTutoring} onChange={(v) => set({ yearsTutoring: Number(v) || 0 })} suffix="yrs" />
        </Field>
      </div>
      <div className="mt-4">
        <Field label="Languages spoken">
          <TagInput values={tutor.languages} onChange={(v) => set({ languages: v })} suggestions={LANGUAGE_SUGGESTIONS} placeholder="Add a language" />
        </Field>
      </div>
    </Card>
  );
}

export function CredentialsSection({ tutor, set }) {
  const list = tutor.credentials || [];
  const update = (i, p) => set({ credentials: list.map((c, idx) => idx === i ? { ...c, ...p } : c) });
  const remove = (i) => set({ credentials: list.filter((_, idx) => idx !== i) });
  const moveTo = (i, to) => set({ credentials: move(list, i, to) });
  const add = () => set({ credentials: [...list, { label: "", icon: "trophy" }] });
  return (
    <Card>
      <SectionHeader title="Credentials" subtitle="Small chips next to your headline. 2–4 works best."
        right={<Button variant="outline" size="sm" icon="plus" onClick={add}>Add credential</Button>} />
      {list.length === 0 && <div className="text-[13.5px] text-slate-500 py-6 text-center" style={{ background: "#FAFAFA", borderRadius: 10 }}>No credentials yet — add an award, a degree, or a rank.</div>}
      <div>
        {list.map((c, i) => (
          <ReorderRow key={i} index={i} count={list.length} onMove={(to) => moveTo(i, to)} onRemove={() => remove(i)}>
            <div className="grid grid-cols-[110px_1fr] gap-2">
              <Select value={c.icon} onChange={(v) => update(i, { icon: v })} options={[
                { value: "trophy", label: "Award" },
                { value: "graduation", label: "Degree" },
                { value: "shield-check", label: "Check" },
                { value: "star", label: "Highlight" },
              ]} />
              <TextInput value={c.label} onChange={(v) => update(i, { label: v })} placeholder="All-Round Achiever 2021" />
            </div>
          </ReorderRow>
        ))}
      </div>
      {list.length > 0 && (
        <div className="mt-5 pt-5" style={{ borderTop: "1px solid #F1F5F9" }}>
          <MetaLabel>Preview</MetaLabel>
          <div className="flex flex-wrap gap-1.5 mt-2">{list.map((c, i) => c.label && <Chip key={i} tone="cream" icon={c.icon}>{c.label}</Chip>)}</div>
        </div>
      )}
    </Card>
  );
}

export function AboutSection({ tutor, set }) {
  const long = tutor.bioLong || "";
  const SOFT_LIMIT = 600;
  const over = long.length > SOFT_LIMIT;
  return (
    <Card>
      <SectionHeader title="About" subtitle="The story students read on your profile." />
      <Field label="Card bio" hint="Two sentences shown on browse cards and search previews.">
        <TextInput multiline rows={2} value={tutor.bio} onChange={(v) => set({ bio: v })} maxLength={180} placeholder="Patient, structured tutor who writes clear notes…" />
      </Field>
      <div className="mt-5">
        <Field label="Long bio"
          error={over ? `${long.length - SOFT_LIMIT} characters over the soft limit — consider trimming.` : null}
          hint={!over ? `${long.length} / ${SOFT_LIMIT} characters` : null}>
          <TextInput multiline rows={8} value={long} onChange={(v) => set({ bioLong: v })}
            placeholder="Tell students about your teaching approach…" />
        </Field>
      </div>
    </Card>
  );
}

function ReadOnlyStat({ label, value }) {
  return (
    <div className="px-4 py-3 flex items-center justify-between" style={{ background: "#F8FAFC", border: "1px solid #F1F5F9", borderRadius: 10 }}>
      <div>
        <div className="text-[11.5px] text-slate-500 uppercase tracking-wider font-medium">{label}</div>
        <div className="text-[18px] font-semibold text-slate-900 tabular-nums mt-0.5">{value}</div>
      </div>
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider"
        title="Auto-calculated from completed lessons. Cannot be edited."
        style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 999, color: "#64748B" }}
      >
        <Icon name="lock" size={10} /> Auto
      </span>
    </div>
  );
}

export function StatsSection({ tutor, set }) {
  return (
    <Card>
      <SectionHeader title="Stats" subtitle="Top-of-profile numbers. Rating and reviews are system-managed." />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="ATAR" hint="Two decimal places."><TextInput type="number" inputMode="decimal" value={tutor.atar} onChange={(v) => set({ atar: Number(v) || 0 })} /></Field>
        <Field label="Rank"><TextInput value={tutor.rank} onChange={(v) => set({ rank: v })} placeholder="State / 1st / Top 10" /></Field>
        <Field label="Rank subject"><TextInput value={tutor.rankSubject} onChange={(v) => set({ rankSubject: v })} placeholder="Chemistry, 2021" /></Field>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-5" style={{ borderTop: "1px solid #F1F5F9" }}>
        <ReadOnlyStat label="Rating" value={tutor.rating != null ? Number(tutor.rating).toFixed(2) : "—"} />
        <ReadOnlyStat label="Reviews" value={tutor.reviews != null ? tutor.reviews.toString() : "—"} />
      </div>
    </Card>
  );
}

export function RateSection({ tutor, set }) {
  const list = tutor.packages || [];
  const update = (i, p) => set({ packages: list.map((x, idx) => idx === i ? { ...x, ...p } : x) });
  const remove = (i) => set({ packages: list.filter((_, idx) => idx !== i) });
  const moveTo = (i, to) => set({ packages: move(list, i, to) });
  const add = () => set({ packages: [...list, { label: "", duration: "60 min", save: 0, price: tutor.rate || 0 }] });
  return (
    <Card>
      <SectionHeader title="Rate & packages" subtitle="Base rate and the bundles students can buy."
        right={<Button variant="outline" size="sm" icon="plus" onClick={add}>Add package</Button>} />
      <Field label="Hourly rate">
        <div className="max-w-[200px]">
          <TextInput type="number" inputMode="numeric" value={tutor.rate} onChange={(v) => set({ rate: Number(v) || 0 })} prefix="$" suffix="/ hr" />
        </div>
      </Field>
      <div className="mt-5">
        <MetaLabel>Packages</MetaLabel>
        <div className="mt-2">
          {list.map((p, i) => (
            <ReorderRow key={i} index={i} count={list.length} onMove={(to) => moveTo(i, to)} onRemove={() => remove(i)}>
              <div className="grid grid-cols-[1.4fr_1fr_0.7fr_0.9fr] gap-2">
                <TextInput value={p.label} onChange={(v) => update(i, { label: v })} placeholder="5-lesson pack" />
                <TextInput value={p.duration} onChange={(v) => update(i, { duration: v })} placeholder="60 min × 5" />
                <TextInput type="number" inputMode="numeric" value={p.save} onChange={(v) => update(i, { save: Number(v) || 0 })} suffix="%" />
                <TextInput type="number" inputMode="numeric" value={p.price} onChange={(v) => update(i, { price: Number(v) || 0 })} prefix="$" />
              </div>
            </ReorderRow>
          ))}
        </div>
      </div>
    </Card>
  );
}

export function ExperienceSection({ tutor, set }) {
  const list = tutor.experience || [];
  const update = (i, p) => set({ experience: list.map((x, idx) => idx === i ? { ...x, ...p } : x) });
  const remove = (i) => set({ experience: list.filter((_, idx) => idx !== i) });
  const moveTo = (i, to) => set({ experience: move(list, i, to) });
  const add = () => set({ experience: [...list, { role: "", org: "", period: "", note: "" }] });
  return (
    <Card>
      <SectionHeader title="Experience" subtitle="Renders as the briefcase timeline on your profile."
        right={<Button variant="outline" size="sm" icon="plus" onClick={add}>Add role</Button>} />
      <div>
        {list.map((e, i) => (
          <ReorderRow key={i} index={i} count={list.length} onMove={(to) => moveTo(i, to)} onRemove={() => remove(i)}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <TextInput value={e.role} onChange={(v) => update(i, { role: v })} placeholder="Private tutor" />
              <TextInput value={e.org} onChange={(v) => update(i, { org: v })} placeholder="Self-employed" />
              <TextInput value={e.period} onChange={(v) => update(i, { period: v })} placeholder="2022 — present" />
            </div>
            <div className="mt-2">
              <TextInput value={e.note} onChange={(v) => update(i, { note: v })} placeholder="One line describing what you did here." />
            </div>
          </ReorderRow>
        ))}
      </div>
    </Card>
  );
}

export function EducationSection({ tutor, set }) {
  const list = tutor.education || [];
  const update = (i, p) => set({ education: list.map((x, idx) => idx === i ? { ...x, ...p } : x) });
  const remove = (i) => set({ education: list.filter((_, idx) => idx !== i) });
  const moveTo = (i, to) => set({ education: move(list, i, to) });
  const add = () => set({ education: [...list, { school: "", detail: "" }] });
  return (
    <Card>
      <SectionHeader title="Education" right={<Button variant="outline" size="sm" icon="plus" onClick={add}>Add school</Button>} />
      <div>
        {list.map((e, i) => (
          <ReorderRow key={i} index={i} count={list.length} onMove={(to) => moveTo(i, to)} onRemove={() => remove(i)}>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1.4fr] gap-2">
              <TextInput value={e.school} onChange={(v) => update(i, { school: v })} placeholder="UNSW Sydney" />
              <TextInput value={e.detail} onChange={(v) => update(i, { detail: v })} placeholder="B. Medical Studies — Year 3" />
            </div>
          </ReorderRow>
        ))}
      </div>
    </Card>
  );
}

export function SubjectsSection({ tutor, set, suggestions }) {
  return (
    <Card>
      <SectionHeader title="Subjects" subtitle="Powers your placement in browse filters. Pick from the seeded list — other names won't be saved." />
      <TagInput values={tutor.subjects} onChange={(v) => set({ subjects: v })} suggestions={suggestions} placeholder="Add a subject" />
    </Card>
  );
}

function ServiceMap({ radiusKm }) {
  const radius = 18 + (Math.min(500, Math.max(1, radiusKm)) / 500) * 68;
  return (
    <div style={{ background: "#F8FAFC", border: "1px solid #F1F5F9", borderRadius: 12, overflow: "hidden", height: 200 }} className="relative">
      <svg viewBox="0 0 280 200" width="100%" height="100%">
        <defs>
          <pattern id="grid-bg" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#E5E7EB" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="280" height="200" fill="url(#grid-bg)" />
        <path d="M 0 130 C 80 120 160 150 280 110" stroke="#E5E7EB" strokeWidth="6" fill="none"/>
        <path d="M 60 0 C 80 60 120 110 100 200" stroke="#E5E7EB" strokeWidth="4" fill="none"/>
        <path d="M 200 0 L 180 200" stroke="#E5E7EB" strokeWidth="3" fill="none"/>
        <circle cx="140" cy="100" r={radius} fill="#0F172A" fillOpacity="0.06" stroke="#0F172A" strokeWidth="1.25" strokeDasharray="4 4"/>
        <circle cx="140" cy="100" r="4" fill="#0F172A"/>
        <circle cx="140" cy="100" r="9" fill="none" stroke="#0F172A" strokeWidth="1.25" opacity="0.4"/>
      </svg>
      <div className="absolute top-2.5 left-3 text-[11px] font-medium uppercase tracking-wider text-slate-500">{radiusKm} km radius</div>
    </div>
  );
}

export function ServiceAreaSection({ tutor, set }) {
  const sa = tutor.serviceArea || { suburb: "", radiusKm: 5 };
  const r = sa.radiusKm;
  return (
    <Card>
      <SectionHeader title="Service area" subtitle="Where you'll travel for in-person lessons." />
      <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-5">
        <div>
          <Field label="Base suburb"><TextInput value={sa.suburb} onChange={(v) => set({ serviceArea: { ...sa, suburb: v } })} placeholder="Chatswood" /></Field>
          <div className="mt-4">
            <Field label="Travel radius" hint={`In-person lessons within ${r} km of ${sa.suburb || "your base"}.`}>
              <div className="flex items-center gap-3">
                <input type="range" min={1} max={500} step={1} value={r}
                  onChange={(e) => set({ serviceArea: { ...sa, radiusKm: Number(e.target.value) } })} className="flex-1" />
                <span className="text-[14px] tabular-nums font-medium text-slate-900 w-14 text-right">{r} km</span>
              </div>
            </Field>
          </div>
        </div>
        <ServiceMap radiusKm={r} />
      </div>
    </Card>
  );
}

export function AvailabilitySection({ tutor, set }) {
  const grid = tutor.availability || [];
  const cycle = (r, c) => set({ availability: grid.map((row, ri) => row.map((cell, ci) => ri === r && ci === c ? (cell + 1) % 3 : cell)) });
  const bulkFreeEvenings = () => set({ availability: grid.map((row, ri) => row.map((cell, ci) => (ri >= 5 && ri <= 7 && ci <= 4 && cell === 0) ? 1 : cell)) });
  const clearAll = () => set({ availability: grid.map((row) => row.map(() => 0)) });
  return (
    <Card padding={20}>
      <SectionHeader title="Availability" subtitle="Click a cell to cycle: empty → free → booked → empty."
        right={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" icon="sparkle" onClick={bulkFreeEvenings} title="Mark weekday evenings free">Mark weekday evenings free</Button>
            <Button variant="ghost" size="sm" onClick={clearAll}>Clear all</Button>
          </div>
        } />
      <div className="overflow-x-auto" style={{ marginInline: -4 }}>
        <div className="min-w-[520px] px-1">
          <div className="grid" style={{ gridTemplateColumns: "56px repeat(7, 1fr)", gap: 4 }}>
            <div></div>
            {DAYS.map((d) => <div key={d} className="text-[11.5px] text-slate-500 uppercase tracking-wider font-medium text-center pb-1">{d}</div>)}
            {HOUR_LABELS.map((h, r) => (
              <Fragment key={h}>
                <div className="text-[11px] text-slate-400 tabular-nums flex items-center pr-1 justify-end">{h}</div>
                {DAYS.map((_, c) => {
                  const v = grid[r]?.[c] ?? 0;
                  const styles = [
                    { bg: "#F8FAFC", border: "#F1F5F9", color: "transparent", label: "" },
                    { bg: "#ECFDF5", border: "#A7F3D0", color: "#047857", label: "Free" },
                    { bg: "#FEF3C7", border: "#FCD34D", color: "#92400E", label: "Booked" },
                  ];
                  const s = styles[v];
                  return (
                    <button key={c} type="button" onClick={() => cycle(r, c)} className="text-[10.5px] font-medium transition-colors"
                      style={{ height: 32, borderRadius: 6, background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>{s.label}</button>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4 mt-4 text-[12.5px] text-slate-500">
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-[3px]" style={{ background: "#F8FAFC", border: "1px solid #F1F5F9" }}/> unavailable</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-[3px]" style={{ background: "#ECFDF5", border: "1px solid #A7F3D0" }}/> free</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-[3px]" style={{ background: "#FEF3C7", border: "1px solid #FCD34D" }}/> booked</span>
      </div>
    </Card>
  );
}

export function VerificationsSection({ tutor, set }) {
  const list = tutor.verifications || [];
  const done = list.filter((v) => v.done).length;
  return (
    <Card>
      <SectionHeader title="Verifications" subtitle="Verified profiles get the green tick and rank higher in search."
        right={<span className="text-[12.5px] text-slate-500 tabular-nums">{done} / {list.length} complete</span>} />
      {list.length === 0 && <div className="text-[13.5px] text-slate-500 py-6 text-center" style={{ background: "#FAFAFA", borderRadius: 10 }}>Verification steps will appear here once we launch the verification flow.</div>}
      <ul className="-my-1">
        {list.map((v, i) => (
          <li key={v.label} className="flex items-center gap-3 py-3" style={{ borderTop: i === 0 ? "none" : "1px solid #F1F5F9" }}>
            <span className="inline-flex items-center justify-center"
              style={{ width: 32, height: 32, borderRadius: "50%", background: v.done ? "#ECFDF5" : "#F3F4F6", color: v.done ? "#047857" : "#94A3B8" }}>
              {v.done ? <Icon name="check" size={16} strokeWidth={2.5} /> : <Icon name="shield" size={15} />}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-medium text-slate-900 flex items-center gap-1.5">{v.label}{v.done && <VerifiedTick size={12} />}</div>
              <div className="text-[12.5px] text-slate-500 mt-0.5">{v.done ? "Verified — visible on your public profile." : "Not yet started."}</div>
            </div>
            {v.done
              ? <Button variant="ghost" size="sm" onClick={() => set({ verifications: list.map((x, idx) => idx === i ? { ...x, done: false } : x) })}>Revoke</Button>
              : <Button variant="outline" size="sm" iconRight="arrow-right" onClick={() => set({ verifications: list.map((x, idx) => idx === i ? { ...x, done: true } : x) })}>Start verification</Button>}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ============================================================
   Sidebar (completion meter, visibility, public link, mini preview)
   ============================================================ */

export function calcCompletion(t) {
  const checks = [
    { key: "Avatar uploaded", ok: !!t.avatarImg },
    { key: "Name & headline",  ok: !!t.name && !!t.role },
    { key: "Location",         ok: !!t.suburb && !!t.city },
    { key: "Languages",        ok: (t.languages || []).length > 0 },
    { key: "Credentials",      ok: (t.credentials || []).filter((c) => c.label).length >= 2 },
    { key: "Long bio (300+)",  ok: (t.bioLong || "").length >= 300 },
    { key: "Subjects (3+)",    ok: (t.subjects || []).length >= 3 },
    { key: "Rate set",         ok: !!t.rate && t.rate > 0 },
    { key: "1+ package",       ok: (t.packages || []).filter((p) => p.price).length >= 1 },
    { key: "Experience",       ok: (t.experience || []).filter((e) => e.role).length >= 1 },
    { key: "Education",        ok: (t.education || []).filter((e) => e.school).length >= 1 },
    { key: "Availability set", ok: (t.availability || []).some((row) => row.some((c) => c === 1)) },
    { key: "Service area",     ok: !!t.serviceArea?.suburb },
    { key: "ID verified",      ok: (t.verifications || []).find((v) => v.label.toLowerCase().includes("id"))?.done === true },
  ];
  const done = checks.filter((c) => c.ok).length;
  return { checks, done, total: checks.length, pct: Math.round((done / checks.length) * 100) };
}

function MiniPreview({ tutor }) {
  const display = { ...tutor, initial: (tutor.name || " ").trim().charAt(0).toUpperCase() || tutor.initial };
  return (
    <div className="bg-white overflow-hidden" style={{ border: "1px solid #E5E7EB", borderRadius: 14 }}>
      <div style={{ height: 56, background: tutor.avatarBg, opacity: 0.85 }} />
      <div className="px-4 pb-4">
        <div style={{ marginTop: -28, marginBottom: 10 }}><Avatar tutor={display} size={56} ring /></div>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[15px] font-semibold text-slate-900 truncate" style={{ letterSpacing: "-0.01em" }}>{tutor.name || "Your name"}</span>
          {tutor.verified && <VerifiedTick size={13} />}
          {tutor.online && <OnlineDot size={7} />}
        </div>
        <div className="text-[12.5px] text-slate-500 mt-0.5 truncate">{tutor.role || "Your headline"}</div>
        <div className="text-[11.5px] text-slate-400 mt-0.5 flex items-center gap-1">
          <Icon name="map-pin" size={10} />{tutor.locationOverride || `${tutor.suburb || "Suburb"} · ${tutor.city || "City"}`}
        </div>
        <div className="flex flex-wrap gap-1 mt-3">
          {(tutor.subjects || []).slice(0, 3).map((s) => <Chip key={s}>{s}</Chip>)}
          {(tutor.subjects || []).length > 3 && <Chip tone="line">+{tutor.subjects.length - 3}</Chip>}
        </div>
        <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: "1px solid #F1F5F9" }}>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium text-[11.5px] tabular-nums">{(Number(tutor.atar) || 0).toFixed(2)} ATAR</span>
          <div>
            <span className="text-[14px] font-semibold text-slate-900 tabular-nums">${tutor.rate || 0}</span>
            <span className="text-[11.5px] text-slate-400">/hr</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Sidebar({ tutor, set, onPreview, publicHref }) {
  const c = useMemo(() => calcCompletion(tutor), [tutor]);
  const visOptions = [
    { value: "public",   label: "Public", hint: "Visible to everyone." },
    { value: "unlisted", label: "Unlisted", hint: "Hidden from browse — link only." },
    { value: "hidden",   label: "Hidden", hint: "Profile is offline." },
  ];
  return (
    <aside className="space-y-5">
      <Card padding={20}>
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="text-[14px] font-semibold text-slate-900 tracking-tight">Profile completion</h3>
          <span className="text-[18px] font-semibold text-slate-900 tabular-nums tracking-tight">{c.pct}%</span>
        </div>
        <div style={{ height: 6, background: "#F1F5F9", borderRadius: 999, overflow: "hidden" }}>
          <div style={{ width: `${c.pct}%`, height: "100%", background: c.pct >= 80 ? "#10B981" : "#0F172A", transition: "width 220ms ease" }} />
        </div>
        <ul className="mt-4 space-y-2">
          {c.checks.map((ch) => (
            <li key={ch.key} className="flex items-center gap-2 text-[13px]">
              <span className="inline-flex items-center justify-center shrink-0"
                style={{ width: 16, height: 16, borderRadius: "50%", background: ch.ok ? "#10B981" : "#F1F5F9", color: ch.ok ? "#fff" : "#94A3B8" }}>
                {ch.ok ? <Icon name="check" size={10} strokeWidth={3} /> : <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#94A3B8" }} />}
              </span>
              <span className={ch.ok ? "text-slate-600 line-through decoration-slate-300" : "text-slate-700"}>{ch.key}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card padding={20}>
        <h3 className="text-[14px] font-semibold text-slate-900 tracking-tight mb-3">Profile visibility</h3>
        <div className="space-y-1.5">
          {visOptions.map((o) => (
            <button key={o.value} type="button" onClick={() => set({ visibility: o.value })}
              className="w-full text-left flex items-start gap-3 px-3 py-2.5 transition-colors"
              style={{ background: tutor.visibility === o.value ? "#0F172A" : "#FAFAFA", color: tutor.visibility === o.value ? "#fff" : "#0F172A", borderRadius: 10, border: `1px solid ${tutor.visibility === o.value ? "#0F172A" : "transparent"}` }}>
              <span className="inline-flex items-center justify-center shrink-0 mt-0.5"
                style={{ width: 16, height: 16, borderRadius: "50%", border: `1.5px solid ${tutor.visibility === o.value ? "#fff" : "#CBD5E1"}`, background: tutor.visibility === o.value ? "#fff" : "transparent" }}>
                {tutor.visibility === o.value && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#0F172A" }} />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[13.5px] font-medium">{o.label}</span>
                <span className={"block text-[12px] mt-0.5 " + (tutor.visibility === o.value ? "text-white/70" : "text-slate-500")}>{o.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </Card>

      <Card padding={20}>
        <h3 className="text-[14px] font-semibold text-slate-900 tracking-tight mb-3">Public profile link</h3>
        <div className="flex items-center gap-2 px-3 py-2 mb-3" style={{ background: "#FAFAFA", borderRadius: 10 }}>
          <Icon name="globe" size={14} className="text-slate-400 shrink-0" />
          <code className="text-[12.5px] text-slate-700 truncate">{publicHref}</code>
        </div>
        <Button variant="outline" size="sm" full iconRight="external" onClick={onPreview}>Open public profile</Button>
      </Card>

      <div>
        <div className="text-[11.5px] text-slate-500 uppercase tracking-wider font-medium mb-2 px-1">Live preview</div>
        <MiniPreview tutor={tutor} />
        <div className="text-[12px] text-slate-400 mt-2 px-1">Updates as you type — compact version of your public profile header.</div>
      </div>
    </aside>
  );
}

/* ============================================================
   Top bar + breadcrumb
   ============================================================ */

export function Breadcrumb() {
  return (
    <nav className="text-[12.5px] text-slate-500 flex items-center gap-1.5 py-4">
      <Link href="/" className="hover:text-slate-900">Home</Link>
      <Icon name="chevron-right" size={12} className="text-slate-300" />
      <Link href="/dashboard" className="hover:text-slate-900">Dashboard</Link>
      <Icon name="chevron-right" size={12} className="text-slate-300" />
      <span className="text-slate-900 font-medium">Edit profile</span>
    </nav>
  );
}

export function SaveBar({ tutor, dirty, saving, onSave, onDiscard, onPreview }) {
  return (
    <div className="sticky top-0 z-30 bg-white/85 backdrop-blur" style={{ borderBottom: "1px solid #E5E7EB" }}>
      <div className="max-w-[1200px] mx-auto px-6 h-[68px] flex items-center gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar tutor={tutor} size={36} />
          <div className="min-w-0">
            <div className="text-[14.5px] font-semibold text-slate-900 truncate" style={{ letterSpacing: "-0.01em" }}>{tutor.name || "Your profile"}</div>
            <div className="flex items-center gap-1.5 text-[12px] text-slate-500">
              <span className="inline-block" style={{ width: 7, height: 7, borderRadius: "50%", background: dirty ? "#F59E0B" : "#10B981", boxShadow: dirty ? "0 0 0 3px rgba(245,158,11,0.18)" : "0 0 0 3px rgba(16,185,129,0.18)" }} />
              {dirty ? "Unsaved changes" : "All changes saved"}
            </div>
          </div>
        </div>
        <div className="flex-1" />
        <div className="hidden md:flex items-center gap-2">
          <Button variant="ghost" size="sm" icon="eye" onClick={onPreview}>Preview</Button>
          <Button variant="outline" size="sm" onClick={onDiscard} disabled={!dirty || saving}>Discard</Button>
          <Button variant="primary" size="sm" onClick={onSave} disabled={!dirty || saving}>{saving ? "Saving…" : "Save changes"}</Button>
        </div>
        <div className="md:hidden">
          <Button variant="ghost" size="sm" icon="eye" onClick={onPreview}>Preview</Button>
        </div>
      </div>
    </div>
  );
}

export function MobileSaveBar({ dirty, saving, onSave, onDiscard }) {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white px-4 py-3 flex items-center gap-3" style={{ borderTop: "1px solid #E5E7EB" }}>
      <div className="flex-1 text-[13px] text-slate-600">{dirty ? "You have unsaved changes" : "All saved"}</div>
      <Button variant="ghost" size="sm" onClick={onDiscard} disabled={!dirty || saving}>Discard</Button>
      <Button variant="primary" size="sm" onClick={onSave} disabled={!dirty || saving}>{saving ? "Saving…" : "Save"}</Button>
    </div>
  );
}
