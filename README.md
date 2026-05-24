# tutormatch

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
| Browse filters with shareable URL state | ✅ Implemented (single-select sidebar filters; year-level chips are multi-select but local-state only) |
| Service area map | ✅ Real Leaflet + OSM map with circle overlay; Nominatim → Photon geocoder fallback; OSM → CARTO tile fallback |
| Supabase schema | ✅ 7 migrations defined (`0001`–`0007`); public listing gated on email confirmation (`0007`) |
| Messaging (`/messages`) | 🟡 Stub page only ("messaging is coming soon"); full two-pane impl is in git history |
| Saved-tutors list | 🟡 In-memory only; only the mobile sticky bar on `/tutor/[slug]` still surfaces it |
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

Without Supabase set up, the public pages (`/`, `/browse`, `/tutor/[slug]`) render empty states because they query real data at request time; signup/login also fail.

### 3. Configure auth email (Resend SMTP)

Auth emails (signup confirmation) are sent **by Supabase**, so Resend is wired up in the Supabase
dashboard, not in this app — there is no Resend env var in `.env.local`. The built-in Supabase
sender is capped at ~2 emails/hour and has poor deliverability, so confirmations frequently never
arrive; routing through Resend fixes both.

1. Create a [Resend](https://resend.com) account → **API Keys** → create a key (`re_...`).
2. Supabase Dashboard → **Project Settings → Authentication → SMTP Settings** → enable Custom SMTP:
   - Host `smtp.resend.com`, Port `465` (or `587`), Username `resend`, Password = your `re_...` key.
   - Sender name `TutorMatch`. Sender email `onboarding@resend.dev` until you verify a domain (see below).
3. Supabase Dashboard → **Authentication → Emails → Confirm signup** → paste
   `supabase/email-templates/confirm-signup.html` (the source-of-truth for this template).
4. Supabase Dashboard → **Authentication → Rate Limits** → raise "emails sent per hour" above 2.
5. Supabase Dashboard → **Authentication → URL Configuration** → set Site URL (`http://localhost:3000`
   in dev) so the confirmation link redirects back correctly.

**Test mode:** with no verified domain, `onboarding@resend.dev` only delivers to the email you
registered your Resend account with — sign up with that address when testing locally.

**Going live:** add a domain in Resend (Dashboard → Domains), create the SPF/DKIM/DMARC DNS records
it shows, wait for "Verified", then change the Supabase Sender email to e.g. `noreply@yourdomain.com`.

### 4. Run

```bash
npm run dev      # http://localhost:3000
npm run build    # production build (requires the two NEXT_PUBLIC_* vars; placeholders are fine for smoke-tests)
npm run start    # serve the production build
npm run lint     # Next's built-in ESLint
```

There are no tests configured.

---

## Routes

| Path | File | Notes |
| --- | --- | --- |
| `/` | `app/page.js` | Server component. Hero search, featured tutor grid, how-it-works, CTA. |
| `/browse` | `app/browse/page.js` | Server component. Parses filter state from `searchParams` and calls `getTutorsForBrowse()`. Filter sidebar (`BrowseFilters.jsx`) is a client component — every change rewrites the URL so filters are shareable / back-button-friendly. |
| `/tutor/[slug]` | `app/tutor/[slug]/page.js` | Public profile. `getTutorBySlug()` → camelCase tutor object; `notFound()` if no match or `visibility ≠ 'public'`. Renders the real Leaflet service-area map when coordinates are available. |
| `/messages` | `app/messages/page.js` | Stub: "messaging is coming soon". Not linked from the nav. |
| `/signup`, `/login` | `app/(auth)/...` | Email + password forms sharing `app/(auth)/layout.js` (centered card). Signup posts to `/api/auth/signup` (Student role is "coming soon" — only Tutor is selectable). |
| `/api/auth/signup` | `app/api/auth/signup/route.js` | `POST { fullName, email, password, role }`. Authoritative signup gate: re-validates the password policy + email format and verifies the email domain can receive mail (MX / A-record lookup) before calling `supabase.auth.signUp`. Returns `{ status: "session" \| "confirm" \| "exists" }`. |
| `/settings` | `app/settings/page.js` | Server component. Redirects to `/login` if no session; otherwise loads the `SettingsEditor` client component. |
| `/api/geocode` | `app/api/geocode/route.js` | `GET ?q=<suburb>` → `{ lat, lng }` or `{ lat: null, lng: null }`. Backed by `lib/geocode.js`. |

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
│  │  └─ geocode/route.js       # GET /api/geocode?q=<suburb> → { lat, lng }
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
│  │  ├─ SaveButton.jsx         # client; mobile sticky save (only consumer of SavedContext)
│  │  └─ ServiceAreaMap.jsx     # client; dynamic-imports ServiceMapLeaflet with ssr:false
│  ├─ globals.css
│  ├─ icon.svg                  # favicon
│  ├─ layout.js                 # root layout; mounts <SavedProvider> + <TopNav>
│  └─ page.js                   # home
├─ components/
│  ├─ Footer.js
│  ├─ HomeCta.jsx
│  ├─ HomeHero.jsx              # home-page search hero + dropdown picker
│  ├─ HomeHowItWorks.jsx
│  ├─ Icon.js                   # 40+ inline SVG icons; add new icons here
│  ├─ SavedContext.js           # in-memory "saved tutors" provider (no persistence)
│  ├─ ServiceMapLeaflet.jsx     # Leaflet map + circle overlay; OSM → CARTO tile fallback
│  ├─ TopNav.js                 # auth-aware navbar; dropdown menu when logged in
│  ├─ TutorCard.js              # canonical hover-animated card pattern
│  └─ ui.js                     # Avatar, VerifiedTick, OnlineDot, Chip, Button
├─ lib/
│  ├─ availability.js           # canonical 8×7 availability-grid hour/day labels (shared editor + public)
│  ├─ email.js                  # email format check + domain extractor (shared client + server)
│  ├─ password.js               # password policy rules (shared signup form + server route)
│  ├─ geocode.js                # Nominatim → Photon fallback chain; in-process cache
│  └─ supabase/
│     ├─ client.js              # createBrowserClient — for client components
│     ├─ server.js              # createServerClient — for server components / route handlers
│     ├─ storage.js             # avatar/banner uploads to the profile-images bucket
│     └─ tutors.js              # browse, featured, slug, editor, save, subjects, cities
├─ supabase/migrations/
│  ├─ 0001_init.sql
│  ├─ 0002_tutor_profile.sql
│  ├─ 0003_tutor_dashboard.sql
│  ├─ 0004_browse.sql
│  ├─ 0005_default_public.sql
│  ├─ 0006_profile_images.sql
│  └─ 0007_email_confirmed.sql
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
- `0003_tutor_dashboard.sql` — renames `atar_rank` → `rank`; adds dashboard-editor columns (`headline`, `rank_subject`, `verified`, `delivers_in_person`, `delivers_online`, `service_area` jsonb, `verifications` jsonb, `visibility` text with a check constraint); converts `credentials` from `text[]` to `jsonb` of `{label, icon}`. The `service_area` JSONB shape used by the app is `{ suburb, radiusKm, lat?, lng?, geocodedSuburb? }` — coords are populated by the geocoder; the column itself stays untyped JSONB.
- `0004_browse.sql` — adds `tutor_profiles.slug` (unique) + a `generate_unique_slug(name)` helper. Extends `handle_new_user()` to populate the slug on new tutor signups and backfills existing rows. Changes the `visibility` default from `'public'` to `'unlisted'` (later reverted in `0005`). Adds filter indexes on `visibility`, `city`, `atar`, `rate`, and a second SELECT policy on `profiles` for public read of tutor rows so the browse join can return tutor names.
- `0005_default_public.sql` — reverses step 5 of `0004`: sets the `visibility` default back to `'public'` so new tutor signups appear on `/browse` as soon as `handle_new_user()` creates the row. Existing rows are untouched (an optional commented backfill promotes any leftover `'unlisted'` rows).
- `0006_profile_images.sql` — adds `avatar_url`/`banner_url` text columns to `tutor_profiles` and creates the public `profile-images` Storage bucket with owner-scoped RLS (anyone can read; an authenticated user can only write/replace/delete files under their own `<uid>/...` folder). Backs the avatar + banner uploads in `lib/supabase/storage.js`.
- `0007_email_confirmed.sql` — gates public listing on email confirmation. The anon read role can't see `auth.users`, so this mirrors `auth.users.email_confirmed_at` onto `tutor_profiles`: `handle_new_user()` copies it on insert (non-null when the project auto-confirms), and an `AFTER UPDATE` trigger on `auth.users` propagates it when the user later clicks the confirmation link. The public query helpers in `lib/supabase/tutors.js` filter `email_confirmed_at IS NOT NULL` alongside `visibility = 'public'`, so unconfirmed signups never appear on `/`, `/browse`, or `/tutor/[slug]`. **This migration is required** — the public queries reference the column, so a DB missing `0007` will error.

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

- `getTutorsForBrowse(supabase, params)` — paginated `/browse` query. Filters by `visibility = 'public'`, joins `profiles` for `full_name`. Returns `{ tutors, total }`.
- `getFeaturedTutors(supabase, limit, excludeId)` — top-N by `rating desc nulls last, review_count desc`. Used by `/` and the "Similar tutors" sidebar.
- `getTutorBySlug(supabase, slug)` — full detail-page shape. Returns null if no public tutor matches.
- `getDistinctCities(supabase)`, `getSubjects(supabase)`, `getSubjectNames(supabase)` — feed the filter sidebar + hero search dropdowns.
- `getTutorProfile(supabase, id)`, `getTutorProfileForEditor(supabase, id)`, `saveTutorProfile(supabase, id, tutor)` — used by `/settings`. The editor helper returns camelCase keys matching the editor's in-memory state; `saveTutorProfile` does scalar update + replace-all on the four child tables (subjects, packages, experience, education) — not transactional.

### Maps & geocoding

The Service area card on `/tutor/[slug]` and the live preview in the settings editor both render a real Leaflet map of the suburb with a dashed-circle radius overlay.

- **Tiles:** OpenStreetMap by default. On >3 `tileerror` events the map swaps to CARTO Voyager tiles (same coordinate scheme, no key). Implemented inside `components/ServiceMapLeaflet.jsx`.
- **Geocoding:** `lib/geocode.js` exports `geocodeSuburb(suburb)` (server-only). Tries Nominatim first (sends an identifying `User-Agent` per OSM policy), then Photon. Returns `{ lat, lng } | null`. Results are cached in-process by lowercased suburb.
- **Browser path:** the settings editor never calls Nominatim directly; it hits the local `/api/geocode` proxy (`app/api/geocode/route.js`).
- **When in the editor:** the base-suburb input is debounced 600ms before geocoding. On `Save`, `SettingsEditor` re-tries the geocode if the stored coords are stale, so the saved row always has the freshest coords we can resolve.
- **Fallback behavior:** if both Nominatim and Photon fail (typo / unknown suburb / both endpoints down), the editor shows an SVG placeholder, the row still saves (without lat/lng), and the public profile card hides the map block entirely — only the "In-person within N km of <suburb>" text line is shown.

### State & navigation

- **Filter state on `/browse` lives in the URL.** `BrowseFilters.jsx` calls `router.replace()` on every change; the server page re-runs the Supabase query. Repeated `subject=` params encode multi-select. Year-level chips are multi-select in the UI but local state only — they don't yet write to the URL or feed `getTutorsForBrowse()`.
- `components/TopNav.js` is auth-aware: logged-in users see a single avatar-chip dropdown containing Browse / Settings / Log out; logged-out users see only Log in + Sign Up (no Browse). The navbar is `z-40` to stay above the settings editor's own `z-30` sticky save bar.
- `components/SavedContext.js` is an in-memory "saved tutors" list (no persistence). Only the mobile sticky `SaveButton` on `/tutor/[slug]` still consumes it; tutor cards and the desktop tutor banner no longer surface a save button.

### Path alias

`jsconfig.json` maps `@/*` to the project root. Imports use `@/components/...`, `@/lib/...`, etc.

---

## What's next (roughly)

1. Persist saved tutors against `auth.users` (or rip the feature out — only one UI surface still uses it).
2. Wire year-level chips on `/browse` into the URL + `getTutorsForBrowse()` so the filter actually narrows results.
3. Real booking flow behind the now-disabled "Request a lesson" button on `/tutor/[slug]`.
4. Reintroduce real messaging (a two-pane prototype lives in git history).
5. Student dashboard.
6. Bookings / payments.
