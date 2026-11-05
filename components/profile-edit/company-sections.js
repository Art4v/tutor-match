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

import { Button } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { SuburbAutocomplete } from "@/components/SuburbAutocomplete";
import {
  Field,
  TextInput,
  RichTextField,
  ImageUploadControl,
} from "./sections";

/**
 * Logo and banner. The banner-colour swatches are gone: the page shows a banner
 * only when one is uploaded (DESIGN.md §6), so a picked colour had nowhere to
 * show. The stored `bannerBg` is untouched.
 */
export function CompanyImagesSection({ company, set, supabase, userId }) {
  return (
    <div className="space-y-6">
      <ImageUploadControl
        label="Logo"
        value={company.logoImg}
        kind="avatar"
        supabase={supabase}
        userId={userId}
        onChange={(url) => set({ logoImg: url })}
        hint="Square works best. Shown on your page and beside every tutor you list."
        aspect={1}
        // Company logos are squares (DESIGN.md §4); the crop output is square
        // either way, this only matches the crop frame and preview to it.
        cropShape="rect"
        maxOutputPx={1024}
      />
      <ImageUploadControl
        label="Banner"
        value={company.bannerImg}
        kind="banner"
        supabase={supabase}
        userId={userId}
        onChange={(url) => set({ bannerImg: url })}
        hint="Optional. A wide photo of your company. Without one, your page has no banner."
        aspect={1200 / 320}
        cropShape="rect"
        maxOutputPx={2400}
      />
    </div>
  );
}

/** Name, tagline and the outbound enquiry link. */
export function CompanyIdentitySection({ company, set }) {
  const name = company.name ?? "";
  return (
    <div className="space-y-6">
      <Field
        label="Company name"
        hint="Your business name, as students should see it."
        error={name.trim() === "" ? "A name is required. It's what students search for." : null}
      >
        <TextInput
          value={name}
          onChange={(v) => set({ name: v, initial: v.trim().charAt(0).toUpperCase() || null })}
          maxLength={80}
        />
      </Field>

      <Field label="Tagline" optional hint="One line, shown under your name.">
        <TextInput
          value={company.bio ?? ""}
          onChange={(v) => set({ bio: v })}
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
 * The company's one rate card, packages only (0069: no hourly rate). Every
 * tutor listed under this company renders these packages, so this is the single
 * place pricing is set.
 */
export function CompanyRateSection({ company, set }) {
  const packages = company.packages ?? [];
  const update = (i, patch) =>
    set({ packages: packages.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) });
  const remove = (i) => set({ packages: packages.filter((_, idx) => idx !== i) });
  const add = () => set({ packages: [...packages, { label: "", price: "" }] });

  return (
    <div>
      <p className="mb-4 text-[14px] leading-5 text-[color:var(--text-2)]">
        These packages show on your page and on every tutor you list. Individual tutors don&apos;t set
        their own prices.
      </p>

      {packages.length === 0 ? (
        <p className="text-[14px] leading-5 text-[color:var(--text-2)]">No packages yet.</p>
      ) : (
        <ul className="border-t border-rule">
          {packages.map((p, i) => (
            <li key={i} className="flex items-end gap-2 border-b border-rule py-4">
              <div className="min-w-0 flex-1">
                <Field label="Package">
                  <TextInput
                    value={p.label ?? ""}
                    onChange={(v) => update(i, { label: v })}
                    placeholder="e.g. Year 10, per term"
                    maxLength={60}
                  />
                </Field>
              </div>
              <div className="w-[120px] shrink-0">
                <Field label="Price">
                  <TextInput
                    value={p.price ?? ""}
                    onChange={(v) => update(i, { price: v.replace(/[^0-9]/g, "") })}
                    inputMode="numeric"
                    prefix="$"
                  />
                </Field>
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`Remove ${p.label || "this package"}`}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded text-[color:var(--text-2)] hover:bg-surface-2 hover:text-error"
                style={{ transition: "background-color 120ms ease-out, color 120ms ease-out" }}
              >
                <Icon name="trash" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        <Button variant="outline" onClick={add}>Add a package</Button>
      </div>
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
        <p className="mt-2 text-[14px] leading-5 text-[color:var(--text-2)]">
          State: <span className="font-semibold text-[color:var(--text)]">{company.city}</span>
        </p>
      )}
    </div>
  );
}
