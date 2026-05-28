"use client";

import { useEffect, useMemo, useRef, useState, Fragment } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Icon } from "@/components/Icon";
import { Avatar, VerifiedTick, Chip, Button } from "@/components/ui";
import { TutorCard } from "@/components/TutorCard";
import { SuburbAutocomplete } from "@/components/SuburbAutocomplete";
import { SubjectPicker } from "@/components/SubjectPicker";
import { subjectLabel } from "@/lib/subjects";
import { YEAR_MIN, YEAR_MAX, yearLabel, yearRangeLabel } from "@/lib/yearLevels";
import { AVAILABILITY_DAYS, AVAILABILITY_HOURS } from "@/lib/availability";
import { uploadProfileImage } from "@/lib/supabase/storage";
import { ImageCropModal } from "@/components/ImageCropModal";

const ServiceMapLeaflet = dynamic(() => import("@/components/ServiceMapLeaflet"), { ssr: false });

/* ============================================================
   Tutor settings sections — ported from the claude.ai/design
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

// Canonical labels shared with the public profile (lib/availability.js) so the
// settings grid and the public AvailabilityGrid never drift apart.
export const DAYS = AVAILABILITY_DAYS;
export const HOUR_LABELS = AVAILABILITY_HOURS;

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

function ImageUploadControl({ label, value, kind, supabase, userId, onChange, hint, aspect, cropShape }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);

  const onPick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be re-picked after a remove
    if (!file) return;
    if (!supabase || !userId) { setErr("Sign in again to upload."); return; }
    if (!file.type?.startsWith("image/")) { setErr("Please choose an image file."); return; }
    setErr(null);
    setPendingFile(file);
  };

  const onCropConfirm = async (croppedFile) => {
    setPendingFile(null);
    setBusy(true);
    const res = await uploadProfileImage(supabase, userId, kind, croppedFile);
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    onChange(res.url);
  };

  return (
    <div>
      <MetaLabel>{label}</MetaLabel>
      <div className="flex items-center gap-2 mt-2">
        <input ref={inputRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
        <Button variant="outline" size="sm" icon="upload" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? "Uploading…" : value ? "Replace" : "Upload"}
        </Button>
        {value && !busy && (
          <Button variant="ghost" size="sm" onClick={() => onChange(null)}>Remove</Button>
        )}
      </div>
      {err
        ? <div className="text-[12px] text-rose-600 mt-1.5">{err}</div>
        : hint && <div className="text-[12px] text-slate-400 mt-1.5">{hint}</div>}
      <ImageCropModal
        open={!!pendingFile}
        file={pendingFile}
        aspect={aspect ?? 1}
        cropShape={cropShape ?? "rect"}
        title={`Crop ${label.toLowerCase()}`}
        onCancel={() => setPendingFile(null)}
        onConfirm={onCropConfirm}
      />
    </div>
  );
}

export function BannerAvatarSection({ tutor, set, supabase }) {
  const swatchesDisabled = !!tutor.bannerImg;
  return (
    <Card>
      <SectionHeader title="Banner & avatar" subtitle="The banner, your photo and badges visible at the top of your profile." />
      <div className="space-y-4">
        <ImageUploadControl
          label="Avatar image"
          value={tutor.avatarImg}
          kind="avatar"
          supabase={supabase}
          userId={tutor.id}
          onChange={(url) => set({ avatarImg: url })}
          hint="Square works best. Falls back to your initial when empty."
          aspect={1}
          cropShape="round"
        />
        <ImageUploadControl
          label="Banner image"
          value={tutor.bannerImg}
          kind="banner"
          supabase={supabase}
          userId={tutor.id}
          onChange={(url) => set({ bannerImg: url })}
          hint="Wide image, ~1200×320. Falls back to the colour below."
          aspect={1200 / 320}
          cropShape="rect"
        />
        <div style={{ opacity: swatchesDisabled ? 0.5 : 1 }}>
          <MetaLabel>Banner colour</MetaLabel>
          <div className="flex flex-wrap gap-2 mt-2">
            {AVATAR_SWATCHES.map((c) => {
              const selectedBanner = tutor.bannerBg ?? tutor.avatarBg;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => set({ bannerBg: c })}
                  disabled={swatchesDisabled}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 999,
                    background: c,
                    border: `2px solid ${selectedBanner === c ? "#0F172A" : "transparent"}`,
                    boxShadow: "inset 0 0 0 1px #E5E7EB",
                    cursor: swatchesDisabled ? "not-allowed" : "pointer",
                  }}
                  aria-label="Pick swatch"
                />
              );
            })}
          </div>
          {swatchesDisabled && (
            <div className="text-[12px] text-slate-400 mt-2">
              Used only when no banner image is set.
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-7 pt-5" style={{ borderTop: "1px solid #F1F5F9" }}>
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
        <Field label="Years tutoring">
          <TextInput value={tutor.yearsTutoring} onChange={(v) => set({ yearsTutoring: Number(v.replace(/\D/g, "")) || 0 })} suffix="yrs" />
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

const CREDENTIAL_TYPES = [
  { value: "atar",        label: "ATAR",       caption: "ATAR",       kind: "stat",       placeholder: "98.05" },
  { value: "trophy",      label: "Award",      caption: "AWARD",      kind: "credential", placeholder: "All-Round Achiever 2021" },
  { value: "graduation",  label: "Degree",     caption: "DEGREE",     kind: "credential", placeholder: "B. Computer Science @ CMU" },
  { value: "check-badge", label: "State rank", caption: "STATE RANK", kind: "credential", placeholder: "1st in Chemistry, 2021" },
  { value: "star",        label: "Highlight",  caption: "HIGHLIGHT",  kind: "credential", placeholder: "Top 1% nationally" },
];

function typeForIcon(icon) {
  return CREDENTIAL_TYPES.find((t) => t.value === icon) ?? { caption: "CREDENTIAL", kind: "credential", placeholder: "" };
}

export function CredentialsSection({ tutor, set }) {
  const list = tutor.credentials || [];
  const update = (i, p) => set({ credentials: list.map((c, idx) => idx === i ? { ...c, ...p } : c) });
  const remove = (i) => set({ credentials: list.filter((_, idx) => idx !== i) });
  const moveTo = (i, to) => set({ credentials: move(list, i, to) });
  const add = () => set({ credentials: [...list, { label: "", icon: "trophy" }] });

  return (
    <Card>
      <SectionHeader title="Credentials" subtitle="The ATAR, awards, degrees, or state ranks that show on your profile."
        right={<Button variant="outline" size="sm" icon="plus" onClick={add}>Add credential</Button>} />
      {list.length === 0 && <div className="text-[13.5px] text-slate-500 py-6 text-center" style={{ background: "#FAFAFA", borderRadius: 10 }}>No credentials yet — add an ATAR, award, degree, or state rank.</div>}
      <div>
        {list.map((c, i) => {
          const t = typeForIcon(c.icon);
          return (
            <ReorderRow key={i} index={i} count={list.length} onMove={(to) => moveTo(i, to)} onRemove={() => remove(i)}>
              <div className="grid grid-cols-[130px_1fr] gap-2">
                <Select value={c.icon} onChange={(v) => update(i, { icon: v })} options={CREDENTIAL_TYPES.map(({ value, label }) => ({ value, label }))} />
                <TextInput value={c.label} onChange={(v) => update(i, { label: v })} placeholder={t.placeholder} />
              </div>
            </ReorderRow>
          );
        })}
      </div>
      {list.some((c) => c.label) && (
        <div className="mt-5 pt-5" style={{ borderTop: "1px solid #F1F5F9" }}>
          <MetaLabel>Preview</MetaLabel>
          <div className="flex flex-col gap-2.5 mt-2">
            {list.map((c, i) => {
              if (!c.label) return null;
              const t = typeForIcon(c.icon);
              return (
                <div key={i} className="px-4 py-3 flex items-center gap-4" style={{ border: "1px solid #E5E7EB", borderRadius: 12, background: "#FAFAFA" }}>
                  <div className="flex items-center gap-1.5 text-[11.5px] text-slate-500 uppercase tracking-wider font-medium w-[120px] shrink-0">
                    <Icon name={c.icon} size={12} /> {t.caption}
                  </div>
                  <div className={`text-[14px] font-semibold text-slate-900 leading-snug${t.kind === "stat" ? " tabular-nums" : ""}`}>
                    {c.label}
                  </div>
                </div>
              );
            })}
          </div>
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
      <Field label="Tagline" hint="One line shown on your browse cards and under your profile header.">
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

export function RateSection({ tutor, set }) {
  const list = tutor.packages || [];
  const update = (i, p) => set({ packages: list.map((x, idx) => idx === i ? { ...x, ...p } : x) });
  const remove = (i) => set({ packages: list.filter((_, idx) => idx !== i) });
  const moveTo = (i, to) => set({ packages: move(list, i, to) });
  const add = () => set({ packages: [...list, { label: "", price: tutor.rate || 0 }] });
  return (
    <Card>
      <SectionHeader title="Rate & packages" subtitle="Base rate and the bundles students can buy."
        right={<Button variant="outline" size="sm" icon="plus" onClick={add}>Add package</Button>} />
      <Field label="Hourly rate">
        <div className="max-w-[200px]">
          <TextInput value={tutor.rate} onChange={(v) => set({ rate: Number(v.replace(/\D/g, "")) || 0 })} prefix="$" suffix="/ hr" />
        </div>
      </Field>
      <div className="mt-5">
        <MetaLabel>Packages</MetaLabel>
        <div className="mt-2">
          {list.map((p, i) => (
            <ReorderRow key={i} index={i} count={list.length} onMove={(to) => moveTo(i, to)} onRemove={() => remove(i)}>
              <div className="grid grid-cols-[1fr_140px] gap-2">
                <TextInput value={p.label} onChange={(v) => update(i, { label: v })} placeholder="5-lesson pack" />
                <TextInput value={p.price} onChange={(v) => update(i, { price: Number(v.replace(/\D/g, "")) || 0 })} prefix="$" />
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

export function SubjectsSection({ tutor, set, catalog }) {
  return (
    <Card>
      <SectionHeader title="Subjects" subtitle="Powers your placement in browse filters. Pick an exam, then choose the subjects you tutor." />
      <SubjectPicker
        catalog={catalog}
        value={tutor.subjects}
        onChange={(slugs) => set({ subjects: slugs })}
        mode="multi"
        variant="box"
        placeholder="Add subjects"
      />
    </Card>
  );
}

export function YearLevelsSection({ tutor, set }) {
  // Clamp so the range stays valid (min ≤ max) as either slider moves.
  const min = Number.isFinite(tutor.yearMin) ? tutor.yearMin : 7;
  const max = Number.isFinite(tutor.yearMax) ? tutor.yearMax : 12;
  const setMin = (v) => { const n = Number(v); set({ yearMin: n, yearMax: Math.max(n, max) }); };
  const setMax = (v) => { const n = Number(v); set({ yearMax: n, yearMin: Math.min(n, min) }); };
  return (
    <Card>
      <SectionHeader title="Year levels" subtitle="The range of year groups you'll tutor — students filter on this." />
      <Field label="Year range" hint={`You tutor ${yearRangeLabel(min, max)}.`}>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-slate-500 w-10 shrink-0">From</span>
            <input type="range" min={YEAR_MIN} max={YEAR_MAX} step={1} value={min}
              onChange={(e) => setMin(e.target.value)} className="flex-1 accent-slate-900" />
            <span className="text-[13.5px] tabular-nums font-medium text-slate-900 w-24 text-right">{yearLabel(min)}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-slate-500 w-10 shrink-0">To</span>
            <input type="range" min={YEAR_MIN} max={YEAR_MAX} step={1} value={max}
              onChange={(e) => setMax(e.target.value)} className="flex-1 accent-slate-900" />
            <span className="text-[13.5px] tabular-nums font-medium text-slate-900 w-24 text-right">{yearLabel(max)}</span>
          </div>
        </div>
      </Field>
    </Card>
  );
}

function ServiceMapPlaceholder({ radiusKm }) {
  const radius = 18 + (Math.min(50, Math.max(1, radiusKm)) / 50) * 68;
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
  const suburb = sa.suburb || "";

  // Debounced geocode: 600ms after the suburb stops changing, fetch coords
  // unless we already have coords for this exact suburb.
  useEffect(() => {
    const trimmed = suburb.trim();
    if (!trimmed) return;
    if (sa.geocodedSuburb && sa.geocodedSuburb.toLowerCase() === trimmed.toLowerCase()
        && Number.isFinite(sa.lat) && Number.isFinite(sa.lng)) {
      return;
    }
    let aborted = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`);
        if (!res.ok || aborted) return;
        const body = await res.json();
        if (aborted) return;
        if (Number.isFinite(body?.lat) && Number.isFinite(body?.lng)) {
          set({ serviceArea: { ...sa, lat: body.lat, lng: body.lng, geocodedSuburb: trimmed } });
        } else {
          set({ serviceArea: { ...sa, lat: null, lng: null, geocodedSuburb: null } });
        }
      } catch { /* leave coords as-is on transient error */ }
    }, 600);
    return () => { aborted = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suburb]);

  const hasCoords = Number.isFinite(sa.lat) && Number.isFinite(sa.lng);

  // Picking a suggestion gives us coords directly (no geocode round-trip) and
  // is the single source of truth for the tutor's location: it also mirrors
  // suburb/city onto the profile (used by cards + the public header).
  const onPick = (place) =>
    set({
      serviceArea: { ...sa, suburb: place.suburb, lat: place.lat, lng: place.lng, geocodedSuburb: place.suburb },
      suburb: place.suburb,
      city: place.state || tutor.city || "",
    });

  const onClearSuburb = () =>
    set({
      serviceArea: { ...sa, suburb: "", lat: null, lng: null, geocodedSuburb: null },
      suburb: "",
    });

  return (
    <Card>
      <SectionHeader title="Service area" subtitle="Where you'll travel for in-person lessons." />
      <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-5">
        <div>
          <Field label="Base suburb" hint="Start typing any Australian suburb and pick from the list.">
            <SuburbAutocomplete variant="box" value={sa.suburb || ""} placeholder="Chatswood" onSelect={onPick} onClear={onClearSuburb} />
          </Field>
          <div className="mt-4">
            <Field label="Travel radius" hint={`In-person lessons within ${r} km of ${sa.suburb || "your base"}.`}>
              <div className="flex items-center gap-3">
                <input type="range" min={1} max={50} step={1} value={r}
                  onChange={(e) => set({ serviceArea: { ...sa, radiusKm: Number(e.target.value) } })} className="flex-1" />
                <span className="text-[14px] tabular-nums font-medium text-slate-900 w-14 text-right">{r} km</span>
              </div>
            </Field>
          </div>
        </div>
        {hasCoords
          ? <ServiceMapLeaflet lat={sa.lat} lng={sa.lng} radiusKm={r} />
          : <ServiceMapPlaceholder radiusKm={r} />}
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

// Verification is parked for a later release. We keep the planned steps visible
// as a muted, non-interactive preview so tutors know what's coming, but nothing
// here is wired up yet (the `verifications` data stays dormant).
const PLANNED_VERIFICATIONS = [
  "Email verified",
  "Phone verified",
  "Government ID",
  "ATAR transcript",
  "University enrolment",
];

export function VerificationsSection() {
  return (
    <Card padding={20}>
      <div className="flex items-center justify-between gap-3 mb-1">
        <h3 className="text-[14px] font-semibold text-slate-900 tracking-tight">Verifications</h3>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider" style={{ background: "#FAFAFA", border: "1px solid #E5E7EB", borderRadius: 999, color: "#64748B" }}>Coming soon</span>
      </div>
      <p className="text-[12.5px] text-slate-500 leading-[1.5] mb-3">
        Confirm these to unlock the verified badge — coming in a later release.
      </p>
      <ul className="-my-0.5">
        {PLANNED_VERIFICATIONS.map((label, i) => (
          <li key={label} className="flex items-center gap-2.5 py-2" style={{ borderTop: i === 0 ? "none" : "1px solid #F1F5F9", opacity: 0.7 }}>
            <span className="inline-flex items-center justify-center shrink-0" style={{ width: 26, height: 26, borderRadius: "50%", background: "#F3F4F6", color: "#94A3B8" }}>
              <Icon name="shield" size={13} />
            </span>
            <div className="flex-1 min-w-0 text-[13px] font-medium text-slate-700">{label}</div>
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
    { key: "Name & tagline",   ok: !!t.name && !!t.bio },
    { key: "Location",         ok: !!t.suburb && !!t.city },
    { key: "Languages",        ok: (t.languages || []).length > 0 },
    { key: "Credentials",      ok: (t.credentials || []).filter((c) => c.label).length >= 2 },
    { key: "Long bio (300+)",  ok: (t.bioLong || "").length >= 300 },
    { key: "Subjects (3+)",    ok: (t.subjects || []).length >= 3 },
    { key: "Year levels",      ok: Number.isFinite(t.yearMin) && Number.isFinite(t.yearMax) },
    { key: "Rate set",         ok: !!t.rate && t.rate > 0 },
    { key: "1+ package",       ok: (t.packages || []).filter((p) => p.price).length >= 1 },
    { key: "Experience",       ok: (t.experience || []).filter((e) => e.role).length >= 1 },
    { key: "Education",        ok: (t.education || []).filter((e) => e.school).length >= 1 },
    { key: "Availability set", ok: (t.availability || []).some((row) => row.some((c) => c === 1)) },
    { key: "Service area",     ok: !!t.serviceArea?.suburb },
    // Verification isn't wired up yet (see VerificationsSection), so this can
    // never tick. Flag it `soon` so it's shown but excluded from the meter —
    // otherwise 100% is unreachable.
    { key: "Verified",         ok: (t.verifications || []).find((v) => v.label.toLowerCase().includes("id"))?.done === true, soon: true },
  ];
  const counted = checks.filter((c) => !c.soon);
  const done = counted.filter((c) => c.ok).length;
  return { checks, done, total: counted.length, pct: Math.round((done / counted.length) * 100) };
}

function MiniPreview({ tutor, catalog = [] }) {
  const bySlug = useMemo(() => new Map(catalog.map((s) => [s.slug, s])), [catalog]);
  // Reshape the editor's tutor state into the camelCase, subject-object shape
  // TutorCard expects. Subjects in editor state are slug strings; map them
  // through the catalog so subjectLabel() returns the proper exam-prefixed
  // label. Placeholders fill name/bio/location so empty profiles still look
  // like a card instead of a blank.
  const display = useMemo(() => ({
    ...tutor,
    name: tutor.name || "Your name",
    initial: (tutor.name || " ").trim().charAt(0).toUpperCase() || tutor.initial,
    bio: tutor.bio || "Your tagline",
    suburb: tutor.suburb || "Suburb",
    city: tutor.city || "",
    subjects: (tutor.subjects || []).map((slug) => bySlug.get(slug) ?? { name: slug, slug }),
    credentials: (tutor.credentials || []).filter((c) => c?.label),
    rate: tutor.rate || 0,
    slug: tutor.slug || "preview",
  }), [tutor, bySlug]);
  // pointer-events disabled so clicking the preview doesn't navigate; the
  // hover animation also pauses, which is the right call for a preview.
  return (
    <div style={{ pointerEvents: "none" }}>
      <TutorCard tutor={display} />
    </div>
  );
}

export function Sidebar({ tutor, set, publicHref, publicUrl, catalog }) {
  const c = useMemo(() => calcCompletion(tutor), [tutor]);
  const visOptions = [
    { value: "public",   label: "Public", hint: "Visible to everyone." },
    { value: "hidden",   label: "Hidden", hint: "Profile is offline." },
  ];
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef(null);
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);
  const copyPublicHref = async () => {
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
    <aside className="space-y-5">
      <div>
        <div className="text-[11.5px] text-slate-500 uppercase tracking-wider font-medium mb-2 px-1">Live preview</div>
        <MiniPreview tutor={tutor} catalog={catalog} />
        <div className="text-[12px] text-slate-400 mt-2 px-1">Updates as you type — exactly how your card appears on browse and the home page.</div>
      </div>

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
        <button
          type="button"
          onClick={copyPublicHref}
          title={copied ? "Copied!" : "Click to copy"}
          className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-slate-100"
          style={{ background: "#FAFAFA", borderRadius: 10 }}
        >
          <Icon name={copied ? "check" : "globe"} size={14} className={(copied ? "text-emerald-500" : "text-slate-400") + " shrink-0"} />
          <code className="text-[12.5px] text-slate-700 truncate flex-1 min-w-0">{publicHref}</code>
          <span className={"text-[11px] font-medium shrink-0 " + (copied ? "text-emerald-600" : "text-slate-400")}>
            {copied ? "Copied" : "Copy"}
          </span>
        </button>
      </Card>

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
              {ch.soon && (
                <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0"
                  style={{ background: "#FAFAFA", border: "1px solid #E5E7EB", color: "#94A3B8" }}>
                  Coming soon
                </span>
              )}
            </li>
          ))}
        </ul>
      </Card>
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
      <Link href="/settings" className="hover:text-slate-900">Settings</Link>
      <Icon name="chevron-right" size={12} className="text-slate-300" />
      <span className="text-slate-900 font-medium">Edit profile</span>
    </nav>
  );
}

export function SaveBar({ tutor, dirty, saving, onSave, onDiscard, profileHref }) {
  const router = useRouter();
  const canView = !dirty && !saving && !!profileHref;
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
          <Button variant="outline" size="sm" onClick={onDiscard} disabled={!dirty || saving}>Discard</Button>
          {canView ? (
            <Button variant="primary" size="sm" onClick={() => router.push(profileHref)}>View profile</Button>
          ) : (
            <Button variant="primary" size="sm" onClick={onSave} disabled={!dirty || saving}>{saving ? "Saving…" : "Save changes"}</Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function MobileSaveBar({ dirty, saving, onSave, onDiscard, profileHref }) {
  const router = useRouter();
  const canView = !dirty && !saving && !!profileHref;
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white px-4 py-3 flex items-center gap-3" style={{ borderTop: "1px solid #E5E7EB" }}>
      <div className="flex-1 text-[13px] text-slate-600">{dirty ? "You have unsaved changes" : "All saved"}</div>
      <Button variant="ghost" size="sm" onClick={onDiscard} disabled={!dirty || saving}>Discard</Button>
      {canView ? (
        <Button variant="primary" size="sm" onClick={() => router.push(profileHref)}>View profile</Button>
      ) : (
        <Button variant="primary" size="sm" onClick={onSave} disabled={!dirty || saving}>{saving ? "Saving…" : "Save"}</Button>
      )}
    </div>
  );
}
