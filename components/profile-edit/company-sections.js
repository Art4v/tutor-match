"use client";

// ============================================================================
// Company (tutoring company) editor sections.
// ----------------------------------------------------------------------------
// The company counterpart of ./sections.js. Same contract: every section takes
// { company, set } over shared draft state and renders `bare` (no Card wrapper)
// because OwnerCompany puts them inside an EditRegion modal that supplies the
// chrome.
//
// They live in their own file rather than in sections.js because that file is
// ~1500 lines of tutor-shaped code and a company is a different subject. The
// low-level primitives ARE shared, imported from sections.js, so the two
// editors stay visually identical without either one owning the other.
// ============================================================================

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { SuburbAutocomplete } from "@/components/SuburbAutocomplete";
import {
  AVATAR_SWATCHES,
  Field,
  TextInput,
  RichTextField,
  ImageUploadControl,
} from "./sections";

/** Logo, banner and the fallback colours behind them. */
export function CompanyImagesSection({ company, set, supabase, userId }) {
  return (
    <div className="space-y-5">
      <ImageUploadControl
        label="Logo"
        value={company.logoImg}
        kind="avatar"
        supabase={supabase}
        userId={userId}
        onChange={(url) => set({ logoImg: url })}
        hint="Square works best. Shown on your page and beside every tutor you list."
        aspect={1}
        cropShape="round"
        maxOutputPx={1024}
      />
      <ImageUploadControl
        label="Banner"
        value={company.bannerImg}
        kind="banner"
        supabase={supabase}
        userId={userId}
        onChange={(url) => set({ bannerImg: url })}
        hint="A wide photo of your company. Optional."
        aspect={1200 / 320}
        cropShape="rect"
        maxOutputPx={2400}
      />
      <div>
        <div className="text-[11.5px] text-slate-500 uppercase tracking-wider font-medium mb-1.5">
          Banner colour
        </div>
        <p className="text-[12.5px] text-slate-500 mb-2.5">
          {company.bannerImg ? "Not used while a banner photo is set." : "Used when there's no banner photo."}
        </p>
        <div className="flex flex-wrap gap-2">
          {AVATAR_SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              disabled={!!company.bannerImg}
              onClick={() => set({ bannerBg: c })}
              aria-label={`Use banner colour ${c}`}
              className="transition-transform hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                width: 30,
                height: 30,
                borderRadius: 999,
                background: c,
                border: company.bannerBg === c ? "2px solid var(--ink)" : "1px solid var(--paper-line)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Name, tagline and the outbound enquiry link. */
export function CompanyIdentitySection({ company, set }) {
  const name = company.name ?? "";
  return (
    <div className="space-y-5">
      <Field label="Company name" hint="Your business name, as students should see it.">
        <TextInput
          value={name}
          onChange={(v) => set({ name: v, initial: v.trim().charAt(0).toUpperCase() || null })}
          placeholder="Kumon Chatswood"
          maxLength={80}
        />
        {name.trim() === "" && (
          <p className="mt-2 text-[12.5px]" style={{ color: "#DC2626" }}>
            A name is required, it's what students search for.
          </p>
        )}
      </Field>

      <Field label="Tagline" optional hint="One line, shown under your name.">
        <TextInput
          value={company.bio ?? ""}
          onChange={(v) => set({ bio: v })}
          placeholder="Small-group maths and science in Chatswood since 2009."
          maxLength={140}
        />
      </Field>

      {/* This is the ONLY contact route a company has: companies can't be messaged
          on MatchTutor, every enquiry goes to their own site. */}
      <Field label="Website" hint="Where the Enquire button sends people. Your enquiry or contact page is ideal.">
        <TextInput
          value={company.websiteUrl ?? ""}
          onChange={(v) => set({ websiteUrl: v })}
          placeholder="https://yourcompany.com.au/contact"
          type="url"
          inputMode="url"
        />
      </Field>
    </div>
  );
}

/** The long-form About body. */
export function CompanyAboutSection({ company, set }) {
  return (
    <Field label="About your company" optional hint="Who you teach, how you teach, what makes you different.">
      <RichTextField
        value={company.bioLong ?? ""}
        onChange={(v) => set({ bioLong: v })}
        placeholder="We run small-group classes of no more than six students…"
        rows={10}
        maxLength={2000}
        lists
      />
    </Field>
  );
}

/**
 * The company's one rate card. Every tutor listed under this company renders
 * these prices, so this is the single place pricing is set.
 */
export function CompanyRateSection({ company, set }) {
  const packages = company.packages ?? [];
  const update = (i, patch) =>
    set({ packages: packages.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) });
  const remove = (i) => set({ packages: packages.filter((_, idx) => idx !== i) });
  const add = () => set({ packages: [...packages, { label: "", price: "" }] });

  return (
    <div>
      <p className="text-[13px] text-slate-500 mb-4">
        These prices show on your page and on every tutor you list. Individual tutors don't set
        their own rates.
      </p>

      {packages.length === 0 ? (
        <div
          className="text-[13.5px] text-slate-500 py-4 px-4 text-center"
          style={{ background: "var(--bg-soft)", borderRadius: 10 }}
        >
          No rates yet. Add your first one below.
        </div>
      ) : (
        <div className="space-y-3">
          {packages.map((p, i) => (
            <div key={i} className="flex items-end gap-2.5">
              <div className="flex-1 min-w-0">
                <Field label={i === 0 ? "What it's called" : null}>
                  <TextInput
                    value={p.label ?? ""}
                    onChange={(v) => update(i, { label: v })}
                    placeholder="Single lesson"
                    maxLength={60}
                  />
                </Field>
              </div>
              <div style={{ width: 118 }}>
                <Field label={i === 0 ? "Price" : null}>
                  <TextInput
                    value={p.price ?? ""}
                    onChange={(v) => update(i, { price: v.replace(/[^0-9]/g, "") })}
                    placeholder="60"
                    inputMode="numeric"
                    prefix="$"
                  />
                </Field>
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`Remove ${p.label || "this rate"}`}
                className="shrink-0 inline-flex items-center justify-center mb-1 transition-colors hover:bg-slate-100"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  color: "var(--ink-muted)",
                  border: "1px solid var(--paper-line)",
                }}
              >
                <Icon name="trash" size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium mt-4 transition-colors hover:bg-slate-100"
        style={{ border: "1px solid var(--paper-line)", borderRadius: 999, padding: "8px 14px", color: "var(--ink)" }}
      >
        <Icon name="plus" size={14} /> Add a rate
      </button>
    </div>
  );
}

/**
 * Where the company is. A company is a fixed site, so this is one address rather
 * than the radius model tutors use.
 */
export function CompanyLocationSection({ company, set }) {
  return (
    <div>
      <Field label="Suburb" hint="Students filter by this, so it's worth getting right.">
        {/* A selected suggestion already carries { lat, lng, state }, so there
            is no second round-trip to /api/geocode the way the tutor service
            area needs one. */}
        <SuburbAutocomplete
          value={company.suburb ?? ""}
          variant="box"
          placeholder="Chatswood"
          onSelect={(place) =>
            set({
              suburb: place.suburb,
              // `city` stores the STATE CODE, matching tutor_profiles.city. The
              // column name is historical; see the /browse State filter.
              city: place.state || company.city || "",
              serviceLat: place.lat ?? null,
              serviceLng: place.lng ?? null,
            })
          }
          onClear={() => set({ suburb: "", serviceLat: null, serviceLng: null })}
        />
      </Field>
      {company.city && (
        <p className="text-[12.5px] text-slate-500 mt-2">
          State: <span className="font-medium text-slate-700">{company.city}</span>
        </p>
      )}
    </div>
  );
}
