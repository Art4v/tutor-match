# tutormatch

A marketplace web app for finding and booking academic tutors (HSC, UCAT, LAT, SAT). Built with Next.js 14 (App Router), Tailwind CSS, and Supabase.

This README documents the current state of the project. For day-to-day contributor guidance, see [`CLAUDE.md`](./CLAUDE.md).

---

## Status at a glance

| Area | State |
| --- | --- |
| Public marketing + browse UI | ✅ Implemented (reads hardcoded data from `lib/data.js`) |
| Tutor profile page (`/tutor/[id]`) | ✅ Implemented (hardcoded data) |
| Messaging UI (`/messages`) | ✅ Implemented (simulated replies, no persistence) |
| Saved-tutors list | ✅ Implemented (in-memory only, lost on refresh) |
| Auth (signup / login) | ✅ Wired to Supabase Auth |
| Supabase schema (profiles, tutors, subjects, packages, etc.) | ✅ 3 migrations defined |
| Tutor dashboard / profile editor (`/dashboard`) | ✅ Implemented + persists to Supabase |
| Public pages reading real tutor rows from Supabase | ❌ Not yet — still on `lib/data.js` |
| Student dashboard | ❌ Not started |
| Real booking / payments | ❌ Not started |
| Tests | ❌ None configured |

---

## Tech stack

- **Framework:** Next.js 14.2 (App Router)
- **Language:** JavaScript (no TypeScript)
- **Styling:** Tailwind CSS 3.4 + inline `style={{ ... }}` for design-token-specific colors, radii, and borders
- **Backend:** Supabase (Postgres + Auth + RLS) via `@supabase/ssr` 0.5 and `@supabase/supabase-js` 2.45
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

If you skip the Supabase setup, the public pages (home, browse, profile, messages) still load — only signup, login, and the dashboard will fail at runtime.

### 3. Run

```bash
npm run dev      # http://localhost:3000
npm run build    # production build (requires the two NEXT_PUBLIC_* vars)
npm run start    # serve the production build
npm run lint     # Next's built-in ESLint
```

There are no tests configured.

---

## Routes

| Path | File | Notes |
| --- | --- | --- |
| `/` | `app/page.js` | Home: hero + search + featured tutors + how-it-works + CTA. |
| `/browse` | `app/browse/page.js` | Sidebar filters + sortable tutor grid. Reads `?q=` for search. Wrapped in `Suspense` because of `useSearchParams`. |
| `/tutor/[id]` | `app/tutor/[id]/page.js` | Public profile: banner, sections, sidebar rate card. `notFound()` if id is missing. |
| `/messages` | `app/messages/page.js` | Two-pane messaging with simulated tutor replies. Reads `?tutor=` to deep-link to a conversation. |
| `/signup`, `/login` | `app/(auth)/...` | Email + password forms sharing `app/(auth)/layout.js` (centered card). The `(auth)` route group keeps the URL paths flat. |
| `/dashboard` | `app/dashboard/page.js` | Server-rendered gate: redirects to `/login` if no session, otherwise loads `DashboardEditor` with the tutor's current row. |

---

## Project layout

```
tutor-match/
├─ app/
│  ├─ (auth)/
│  │  ├─ layout.js              # centered card layout shared by login + signup
│  │  ├─ login/page.js
│  │  └─ signup/page.js         # role chip → auth.user_metadata.{role, full_name}
│  ├─ browse/page.js
│  ├─ dashboard/
│  │  ├─ page.js                # server component; gates on auth
│  │  ├─ DashboardEditor.js     # client component; orchestrates form state + save
│  │  └─ sections.js            # all visual editor sections + form primitives
│  ├─ messages/page.js
│  ├─ tutor/[id]/page.js
│  ├─ globals.css
│  ├─ icon.svg                  # favicon
│  ├─ layout.js                 # root layout; wraps app in <SavedProvider>
│  └─ page.js                   # home
├─ components/
│  ├─ Footer.js
│  ├─ Icon.js                   # 40+ inline SVG icons; add new icons here
│  ├─ SavedContext.js           # in-memory "saved tutors" provider (no persistence)
│  ├─ TopNav.js
│  ├─ TutorCard.js              # canonical hover-animated card pattern
│  └─ ui.js                     # Avatar, VerifiedTick, OnlineDot, Chip, Button
├─ lib/
│  ├─ data.js                   # hardcoded TUTORS array (current source of truth for public pages)
│  └─ supabase/
│     ├─ client.js              # createBrowserClient — for client components
│     ├─ server.js              # createServerClient — for server components / route handlers
│     └─ tutors.js              # getTutorProfile, getTutorProfileForEditor, saveTutorProfile, getSubjectNames
├─ supabase/migrations/
│  ├─ 0001_init.sql
│  ├─ 0002_tutor_profile.sql
│  └─ 0003_tutor_dashboard.sql
├─ middleware.js                # refreshes the Supabase session cookie on every request
├─ jsconfig.json                # path alias: "@/*" → project root
├─ tailwind.config.js
├─ next.config.mjs
└─ postcss.config.js
```

The `_design/` directory contains the original HTML/CSS/JS prototype and is gitignored. Treat it as a read-only source of truth for visual decisions.

---

## Architecture notes

### Public site is still on hardcoded data

`/browse`, `/tutor/[id]`, and `/messages` read directly from the `TUTORS` array in `lib/data.js`. Supabase is not yet wired into these reads. The query helper `getTutorProfile()` in `lib/supabase/tutors.js` is defined and ready, but not yet consumed.

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
  - ordered child tables `tutor_packages`, `tutor_experience`, `tutor_education` (each with a `position` column).
  - Public-read RLS on tutor data; tutor self-write on their own rows.
- `0003_tutor_dashboard.sql` — adds the fields the dashboard editor saves:
  - renames `atar_rank` → `rank`,
  - adds `headline`, `rank_subject`, `verified`, `delivers_in_person`, `delivers_online`, `service_area` (jsonb), `verifications` (jsonb), `visibility`,
  - converts `credentials text[]` → `credentials jsonb` so each credential carries both a label and an icon name.

**Signup flow**

`app/(auth)/signup/page.js` calls:

```js
supabase.auth.signUp({
  email,
  password,
  options: { data: { full_name, role } },
});
```

The role chip (Tutor/Student) sets `role` in user metadata. The database trigger — not the client — decides which extension table to populate. **Do not insert into `profiles` or extension tables directly from the client.**

**Query helpers (`lib/supabase/tutors.js`)**

- `getTutorProfile(supabase, id)` — selects a tutor row joined with its subjects, packages, experience, and education child tables (ordered by `position`); flattens the `tutor_subjects` join so callers get `subjects: [{ id, name, slug }, ...]`. Defined but **not yet consumed** by the public pages.
- `getTutorProfileForEditor(supabase, id)` — used by the dashboard server component to hydrate the editor with the tutor's current row.
- `saveTutorProfile(...)` — persists the dashboard editor's form state.
- `getSubjectNames(...)` — for the subjects picker.

The helpers are client-agnostic — pass the appropriate client (browser vs. server) in at the call site.

### State & navigation

- `components/SavedContext.js` provides an in-memory "saved tutors" list (no persistence, no Supabase). It's consumed by `TutorCard`'s save button and the browse page. The provider sits inside `app/layout.js`.
- Navigation: `next/link` for static cases, `useRouter().push(...)` for form-submit redirects. Buttons inside cards stop event propagation (e.g. the save button on `TutorCard`) so the wrapping link doesn't fire.

### Components

- `components/ui.js` — design primitives: `Avatar`, `VerifiedTick`, `OnlineDot`, `Chip`, `Button`. Prefer extending these over inline styles when adding new UI.
- `components/Icon.js` — single-file Lucide-style SVG set (40+ icons). Add new icons here rather than pulling in an icon library.
- `components/TutorCard.js` — the canonical hover-animated card. The "How tutormatch works" cards on the home page copy this exact pattern; keep it consistent.

### Tutor dashboard (`/dashboard`)

- `app/dashboard/page.js` is a **server component**: it calls `supabase.auth.getUser()`, redirects to `/login` if there's no session, fetches the tutor row via `getTutorProfileForEditor`, then renders `DashboardEditor`.
- `app/dashboard/DashboardEditor.js` is the `"use client"` orchestrator: it owns the form state, dirty tracking, and the save flow (calls `saveTutorProfile` against the browser client).
- `app/dashboard/sections.js` contains every visual section of the editor (banner/avatar, identity, credentials, about, stats, rate, experience, education, subjects, service area, availability grid, verifications, sidebar, save bar, mobile save bar, breadcrumb) plus the shared form primitives (`Field`, etc.).
- For brand-new tutor signups, the editor falls back to a `defaultTutor()` shape since the `handle_new_user()` trigger only creates an empty row.

### Path alias

`jsconfig.json` maps `@/*` to the project root. Imports use `@/components/...`, `@/lib/...`, etc.

---

## What's next (roughly)

1. Replace `lib/data.js` reads on `/browse` and `/tutor/[id]` with `getTutorProfile()` / a new list query.
2. Persist the "saved tutors" list once a user is logged in.
3. Real messaging (currently simulated).
4. Student dashboard (the `student_profiles` table exists but has no UI).
5. Bookings / payments.
