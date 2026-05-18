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
| `/tutor/[slug]` | `app/tutor/[slug]/page.js` | Server component. `getTutorBySlug()` returns a UI-shaped (camelCase) object; `notFound()` if no match or visibility ≠ 'public'. Client subcomponents: `SaveButton.jsx`, `RateCard.jsx`. Similar-tutors sidebar uses `getFeaturedTutors(supabase, 3, tutor.id)`. |
| `/messages` | `app/messages/page.js` | Stub for v1 ("messaging is coming soon"). No UI links to this route — the full two-pane implementation lives in git history if/when we revive it. |
| `/signup`, `/login` | `app/(auth)/...` | Email + password forms. Use `(auth)` route group so they share `app/(auth)/layout.js` (centered card) without affecting URL paths. |
| `/dashboard` | `app/dashboard/...` | Tutor profile editor. Loads via `getTutorProfileForEditor()`, saves via `saveTutorProfile()`. Has a visibility picker — new tutors default to `unlisted` and must explicitly publish to appear on `/browse`. |

### Supabase

- **Schema** lives in `supabase/migrations/`, applied in numeric order:
  - `0001_init.sql` — Option B layout: a shared `profiles` table 1:1 with `auth.users`, plus role-specific extension tables `tutor_profiles` and `student_profiles` keyed by the same uuid. A `handle_new_user()` trigger reads `role` and `full_name` from `auth.users.raw_user_meta_data` and creates the matching `profiles` + role-specific row atomically on signup. Self-only RLS.
  - `0002_tutor_profile.sql` — expands `tutor_profiles` with the columns the public profile page needs (bio, atar, rate, availability JSONB, rating, …), adds a seeded `subjects` reference table (17 HSC/UCAT/LSAT subjects), a `tutor_subjects` join table, and ordered child tables `tutor_packages` / `tutor_experience` / `tutor_education` (each with a `position` column). Adds public-read RLS on tutor data; tutor self-write on their own rows.
  - `0003_tutor_dashboard.sql` — renames `atar_rank` → `rank`; adds dashboard-editor columns (`headline`, `rank_subject`, `verified`, `delivers_in_person`, `delivers_online`, `service_area` jsonb, `verifications` jsonb, `visibility` text with check constraint); converts `credentials` from `text[]` to `jsonb` of `{label, icon}`.
  - `0004_browse.sql` — adds `tutor_profiles.slug` (unique) plus a `generate_unique_slug(name)` helper; extends `handle_new_user()` to populate the slug on new tutor signups and backfills existing rows; changes the `visibility` default from `'public'` to `'unlisted'` so new empty profiles don't show on `/browse` until they're explicitly published; adds filter indexes on `visibility`, `city`, `atar`, `rate`; adds a second SELECT policy on `profiles` allowing public read for rows where `role = 'tutor'` (so the browse join can return tutor names).
- **Signup flow**: the form (`app/(auth)/signup/page.js`) calls `supabase.auth.signUp({ email, password, options: { data: { full_name, role } } })`. The role chip (Tutor/Student) decides which extension table gets a row — the database, not the client, makes that decision via the trigger. Do not insert into `profiles` or extension tables directly from the client; let the trigger handle it.
- **Clients**: `lib/supabase/client.js` for client components (`createBrowserClient`), `lib/supabase/server.js` for server components / route handlers (`createServerClient` wired to `cookies()`). `middleware.js` calls `supabase.auth.getUser()` on every request to refresh the session cookie — the pattern is from the official `@supabase/ssr` docs and the matcher excludes static assets.
- **Query helpers** (`lib/supabase/tutors.js`) — all take a supabase client as first arg so they work from both server and browser contexts:
  - `getTutorsForBrowse(supabase, params)` — paginated `/browse` query. `params` is `{ q, subjectSlugs[], city, atarMin, rateMax, mode, sort, page, pageSize }`. Filters by `visibility = 'public'`, joins `profiles` for `full_name`, and runs a separate subject-ids lookup when `subjectSlugs` is non-empty (two round-trips, cheap with the new index). Returns `{ tutors, total }` with each tutor mapped through the internal `tutorRowToCard` (snake_case → camelCase, derives initials from name when `initials` column is empty).
  - `getFeaturedTutors(supabase, limit, excludeId)` — top-N by `rating desc nulls last, review_count desc`. Used by `/` and the "Similar tutors" sidebar.
  - `getTutorBySlug(supabase, slug)` — full detail-page shape via internal `tutorRowToDetail`, including normalised `availability` (handles both the `{hours, days, grid}` shape and the bare 2D array the dashboard editor currently writes). Returns null if no public tutor matches.
  - `getDistinctCities(supabase)`, `getSubjects(supabase)`, `getSubjectNames(supabase)` — feed the filter sidebar and hero search dropdowns.
  - `getTutorProfile(supabase, id)`, `getTutorProfileForEditor(supabase, id)`, `saveTutorProfile(supabase, id, tutor)` — used by `/dashboard`. The editor helper returns camelCase keys matching the editor's in-memory state; `saveTutorProfile` does scalar update + replace-all on the four child tables (subjects, packages, experience, education), not transactional.

### State & navigation
- `components/SavedContext.js` provides an in-memory "saved tutors" list (no persistence) consumed by `TutorCard`'s save button and the tutor detail page's `SaveButton`. The provider sits inside `app/layout.js`. `TutorCard` reads `useSaved()` itself — the parent only opts into the save button by passing `withSave`.
- **Filter state on `/browse` lives in the URL.** `BrowseFilters.jsx` calls `router.replace()` with a new query string on every change, and the server page re-runs the Supabase query. Repeated `subject` params encode multi-select. Every filter change drops `?page=` so pagination resets.
- Navigation between pages uses `next/link` (`Link`) for static cases and `useRouter().push(...)` for form-submit redirects. Some buttons inside cards stop event propagation (e.g. the save button on `TutorCard`) so the wrapping link doesn't fire.

### Components
- `components/ui.js` exports the design primitives: `Avatar`, `VerifiedTick`, `OnlineDot`, `Chip`, `Button`. These are the building blocks used across all pages — prefer extending them over inline styles when adding new UI.
- `components/Icon.js` is a single-file Lucide-style SVG set (40+ icons). Add new icons here rather than importing an icon library; the file is intentionally self-contained.
- `components/TutorCard.js` is the canonical hover-animated card: `translateY(-2px)` + `border-color` transition driven by `useState(hover)`. Other lift-on-hover cards in the codebase (e.g. `components/HomeHowItWorks.jsx`) copy this exact pattern — keep it consistent because Tailwind's `hover:border-...` does not override the inline `style.border`, so the `useState`-driven inline style is the working approach. Cards link to `/tutor/${tutor.slug}`.
- Home-page client subcomponents (`components/HomeHero.jsx`, `HomeHowItWorks.jsx`, `HomeCta.jsx`) exist so the home page itself can stay a server component while still hosting interactive widgets (search dropdowns, hover lifts, navigation buttons).

### Path alias
`jsconfig.json` maps `@/*` to the project root. Imports use `@/components/...`, `@/lib/...`, etc.

### `_design/`
The original HTML/CSS/JS prototype bundle (with a `chat1.md` transcript) lives here for reference. It's gitignored. Treat it as read-only source-of-truth for visual decisions when something seems off in the React port.
