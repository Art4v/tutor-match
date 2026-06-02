# matchtutor

A marketplace web app for finding and booking academic tutors (HSC, UCAT, LAT, SAT). Built with Next.js 14 (App Router), Tailwind CSS, and Supabase.

This README is the high-level project overview. For day-to-day contributor guidance — naming conventions, architectural rules, query helper shapes — see [`CLAUDE.md`](./CLAUDE.md).

---

## Status at a glance

| Area | State |
| --- | --- |
| Public site (`/`, `/browse`, `/tutor/[slug]`) reading from Supabase | ✅ Implemented (server components, request-time queries) |
| Auth (signup / login) | ✅ Wired to Supabase Auth; signup goes through a server route that validates password policy + email domain (MX lookup) |
| Tutor settings / profile editor (`/settings`) | ✅ Implemented + persists to Supabase (incl. avatar + banner uploads) |
| Slug-based public profile URLs (`/tutor/[slug]`) | ✅ Implemented (unique slug auto-generated on tutor signup) |
| Browse filters with shareable URL state | ✅ Implemented (overall `q` search + name search + multi-select subjects/modes + ATAR/rate + multi-select year levels) |
| Subject catalog | ✅ Exam-scoped Australian catalog (254 subjects across HSC/VCE/IB/QCE/SACE/WACE/TCE/ACT + a `TEST` group for UCAT/GAMSAT/LAT); identified by slug, labelled via `lib/subjects.js` |
| Location search | ✅ Geospatial — suburb autocomplete (`SuburbAutocomplete` → `/api/places`) yields `lat`/`lng`; `/browse` matches tutors whose travel radius covers the point via the `tutors_within_service_radius` SQL function |
| Service area map | ✅ Real Leaflet + OSM map with circle overlay; Nominatim/Photon geocoders; OSM → CARTO tile fallback |
| Supabase schema | ✅ 12 migrations defined (`0001`–`0012`); public listing gated on email confirmation (`0007`); geospatial radius columns + RPC (`0008`); exam-scoped subject catalog (`0009`/`0010`); K–12 year-level range + `GENERAL` exam group (`0011`); headline dropped in favour of the tagline (`0012`) |
| Messaging (`/messages`) | 🟡 Stub page only ("messaging is coming soon"); full two-pane impl is in git history |
| Booking / payments (Request a lesson) | ❌ Button is disabled with a "coming soon" caption |
| Student dashboard | ❌ Not started (`student_profiles` table exists but has no UI) |
| Tests | ❌ None configured |

---

## Tech stack

- **Framework:** Next.js 14.2 (App Router)
- **Language:** JavaScript (no TypeScript)
- **Styling:** Tailwind CSS 3.4 + inline `style={{ ... }}` for design-token-specific colors, radii, and borders
- **Backend:** Supabase (Postgres + Auth + RLS) via `@supabase/ssr` 0.5 and `@supabase/supabase-js` 2.45
- **Maps:** [`leaflet`](https://leafletjs.com/) 1.9 + [`react-leaflet`](https://react-leaflet.js.org/) 4.2 (v4 line — v5 needs React 19). OpenStreetMap tiles primary, CARTO Voyager fallback. No API key needed.
- **Geocoding:** Free Nominatim API primary, Photon (Komoot) fallback. No keys.
- **Icons:** A single self-contained Lucide-style SVG set in `components/Icon.js`

---

## Getting started

### 1. Install

```bash
npm install
```

### 2. Configure Supabase

1. Create a Supabase project at <https://supabase.com>.
2. Copy `.env.example` → `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` — Project Settings → API → Project URL.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Project Settings → API → `anon public` key. **Do not** use the `service_role` key here; it bypasses RLS.
3. Open the Supabase SQL Editor and run the migrations in `supabase/migrations/` **in numeric order**:
   1. `0001_init.sql`
   2. `0002_tutor_profile.sql`
   3. `0003_tutor_dashboard.sql`
   4. `0004_browse.sql`
   5. `0005_default_public.sql`
   6. `0006_profile_images.sql` — adds `avatar_url`/`banner_url` columns and the public `profile-images` Storage bucket (required for avatar + banner uploads)
   7. `0007_email_confirmed.sql` — mirrors `auth.users.email_confirmed_at` onto `tutor_profiles` so the public queries can hide unconfirmed signups (required, or the public pages error on the missing column)
   8. `0008_service_area_geo.sql` — lifts `service_lat`/`service_lng`/`service_radius_km` into real columns and adds the `tutors_within_service_radius(lat, lng, include_online)` SQL function that powers location search (required, or `/browse` location filtering errors on the missing RPC)
   9. `0009_subject_catalog.sql` — wipes the 17 seeded subjects and reseeds the exam-scoped Australian catalog (254 subjects + a `certificates` reference table; subjects keyed by exam-prefixed slug)
   10. `0010_rename_certificates_to_exams.sql` — pure rename: `certificates` → `exams`, `subjects.certificate_code` → `subjects.exam_code` (no data change)
   11. `0011_year_levels_and_general.sql` — adds `tutor_profiles.year_min`/`year_max` (the K–12 range a tutor teaches; default 7–12, drives the `/browse` year filter) and a new `GENERAL` exam group (English/Mathematics/Science/History/Geography) for pre-Year-11 tutoring
   12. `0012_remove_headline.sql` — drops `tutor_profiles.headline` (the tagline `bio` takes over its role); backfills any headline text into an empty tagline first
   13. `0013_slug_regen_and_race_safe.sql` — makes slug assignment race-safe (retry-on-conflict instead of compute-then-insert) and adds an `assign_tutor_slug(name)` RPC so the `/tutor/<slug>` URL regenerates when a tutor renames
   14. `0014_tutor_subjects_order.sql` — adds `tutor_subjects.position` so a tutor can drag-and-drop their subjects into a custom order (shown on the browse card + profile); backfills existing links to alphabetical order, the new default
   15. `0015_oauth_default_role.sql` — makes the signup trigger OAuth-safe: defaults `role` to `tutor` and falls back to the `name` claim when a provider (e.g. Google) doesn't send our `role`/`full_name` metadata (required before Google sign-in works — without it OAuth signups fail on the `NOT NULL` role column)
   16. `0016_full_name_not_blank.sql` — adds a CHECK constraint so `profiles.full_name` can't be saved blank/whitespace (the settings editor writes it directly via the browser client, so this is the authoritative server-side guard); NULL stays allowed for OAuth signups whose provider sent no name

Without Supabase set up, the public pages (`/`, `/browse`, `/tutor/[slug]`) render empty states because they query real data at request time; signup/login also fail.

### 3. Configure auth email (Resend SMTP)

Auth emails (signup confirmation) are sent **by Supabase**, so Resend is wired up in the Supabase
dashboard, not in this app — there is no Resend env var in `.env.local`. The built-in Supabase
sender is capped at ~2 emails/hour and has poor deliverability, so confirmations frequently never
arrive; routing through Resend fixes both.

1. Create a [Resend](https://resend.com) account → **API Keys** → create a key (`re_...`).
2. Supabase Dashboard → **Project Settings → Authentication → SMTP Settings** → enable Custom SMTP:
   - Host `smtp.resend.com`, Port `465` (or `587`), Username `resend`, Password = your `re_...` key.
   - Sender name `MatchTutor`. Sender email `onboarding@resend.dev` until you verify a domain (see below).
3. Supabase Dashboard → **Authentication → Emails → Confirm signup** → paste
   `supabase/email-templates/confirm-signup.html` (the source-of-truth for this template).
4. Supabase Dashboard → **Authentication → Emails → Reset Password** → paste
   `supabase/email-templates/reset-password.html` (powers the forgot-password flow).
5. Supabase Dashboard → **Authentication → Rate Limits** → raise "emails sent per hour" above 2.
6. Supabase Dashboard → **Authentication → URL Configuration** → set **Site URL** (your live domain).
   Under **Redirect URLs**, add a **wildcard** entry for every origin you reset from —
   `https://www.yourdomain.com/auth/callback**` **and** `http://localhost:3000/auth/callback**` for
   dev. The `**` is required: the recovery link redirects to `<origin>/auth/callback?next=/reset-password`,
   and that `?next=…` query string only matches a wildcarded entry. Without it the redirect fails the
   allow-list check and Supabase silently falls back to the bare Site URL (you land on the homepage with
   a stray `?code=` and nothing happens).

#### Password reset flow

`/forgot-password` collects the email and POSTs to `/api/auth/forgot-password`, which validates the
address (format + that the domain can receive mail) and calls `resetPasswordForEmail`. The
**Reset Password** email template builds its link from `{{ .RedirectTo }}` (= the
`<origin>/auth/callback?next=/reset-password` the app passed to `resetPasswordForEmail`) and appends
`&token_hash=…&type=recovery`, so the link points **straight at `/auth/callback`** — no Supabase
`/verify` hop. `/auth/callback` verifies it with `supabase.auth.verifyOtp({ type: "recovery",
token_hash })`, which mints the session directly (no PKCE code exchange, so it works even in a
different browser), then forwards to `/reset-password`, where the user sets a new password
(`updateUser`). On success they're signed out and sent to `/login?reset=1`. Using `{{ .RedirectTo }}`
(not the global `{{ .SiteURL }}`) makes the link self-select environment — a localhost request emails
a localhost link, production emails a production link — so Site URL stays on the live domain. For
`RedirectTo` to render, `<origin>/auth/callback` must be in the **Redirect URLs** allow-list **as a
wildcard** (`<origin>/auth/callback**`) — the `?next=` query string won't match a bare entry, and a
failed match falls back to the bare Site URL (the "link goes to the domain and does nothing" symptom).
The send step never reveals whether an account exists (no enumeration) — any well-formed request shows
the same neutral confirmation.

> **Note:** the link is rendered by Supabase from the email template, so after editing
> `reset-password.html` you must re-paste it into **Authentication → Emails → Reset Password** for
> changes to take effect.

**Test mode:** with no verified domain, `onboarding@resend.dev` only delivers to the email you
registered your Resend account with — sign up with that address when testing locally.

**Going live:** add a domain in Resend (Dashboard → Domains), create the SPF/DKIM/DMARC DNS records
it shows, wait for "Verified", then change the Supabase Sender email to e.g. `noreply@yourdomain.com`.

### 4. Configure Google OAuth

The "Continue with Google" button on `/login` and `/signup` uses Supabase OAuth (PKCE). The Google
**Client ID/secret live in the Supabase dashboard**, not in `.env.local` — the app never sees them.
Microsoft stays a disabled placeholder.

**A. Google Cloud Console** (<https://console.cloud.google.com>)

1. Create/select a project.
2. **APIs & Services → OAuth consent screen**: choose *External*, fill app name + support email, and
   add your own email under *Test users* (so you can sign in while the app is unpublished).
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID → Web application**.
4. Under **Authorized redirect URIs** add your Supabase callback — this is the stable *Supabase* URL,
   **not** localhost: `https://<your-project-ref>.supabase.co/auth/v1/callback`
   (`<your-project-ref>` is the subdomain in `NEXT_PUBLIC_SUPABASE_URL`).
5. Copy the generated **Client ID** and **Client secret**.

**B. Supabase dashboard**

1. **Authentication → Providers → Google** → enable, paste the Client ID + secret, Save.
2. **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:3000` in dev (your prod URL when you deploy).
   - **Redirect URLs** allow-list: add `http://localhost:3000/**` (and `https://yourdomain.com/**`
     for prod). This is what lets Supabase redirect back to the app's `/auth/callback`.
3. Make sure migration `0015_oauth_default_role.sql` has been run (see step 2).

New Google users are created as **tutors** and land on `/settings` after sign-in. Because Google only
trusts the stable Supabase callback URL (and Supabase is allowed to redirect to `localhost`), the whole
flow is testable on the dev server — no tunneling needed.

### 5. Run

```bash
npm run dev      # http://localhost:3000
npm run build    # production build (requires the two NEXT_PUBLIC_* vars; placeholders are fine for smoke-tests)
npm run start    # serve the production build
```

There are no tests configured.

---

## Routes

| Path | File | Notes |
| --- | --- | --- |
| `/` | `app/page.js` | Server component. Hero search, featured tutor grid, how-it-works, CTA. |
| `/browse` | `app/browse/page.js` | Server component. Parses filter state from `searchParams` (`q`, `name`, `subject[]`, `lat`/`lng`/`place`, `atarMin`, `rateMax`, `mode[]`, `sort`, `page`) and calls `getTutorsForBrowse()`. Location is geospatial — `lat`/`lng` from a `SuburbAutocomplete` selection match tutors whose travel radius covers the point. Filter sidebar (`BrowseFilters.jsx`) is a client component — every change rewrites the URL so filters are shareable / back-button-friendly. |
| `/tutor/[slug]` | `app/tutor/[slug]/page.js` | Public profile. `getTutorBySlug()` → camelCase tutor object; `notFound()` if no match or `visibility ≠ 'public'`. Renders the real Leaflet service-area map when coordinates are available. |
| `/messages` | `app/messages/page.js` | Stub: "messaging is coming soon". Not linked from the nav. |
| `/signup`, `/login` | `app/(auth)/...` | Email + password forms sharing `app/(auth)/layout.js` (centered card). Signup posts to `/api/auth/signup` (Student role is "coming soon" — only Tutor is selectable). |
| `/api/auth/signup` | `app/api/auth/signup/route.js` | `POST { fullName, email, password, role }`. Authoritative signup gate: re-validates the password policy + email format and verifies the email domain can receive mail (MX / A-record lookup) before calling `supabase.auth.signUp`. Returns `{ status: "session" \| "confirm" \| "exists" }`. |
| `/settings` | `app/settings/page.js` | Server component. Redirects to `/login` if no session; otherwise loads the `SettingsEditor` client component. |
| `/api/places` | `app/api/places/route.js` | `GET ?q=<text>` → up to 6 AU suburb matches `[{ label, suburb, state, postcode, lat, lng }]`. Backed by `lib/places.js` (Photon typeahead → Nominatim fallback). Powers the `SuburbAutocomplete` on `/`, `/browse`, `/settings` — the primary location path. |
| `/api/geocode` | `app/api/geocode/route.js` | `GET ?q=<suburb>` → `{ lat, lng }` or `{ lat: null, lng: null }` (single result). Backed by `lib/geocode.js`. Now a fallback — the primary location flow goes through `/api/places`. |

---

## Project layout

```
tutor-match/
├─ app/
│  ├─ (auth)/
│  │  ├─ layout.js              # centered card layout shared by login + signup
│  │  ├─ login/page.js
│  │  └─ signup/page.js         # role chip → auth.user_metadata.{role, full_name}
│  ├─ api/
│  │  ├─ auth/signup/route.js   # POST signup gate: password + email-domain validation → auth.signUp
│  │  ├─ geocode/route.js       # GET /api/geocode?q=<suburb> → { lat, lng } (fallback path)
│  │  └─ places/route.js        # GET /api/places?q=<text> → up to 6 AU suburb matches (typeahead)
│  ├─ browse/
│  │  ├─ page.js                # server component; reads filters from searchParams
│  │  └─ BrowseFilters.jsx      # client; URL-driven sidebar + sort chips
│  ├─ settings/
│  │  ├─ page.js                # server component; gates on auth
│  │  ├─ SettingsEditor.js      # client component; form state + save flow
│  │  └─ sections.js            # all visual editor sections + form primitives + ServiceAreaSection
│  ├─ messages/page.js          # stub
│  ├─ tutor/[slug]/
│  │  ├─ page.js                # server component
│  │  ├─ RateCard.jsx           # client; pricing card
│  │  └─ ServiceAreaMap.jsx     # client; dynamic-imports ServiceMapLeaflet with ssr:false
│  ├─ globals.css
│  ├─ icon.svg                  # favicon
│  ├─ layout.js                 # root layout; mounts <TopNav>
│  └─ page.js                   # home
├─ components/
│  ├─ Footer.js
│  ├─ HomeCta.jsx
│  ├─ HomeHero.jsx              # home-page search hero + dropdown picker
│  ├─ HomeHowItWorks.jsx
│  ├─ Icon.js                   # 40+ inline SVG icons; add new icons here
│  ├─ ServiceMapLeaflet.jsx     # Leaflet map + circle overlay; OSM → CARTO tile fallback
│  ├─ SubjectPicker.jsx         # exam-first subject picker (single/multi); emits slugs
│  ├─ SuburbAutocomplete.jsx    # debounced /api/places typeahead; carries {lat,lng,state}
│  ├─ TopNav.js                 # auth-aware navbar; dropdown menu when logged in
│  ├─ TutorCard.js              # canonical hover-animated card (motion/react variants); chip rows fit to one line with a "+N more" pill
│  └─ ui.js                     # Avatar, VerifiedTick, OnlineDot, Chip, Button
├─ lib/
│  ├─ availability.js           # canonical 24×7 availability grid (one row per hour, full 24h) — labels + helpers shared editor + public
│  ├─ email.js                  # email format check + domain extractor (shared client + server)
│  ├─ password.js               # password policy rules (shared signup form + server route)
│  ├─ geocode.js                # single-result geocode; Nominatim → Photon fallback; in-process cache
│  ├─ places.js                 # suburb typeahead (list); Photon → Nominatim fallback; in-process cache
│  ├─ subjects.js               # subjectLabel() + groupByExam() for the exam-scoped catalog
│  └─ supabase/
│     ├─ client.js              # createBrowserClient — for client components
│     ├─ server.js              # createServerClient — for server components / route handlers
│     ├─ storage.js             # avatar/banner uploads to the profile-images bucket
│     └─ tutors.js              # browse, featured, slug, editor, save, subjects
├─ supabase/migrations/
│  ├─ 0001_init.sql
│  ├─ 0002_tutor_profile.sql
│  ├─ 0003_tutor_dashboard.sql
│  ├─ 0004_browse.sql
│  ├─ 0005_default_public.sql
│  ├─ 0006_profile_images.sql
│  ├─ 0007_email_confirmed.sql
│  ├─ 0008_service_area_geo.sql
│  ├─ 0009_subject_catalog.sql
│  ├─ 0010_rename_certificates_to_exams.sql
│  ├─ 0011_year_levels_and_general.sql
│  ├─ 0012_remove_headline.sql
│  ├─ 0013_slug_regen_and_race_safe.sql
│  └─ 0014_tutor_subjects_order.sql
├─ middleware.js                # refreshes the Supabase session cookie on every request
├─ jsconfig.json                # path alias: "@/*" → project root
├─ tailwind.config.js
├─ next.config.mjs
└─ postcss.config.js
```

The `_design/` directory contains the original HTML/CSS/JS prototype and is gitignored. Treat it as a read-only source of truth for visual decisions.

---

## Architecture notes

### Public site reads from Supabase at request time

`/`, `/browse`, and `/tutor/[slug]` are server components that call helpers in `lib/supabase/tutors.js` directly. The old `lib/data.js` hardcoded array was deleted; there's no in-memory fallback any more. If Supabase is unreachable or the DB is empty, pages just render their empty states.

### Styling philosophy

Styling is intentionally a mix of:
- **Tailwind utilities** for layout (flex, grid, spacing, typography).
- **Inline `style={{ ... }}`** for the specific colors, radii, and borders that came from the design.

Don't refactor inline styles into a global stylesheet without good reason — they keep design tokens local to where they're used. The hover-lift pattern on cards (`translateY(-2px)` + border color transition driven by `useState(hover)`) is the working approach because Tailwind's `hover:border-...` doesn't override an inline `style.border`.

### Supabase

**Clients**
- `lib/supabase/client.js` — `createBrowserClient` for client components.
- `lib/supabase/server.js` — `createServerClient` wired to `cookies()` for server components and route handlers.
- `middleware.js` — calls `supabase.auth.getUser()` on every request to refresh the session cookie. The matcher excludes static assets. Pattern is from the official `@supabase/ssr` docs.

**Schema (applied in numeric order)**

- `0001_init.sql` — **Option B layout**: a shared `profiles` table 1:1 with `auth.users`, plus role-specific extension tables `tutor_profiles` and `student_profiles` keyed by the same uuid. A `handle_new_user()` trigger reads `role` and `full_name` from `auth.users.raw_user_meta_data` and atomically creates the matching `profiles` row plus the role-specific row on signup. Self-only RLS.
- `0002_tutor_profile.sql` — expands `tutor_profiles` with the columns the public profile page needs (bio, atar, rate, availability JSONB, rating, …). Adds:
  - a seeded `subjects` reference table (17 HSC/UCAT/LSAT subjects),
  - a `tutor_subjects` join table,
  - ordered child tables `tutor_packages`, `tutor_experience`, `tutor_education` (each with a `position` column),
  - public-read RLS on tutor data; tutor self-write on their own rows.
- `0003_tutor_dashboard.sql` — renames `atar_rank` → `rank`; adds dashboard-editor columns (`headline` (removed in `0012`), `rank_subject`, `verified`, `delivers_in_person`, `delivers_online`, `service_area` jsonb, `verifications` jsonb, `visibility` text with a check constraint); converts `credentials` from `text[]` to `jsonb` of `{label, icon}`. The `service_area` JSONB shape used by the app is `{ suburb, radiusKm, lat?, lng?, geocodedSuburb? }` — coords are populated by the geocoder; the column itself stays untyped JSONB.
- `0004_browse.sql` — adds `tutor_profiles.slug` (unique) + a `generate_unique_slug(name)` helper. Extends `handle_new_user()` to populate the slug on new tutor signups and backfills existing rows. Changes the `visibility` default from `'public'` to `'unlisted'` (later reverted in `0005`). Adds filter indexes on `visibility`, `city`, `atar`, `rate`, and a second SELECT policy on `profiles` for public read of tutor rows so the browse join can return tutor names.
- `0005_default_public.sql` — reverses step 5 of `0004`: sets the `visibility` default back to `'public'` so new tutor signups appear on `/browse` as soon as `handle_new_user()` creates the row. Existing rows are untouched (an optional commented backfill promotes any leftover `'unlisted'` rows).
- `0006_profile_images.sql` — adds `avatar_url`/`banner_url` text columns to `tutor_profiles` and creates the public `profile-images` Storage bucket with owner-scoped RLS (anyone can read; an authenticated user can only write/replace/delete files under their own `<uid>/...` folder). Backs the avatar + banner uploads in `lib/supabase/storage.js`.
- `0007_email_confirmed.sql` — gates public listing on email confirmation. The anon read role can't see `auth.users`, so this mirrors `auth.users.email_confirmed_at` onto `tutor_profiles`: `handle_new_user()` copies it on insert (non-null when the project auto-confirms), and an `AFTER UPDATE` trigger on `auth.users` propagates it when the user later clicks the confirmation link. The public query helpers in `lib/supabase/tutors.js` filter `email_confirmed_at IS NOT NULL` alongside `visibility = 'public'`, so unconfirmed signups never appear on `/`, `/browse`, or `/tutor/[slug]`. **This migration is required** — the public queries reference the column, so a DB missing `0007` will error.
- `0008_service_area_geo.sql` — makes the tutor's service-area radius drive location search. Lifts `service_lat`/`service_lng`/`service_radius_km` out of the `service_area` JSONB into real columns (backfilled from the JSONB; `saveTutorProfile` writes both going forward) so SQL can filter by distance. Adds `tutors_within_service_radius(lat, lng, include_online)` — a plain-SQL haversine function (no PostGIS/earthdistance extension) returning ids of public + confirmed tutors whose travel radius covers the point, OR-ing in online-delivery tutors when asked. `getTutorsForBrowse` calls it as its "resolve ids first" location step. **Required** — `/browse` location filtering errors without the RPC.
- `0009_subject_catalog.sql` — replaces the 17 seeded subjects with an extensive **exam-scoped** Australian catalog (254 subjects across 8 senior-secondary certificates — HSC, VCE, IB, QCE, SACE, WACE, TCE, ACT — plus a `TEST` group for admissions/aptitude tests like UCAT, GAMSAT, LAT). Adds a `certificates` reference table and a `subjects.certificate_code` FK; **drops the `subjects.name` UNIQUE constraint** (the same display name recurs across exams) while `slug` stays the unique canonical key, now exam-prefixed (e.g. `vce-biology`, `hsc-biology`; tests are bare, e.g. `ucat`). Wipe-and-reseed: existing `subjects` + their `tutor_subjects` links are cleared. Subjects are identified by **slug, not name**, throughout the data layer; display sites label them via `subjectLabel()` in `lib/subjects.js`.
- `0010_rename_certificates_to_exams.sql` — pure rename of the 0009 concept: table `certificates` → `exams`, column `subjects.certificate_code` → `subjects.exam_code`, and the RLS policy. No data changes. The codebase uses **"exam"** terminology throughout from here on.
- `0011_year_levels_and_general.sql` — K–12 additions. Adds `tutor_profiles.year_min`/`year_max` (int, default 7 / 12, check `0–12` + `min ≤ max`; backfilled) — the year-level range a tutor teaches, which `getTutorsForBrowse` matches against each selected year and the profile card displays. Adds a `GENERAL` exam group (position 0) with English/Mathematics/Science/History/Geography (slugs `general-*`) for pre-Year-11 tutoring; it flows through the exam-code-driven catalog automatically and is labelled bare (no prefix) like the `TEST` group. Year labels/formatters live in `lib/yearLevels.js`.
- `0012_remove_headline.sql` — drops `tutor_profiles.headline`, which overlapped with the tagline (`bio`). The **tagline now takes over**: it's the one-line subtitle under the tutor's name on the profile and the browse card, and the field the `q` (overall) search matches. Existing headline text is backfilled into `bio` where the tagline is empty before the column is dropped.
- `0013_slug_regen_and_race_safe.sql` — hardens the name-derived `/tutor/<slug>` URL. Replaces the racy `generate_unique_slug()` → insert path with a race-safe core `_assign_tutor_slug(id, name)` that UPDATEs the slug in a retry loop catching `unique_violation` (so concurrent same-name signups can't collide), and rewires `handle_new_user()` to use it (still mirroring `email_confirmed_at`). Adds `assign_tutor_slug(name)` — an authenticated RPC scoped to `auth.uid()` — which `saveTutorProfile` calls when the display name changes, so renaming refreshes the slug instead of leaving a stale URL. The core has execute revoked from the API roles; the old `generate_unique_slug()` stays defined but unused.
- `0014_tutor_subjects_order.sql` — adds `tutor_subjects.position` so subjects carry a tutor-defined order. The settings editor's `SubjectPicker` renders the selected chips as a drag-and-drop list; reordering rewrites the slug array, which `saveTutorProfile` persists as `position`, and every read orders by it — so the browse card and public profile mirror the editor. Existing tutors default to **alphabetical**: the migration backfills their links A–Z by display label. New picks append to the end; the tutor drags to reorder.

**Signup flow**

The signup form (`app/(auth)/signup/page.js`) does **not** call `supabase.auth.signUp` directly. It POSTs to `/api/auth/signup` (`app/api/auth/signup/route.js`), the authoritative server-side gate, which:

1. Re-validates the password against the shared policy in `lib/password.js` (the form shows the same live checklist, but the server is the gate that can't be bypassed by disabling JS).
2. Validates the email format (`lib/email.js`) and confirms the domain can actually receive mail via a DNS MX lookup (falling back to an A/AAAA record), so typo'd domains like `gmial.con` are rejected.
3. Calls `supabase.auth.signUp({ email, password, options: { data: { full_name, role } } })` server-side, and returns `{ status }`:
   - `"session"` — confirmation disabled; the route writes the session cookies onto the response and the client redirects to `/settings`.
   - `"confirm"` — confirmation enabled; the client shows a "check your email" message.
   - `"exists"` — email already registered (Supabase signals this with an empty `identities` array rather than an error); the client points the user to log in.

The role chip sets `role` in user metadata. The database trigger — not the client — decides which extension table to populate. **Do not insert into `profiles` or extension tables directly from the client.** Student signup is currently disabled in the UI ("coming soon"); only Tutor accounts can be created.

**Query helpers (`lib/supabase/tutors.js`)** — all take a Supabase client as the first arg so they work from both server and browser contexts:

- `getTutorsForBrowse(supabase, params)` — paginated `/browse` query (`{ q, name, subjectSlugs[], lat, lng, atarMin, rateMax, yearLevels[], modes, sort, page, pageSize }`). Filters by `visibility = 'public'` + confirmed email. `q` is the overall search (tagline `bio`/city/suburb OR name); `name` filters full_name only. Subject, location (the `tutors_within_service_radius` RPC), and name each resolve to a tutor-id set first, then intersect into one `.in("id", ...)` so the exact count + pagination stay correct. Returns `{ tutors, total }`.
- `getFeaturedTutors(supabase, limit, excludeId)` — top-N by `rating desc nulls last, review_count desc`. Used by `/` and the "Similar tutors" sidebar.
- `getTutorBySlug(supabase, slug)` — full detail-page shape. Returns null if no public tutor matches.
- `getSubjects(supabase)` — the exam-scoped subject catalog (`{ name, slug, exam, examName }[]`, sorted) that feeds the `SubjectPicker` on the filter sidebar, hero search, and settings editor.
- `getTutorProfile(supabase, id)`, `getTutorProfileForEditor(supabase, id)`, `saveTutorProfile(supabase, id, tutor)` — used by `/settings`. The editor helper returns camelCase keys matching the editor's in-memory state; `saveTutorProfile` does scalar update + replace-all on the four child tables (subjects, packages, experience, education) — not transactional.

### Maps & geocoding

The Service area card on `/tutor/[slug]` and the live preview in the settings editor both render a real Leaflet map of the suburb with a dashed-circle radius overlay.

- **Tiles:** OpenStreetMap by default. On >3 `tileerror` events the map swaps to CARTO Voyager tiles (same coordinate scheme, no key). Implemented inside `components/ServiceMapLeaflet.jsx`.
- **Location picker (primary path):** `components/SuburbAutocomplete.jsx` is the shared client typeahead used on `/`, `/browse`, and `/settings`. It debounces a fetch to `/api/places` (`app/api/places/route.js` → `lib/places.js`, Photon primary since it's built for autocomplete, Nominatim fallback). A selected suggestion already carries `{ lat, lng, state }`, so the home page and browse get coords with no second round-trip, and `ServiceAreaSection` writes them straight into `tutor.serviceArea`.
- **Single-result geocode (fallback):** `lib/geocode.js` exports `geocodeSuburb(suburb)` (server-only, behind `/api/geocode`). Tries Nominatim first (sends an identifying `User-Agent` per OSM policy), then Photon. Returns `{ lat, lng } | null`, cached in-process. The settings editor only falls back to this on `Save` if the picked suburb somehow lacks coords (e.g. legacy rows).
- **Fallback behavior:** if a suburb can't be resolved (typo / unknown / both endpoints down), the row still saves without lat/lng, and the public profile card hides the map block entirely — only the "In-person within N km of <suburb>" text line is shown (no SVG placeholder on the public page).

### State & navigation

- **Filter state on `/browse` lives in the URL.** `BrowseFilters.jsx` calls `router.replace()` on every change; the server page re-runs the Supabase query. Repeated `subject=` params encode multi-select subjects; repeated `year=` params (integers, K=0) encode multi-select year levels, which `getTutorsForBrowse()` matches against each tutor's `[year_min, year_max]` range.
- `components/TopNav.js` is auth-aware: logged-in users see a single avatar-chip dropdown containing Browse / Settings / Log out; logged-out users see only Log in + Sign Up (no Browse). The navbar is `z-40` to stay above the settings editor's own `z-30` sticky save bar.

### Path alias

`jsconfig.json` maps `@/*` to the project root. Imports use `@/components/...`, `@/lib/...`, etc.

---

## What's next (roughly)

1. Real booking flow behind the now-disabled "Request a lesson" button on `/tutor/[slug]`.
2. Reintroduce real messaging (a two-pane prototype lives in git history).
3. Student dashboard.
4. Bookings / payments.
