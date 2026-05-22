# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Next.js dev server on `http://localhost:3000`.
- `npm run build` — production build. Use this after structural changes to verify the app still compiles. The build requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to be set (placeholders are fine when smoke-testing).
- `npm run start` — serve the production build locally.
- `npm run lint` — Next's built-in ESLint.

There are no tests configured.

## Environment

Copy `.env.example` → `.env.local` and fill in the two Supabase values. The example file's header comment is the canonical setup checklist (project creation → API keys → running the SQL migrations). Apply every file in `supabase/migrations/` in numeric order in the Supabase SQL Editor — `0001_init.sql`, `0002_tutor_profile.sql`, `0003_tutor_dashboard.sql`, `0004_browse.sql`. Without Supabase set up, the public pages (`/`, `/browse`, `/tutor/[slug]`) render empty states because they query real data at request time; signup/login also fail.

## Architecture

### Big picture
- **Next.js 14 App Router + JavaScript (no TypeScript) + Tailwind CSS.** Pages live under `app/`. The public pages (`/`, `/browse`, `/tutor/[slug]`) are **server components** that fetch from Supabase at request time; small client subcomponents (search hero, hover cards, filter sidebar, rate card, save button) handle the interactive bits and are imported by the server page. Auth pages (`/signup`, `/login`) and the dashboard are client components because they're built around forms / live editing.
- **All public reads come from Supabase.** `lib/data.js` (the old hardcoded `TUTORS` array) was deleted in slice 4. Helpers in `lib/supabase/tutors.js` are the only path to tutor data.
- **Design system is inline.** The original prototype was an HTML/CSS/JS handoff (preserved in `_design/`, gitignored). Styling is intentionally a mix of Tailwind utility classes for layout and inline `style={{ ... }}` for the specific colors / radii / borders that came from the design. Don't refactor inline styles to a global stylesheet without reason — they keep the design tokens local to where they're used.

### Routes

| Path | File | Notes |
| --- | --- | --- |
| `/` | `app/page.js` | Server component. Fetches `getFeaturedTutors()` + `getSubjects()`. Renders hero search (`components/HomeHero.jsx`), featured tutor grid, how-it-works (`HomeHowItWorks.jsx`), CTA (`HomeCta.jsx`). |
| `/browse` | `app/browse/page.js` | Server component. Parses filter state from `searchParams` (q, subject[], city, atarMin, rateMax, mode, sort, page) and calls `getTutorsForBrowse()`. Sidebar is `app/browse/BrowseFilters.jsx` (client) — every filter change calls `router.replace()` with a new query string, so the URL is the source of truth and is shareable / back-button-friendly. Pagination uses real `<Link>`s. |
| `/tutor/[slug]` | `app/tutor/[slug]/page.js` | Server component. `getTutorBySlug()` returns a UI-shaped (camelCase) object; `notFound()` if no match or visibility ≠ 'public'. Client subcomponents: `RateCard.jsx`, `SaveButton.jsx` (only in the mobile sticky bar), `ServiceAreaMap.jsx` (dynamic-imports the Leaflet map). Similar-tutors sidebar uses `getFeaturedTutors(supabase, 3, tutor.id)`. |
| `/messages` | `app/messages/page.js` | Stub for v1 ("messaging is coming soon"). No UI links to this route — the full two-pane implementation lives in git history if/when we revive it. |
| `/signup`, `/login` | `app/(auth)/...` | Email + password forms. Use `(auth)` route group so they share `app/(auth)/layout.js` (centered card) without affecting URL paths. |
| `/dashboard` | `app/dashboard/...` | Tutor profile editor. Loads via `getTutorProfileForEditor()`, saves via `saveTutorProfile()`. Has a visibility picker — new tutors default to `public` (set by the `tutor_profiles.visibility` column default; was `unlisted` between migrations `0004` and `0005`). On save, `DashboardEditor` does a last-chance geocode (`/api/geocode`) for the Service area suburb when the editor's debounced geocode hasn't fired yet. |
| `/api/geocode` | `app/api/geocode/route.js` | Server route. `GET ?q=<suburb>` returns `{ lat, lng } \| { lat: null, lng: null }`. Backed by `lib/geocode.js` (Nominatim → Photon fallback, in-process cache). Called from `ServiceAreaSection` (debounced as the tutor types) and from `onSave`. |

### Supabase

- **Schema** lives in `supabase/migrations/`, applied in numeric order:
  - `0001_init.sql` — Option B layout: a shared `profiles` table 1:1 with `auth.users`, plus role-specific extension tables `tutor_profiles` and `student_profiles` keyed by the same uuid. A `handle_new_user()` trigger reads `role` and `full_name` from `auth.users.raw_user_meta_data` and creates the matching `profiles` + role-specific row atomically on signup. Self-only RLS.
  - `0002_tutor_profile.sql` — expands `tutor_profiles` with the columns the public profile page needs (bio, atar, rate, availability JSONB, rating, …), adds a seeded `subjects` reference table (17 HSC/UCAT/LSAT subjects), a `tutor_subjects` join table, and ordered child tables `tutor_packages` / `tutor_experience` / `tutor_education` (each with a `position` column). Adds public-read RLS on tutor data; tutor self-write on their own rows.
  - `0003_tutor_dashboard.sql` — renames `atar_rank` → `rank`; adds dashboard-editor columns (`headline`, `rank_subject`, `verified`, `delivers_in_person`, `delivers_online`, `service_area` jsonb, `verifications` jsonb, `visibility` text with check constraint); converts `credentials` from `text[]` to `jsonb` of `{label, icon}`. `service_area` JSONB shape is `{ suburb, radiusKm, lat?, lng?, geocodedSuburb? }` — `lat`/`lng` are populated by the geocoder, `geocodedSuburb` is the suburb string those coords came from so the editor knows when to re-geocode. The DB column itself stays untyped JSONB; the shape is enforced in JS.
  - `0004_browse.sql` — adds `tutor_profiles.slug` (unique) plus a `generate_unique_slug(name)` helper; extends `handle_new_user()` to populate the slug on new tutor signups and backfills existing rows; changes the `visibility` default from `'public'` to `'unlisted'` (later reverted in `0005`); adds filter indexes on `visibility`, `city`, `atar`, `rate`; adds a second SELECT policy on `profiles` allowing public read for rows where `role = 'tutor'` (so the browse join can return tutor names).
  - `0005_default_public.sql` — reverses step 5 of `0004`: sets the `tutor_profiles.visibility` default back to `'public'`, so new tutor signups are listed on `/browse` as soon as `handle_new_user()` creates the row. Existing rows are left untouched (optional commented backfill for leftover `'unlisted'` rows).
- **Signup flow**: the form (`app/(auth)/signup/page.js`) calls `supabase.auth.signUp({ email, password, options: { data: { full_name, role } } })`. The role chip (Tutor/Student) decides which extension table gets a row — the database, not the client, makes that decision via the trigger. Do not insert into `profiles` or extension tables directly from the client; let the trigger handle it.
- **Clients**: `lib/supabase/client.js` for client components (`createBrowserClient`), `lib/supabase/server.js` for server components / route handlers (`createServerClient` wired to `cookies()`). `middleware.js` calls `supabase.auth.getUser()` on every request to refresh the session cookie — the pattern is from the official `@supabase/ssr` docs and the matcher excludes static assets.
- **Query helpers** (`lib/supabase/tutors.js`) — all take a supabase client as first arg so they work from both server and browser contexts:
  - `getTutorsForBrowse(supabase, params)` — paginated `/browse` query. `params` is `{ q, subjectSlugs[], city, atarMin, rateMax, mode, sort, page, pageSize }`. Filters by `visibility = 'public'`, joins `profiles` for `full_name`, and runs a separate subject-ids lookup when `subjectSlugs` is non-empty (two round-trips, cheap with the new index). Returns `{ tutors, total }` with each tutor mapped through the internal `tutorRowToCard` (snake_case → camelCase, derives initials from name when `initials` column is empty).
  - `getFeaturedTutors(supabase, limit, excludeId)` — top-N by `rating desc nulls last, review_count desc`. Used by `/` and the "Similar tutors" sidebar.
  - `getTutorBySlug(supabase, slug)` — full detail-page shape via internal `tutorRowToDetail`, including normalised `availability` (handles both the `{hours, days, grid}` shape and the bare 2D array the dashboard editor currently writes). Returns null if no public tutor matches.
  - `getDistinctCities(supabase)`, `getSubjects(supabase)`, `getSubjectNames(supabase)` — feed the filter sidebar and hero search dropdowns.
  - `getTutorProfile(supabase, id)`, `getTutorProfileForEditor(supabase, id)`, `saveTutorProfile(supabase, id, tutor)` — used by `/dashboard`. The editor helper returns camelCase keys matching the editor's in-memory state; `saveTutorProfile` does scalar update + replace-all on the four child tables (subjects, packages, experience, education), not transactional.

### State & navigation
- `components/SavedContext.js` provides an in-memory "saved tutors" list (no persistence). It's only consumed by the mobile sticky `SaveButton` on `/tutor/[slug]` — `TutorCard` no longer renders a save button, and the desktop tutor banner doesn't either. The provider sits inside `app/layout.js`. Worth ripping out entirely when the save-tutors feature is either implemented for real or formally dropped.
- **Filter state on `/browse` lives in the URL.** `BrowseFilters.jsx` calls `router.replace()` with a new query string on every change, and the server page re-runs the Supabase query. Repeated `subject` params encode multi-select. Every filter change drops `?page=` so pagination resets. The "Year level" filter is multi-select but currently local state only — it doesn't write to the URL or feed `getTutorsForBrowse()` yet.
- `components/TopNav.js` is auth-aware: when a session is active, the right-hand side collapses Browse + Dashboard + Log out into a single dropdown anchored to the user's avatar chip; when logged out, only Log in + Sign Up render (no Browse link). The navbar is `z-40` to sit above the dashboard's own `z-30` sticky save bar.
- Navigation between pages uses `next/link` (`Link`) for static cases and `useRouter().push(...)` for form-submit redirects.

### Components
- `components/ui.js` exports the design primitives: `Avatar`, `VerifiedTick`, `OnlineDot`, `Chip`, `Button`. These are the building blocks used across all pages — prefer extending them over inline styles when adding new UI.
- `components/Icon.js` is a single-file Lucide-style SVG set (40+ icons). Add new icons here rather than importing an icon library; the file is intentionally self-contained.
- `components/TutorCard.js` is the canonical hover-animated card: `translateY(-2px)` + `border-color` transition driven by `useState(hover)`. Other lift-on-hover cards in the codebase (e.g. `components/HomeHowItWorks.jsx`) copy this exact pattern — keep it consistent because Tailwind's `hover:border-...` does not override the inline `style.border`, so the `useState`-driven inline style is the working approach. Cards link to `/tutor/${tutor.slug}`.
- Home-page client subcomponents (`components/HomeHero.jsx`, `HomeHowItWorks.jsx`, `HomeCta.jsx`) exist so the home page itself can stay a server component while still hosting interactive widgets (search dropdowns, hover lifts, navigation buttons).
- `components/ServiceMapLeaflet.jsx` is a `"use client"` Leaflet map (OSM tiles by default, CARTO Voyager swapped in after >3 `tileerror` events). It imports `leaflet/dist/leaflet.css` and touches `window` at module init, so callers **must** dynamic-import it with `{ ssr: false }`. The dashboard editor (`app/dashboard/sections.js`) imports it directly via `next/dynamic`; the server tutor page imports it through the thin `app/tutor/[slug]/ServiceAreaMap.jsx` client wrapper.

### Maps and geocoding
- Service area is rendered as a real Leaflet + OpenStreetMap map (no API key, no account). Geocoding uses **Nominatim** as the primary provider, falling back to **Photon** (Komoot, also OSM-based) on failure / rate-limit. Both are public, free, no key.
- `lib/geocode.js` exposes `geocodeSuburb(suburb)` (server-only). Nominatim's public usage policy requires an identifying `User-Agent` header — keep that intact if you refactor. Results are cached in-process by lowercased suburb.
- `app/api/geocode/route.js` is the thin proxy so the client editor never calls Nominatim directly (avoids CORS/UA-policy issues).
- `ServiceAreaSection` (`app/dashboard/sections.js`) debounces the base-suburb input 600ms then hits `/api/geocode` and writes `{ lat, lng, geocodedSuburb }` into `tutor.serviceArea`. On Save, `DashboardEditor.onSave` retries the geocode if the stored coords are stale, so the saved row always has the freshest coords we can resolve.
- `ServiceAreaCard` on `/tutor/[slug]` renders the Leaflet map **only when** `serviceArea.lat` and `serviceArea.lng` are present; otherwise it hides the map block entirely and shows just the "In-person within N km of <suburb>" text line. There is no SVG placeholder on the public page.

### Path alias
`jsconfig.json` maps `@/*` to the project root. Imports use `@/components/...`, `@/lib/...`, etc.

### `_design/`
The original HTML/CSS/JS prototype bundle (with a `chat1.md` transcript) lives here for reference. It's gitignored. Treat it as read-only source-of-truth for visual decisions when something seems off in the React port.
