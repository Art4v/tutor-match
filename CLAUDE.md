# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Commands

- `npm run dev` — Next.js dev server on `http://localhost:3000`.
- `npm run build` — production build; run after structural changes to confirm it compiles. Requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (placeholders are fine for a smoke test).
- `npm run start` — serve the production build.
- `npm run sync:audience` — push confirmed tutors into the Resend Audience (see Email).

No tests are configured.

## Environment

Copy `.env.example` → `.env.local` and fill in the two Supabase values (the example file's header is the canonical setup checklist). Apply every file in `supabase/migrations/` in numeric order (`0001`…`0024`) in the Supabase SQL Editor. Without Supabase configured, the public pages (`/`, `/browse`, `/tutor/[slug]`) render empty (they query at request time) and signup/login fail.

### Email

Three distinct mail paths:

1. **Auth emails (signup confirmation, password reset)** — sent **by Supabase** over **Resend custom SMTP**, configured in the Supabase dashboard (Project Settings → Authentication → SMTP Settings). **No Resend key in `.env.local`** for this path; the app sends nothing itself. `supabase/email-templates/confirm-signup.html` is the source-of-truth template (pasted into Authentication → Emails). Without a verified Resend domain the sender is `onboarding@resend.dev`, which only delivers to your own Resend account email. See the README "Configure auth email (Resend SMTP)" section.
2. **Verification flow** — the one place the **app** sends mail. `lib/email/send.js` calls the Resend **HTTP API** directly (`RESEND_API_KEY`, `EMAIL_FROM`; unset = no-op + console log) for the admin approve-link email and the tutor's notification emails.
3. **Tutor newsletters/updates** — via **Resend Broadcasts**, not the app. `npm run sync:audience` (`scripts/sync-tutors-audience.mjs`) idempotently *adds* confirmed tutors to a Resend Audience (`RESEND_AUDIENCE_ID`, `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`); never re-subscribes opt-outs. You then compose + send the Broadcast in the Resend dashboard. Bodies live in `email-updates/` as numbered HTML files (`NNNN_short-description.html`), kept in strict numeric order like migrations; each campaign takes the next number and never reorders. `email-updates/README.md` is the only unnumbered file.

## Architecture

**Stack:** Next.js 14 App Router, JavaScript (no TypeScript), Tailwind CSS. Pages under `app/`.

**Server vs client:** public pages (`/`, `/browse`, `/tutor/[slug]`) are **server components** fetching from Supabase at request time, with small client subcomponents for interactivity. Auth pages and the settings editor are client components (forms / live editing).

**Data access:** all public reads go through `lib/supabase/tutors.js` — the only path to tutor data (the old hardcoded `lib/data.js` is gone).

**Styling:** intentionally mixes Tailwind utilities (layout) with inline `style={{ … }}` (colors / radii / borders from the original design). Don't refactor inline styles into a global stylesheet without reason — they keep design tokens local. The original HTML/CSS/JS prototype lives in `_design/` (gitignored, read-only reference for visual decisions).

**Path alias:** `jsconfig.json` maps `@/*` to the project root; imports use `@/components/...`, `@/lib/...`.

### Routes

| Path | File | Notes |
| --- | --- | --- |
| `/` | `app/page.js` | Server. `getFeaturedTutors()` + `getSubjects()`. Renders `HomeHero.jsx`, featured grid, `HomeHowItWorks.jsx`, `HomeCta.jsx`. |
| `/browse` | `app/browse/page.js` | Server. Parses filters from `searchParams` (q, name, subject[], lat, lng, place, atarMin, rateMax, year[], mode[], sort, page) → `getTutorsForBrowse()`. Location is geospatial via the `tutors_within_service_radius` RPC. Sidebar `BrowseFilters.jsx` (client) calls `router.replace()` on every change — URL is the source of truth, shareable, back-button-friendly. Pagination uses real `<Link>`s. |
| `/tutor/[slug]` | `app/tutor/[slug]/page.js` | Server. `getTutorBySlug()` → camelCase object; `notFound()` if no match or visibility ≠ `public`. Client subcomponents `RateCard.jsx`, `ServiceAreaMap.jsx`. Similar-tutors sidebar = `getFeaturedTutors(supabase, 3, tutor.id)`. |
| `/settings` | `app/settings/...` | Tutor profile editor. `getTutorProfileForEditor()` / `saveTutorProfile()`. Visibility picker (new tutors default `public`). Avatar + banner uploads (Storage bucket `profile-images`). Location set by one `SuburbAutocomplete` in `ServiceAreaSection`; Suburb/City fields are a read-only reflection. **First-login gate:** `page.js` redirects to `/onboarding` when `onboarded === false`. **AI copy:** tagline + bio `RichTextField`s take an `ai` prop (sparkle button) → POST `/api/ai/generate-bio`, preview-then-accept (accept via `execCommand` so Ctrl+Z works); nothing persists until Save. **Verification:** the `Sidebar` renders `RequestVerification.jsx` above the visibility card — shows `verificationStatus` + a button (soft "complete your profile" hint under 100%, never a hard gate). |
| `/onboarding` | `app/onboarding/...` | Server `page.js` guards `getUser()` → `/login`, redirects to `/settings` if already `onboarded`. Client `OnboardingWizard.jsx`: one-question-per-step, **reuses the real settings section components** over shared `tutor`/`set` state (seeded from `defaultTutor`, exported by `SettingsEditor`). Every step has Skip / Skip everything (step 1's name is required). On Finish/Skip-everything: one `saveTutorProfile` (skipped if name blank) → `markOnboarded()` → `/settings`. Verification is **not** part of onboarding. |
| `/account` | `app/account/...` | Server `page.js` guards → `/login`, renders client `AccountSettings.jsx`. **Change password** (re-verify current via `signInWithPassword` → `updateUser`; stays logged in) and **Delete account** (type `DELETE` → `rpc("delete_own_account")` → `signOut` → home). Linked from `TopNav` dropdown. |
| `/notifications` | `app/notifications/...` | Server `page.js` guards → `/login`, fetches own RLS-scoped `notifications`, renders client `NotificationsList.jsx`. Marks arrived-unread rows read in the background (clears the `TopNav` dot). |
| `/messages` | `app/messages/page.js` | v1 stub ("coming soon"). No UI links here; full implementation is in git history. |
| `/signup`, `/login` | `app/(auth)/...` | `(auth)` route group shares the centered card in `app/(auth)/layout.js` (no URL effect). Signup POSTs `/api/auth/signup` (does **not** call `supabase.auth.signUp` client-side); live password checklist; **Tutor-only** (Student "coming soon"). Login calls `signInWithPassword` directly, links to `/forgot-password`, shows banners on `?reset=1` / `?error=oauth`. Both render `OAuthButtons.jsx` → **Continue with Google** via `signInWithOAuth({ provider: "google", redirectTo: <origin>/auth/callback?next=/settings })`. First-time OAuth user becomes a confirmed tutor via the `0016` trigger. Callback/trigger are provider-agnostic — re-adding a provider needs only another `ProviderButton`. |
| `/forgot-password`, `/reset-password` | `app/(auth)/...` | Same `(auth)` card. `/forgot-password` POSTs `/api/auth/forgot-password`, shows a neutral "if an account exists" message (no enumeration). `/reset-password` is reached **after** `/auth/callback` mints a recovery session: confirms a session exists (else "expired link"), renders the shared checklist, `updateUser({ password })` → `signOut` → `/login?reset=1`. Both use `useSearchParams` and wrap their body in `<Suspense>`. |
| `/auth/callback` | `app/auth/callback/route.js` | Server GET; landing point for all Supabase email + OAuth links. Two shapes: `token_hash`+`type` → `verifyOtp` (reset-password email; no PKCE, survives a different browser), or `code` → `exchangeCodeForSession` (PKCE; Google OAuth). Success → `next` (default `/`). Failure splits by flow: OAuth → `/login?error=oauth`, recovery → `/reset-password?error=link_invalid`. **GOTCHA:** the redirect target must be a **wildcard** entry (`<origin>/auth/callback**`) in Authentication → URL Configuration → Redirect URLs — a bare entry won't match the `?next=` query string and silently falls back to the Site URL ("link goes to the domain and does nothing"). |
| `/api/auth/signup` | `app/api/auth/signup/route.js` | `POST { fullName, email, password, role }` — authoritative signup gate. Re-validates password (`lib/password.js`), email format (`lib/email.js`), and deliverable domain (`domainCanReceiveMail`, `lib/mailDomain.js`: DNS MX → A/AAAA fallback) before `supabase.auth.signUp` server-side. Returns `{ status: "session" \| "confirm" \| "exists" }` (`exists` = user returned with empty `identities`). |
| `/api/auth/forgot-password` | `app/api/auth/forgot-password/route.js` | `POST { email }` — validates format + deliverable domain, then `resetPasswordForEmail` with `redirectTo: ${origin}/auth/callback?next=/reset-password`. Always `{ status: "sent" }` for well-formed input (no enumeration); malformed → 400. |
| `/api/geocode` | `app/api/geocode/route.js` | `GET ?q=<suburb>` → `{ lat, lng }` or nulls (single result). `lib/geocode.js` (Nominatim → Photon, in-process cache). Fallback path; primary flow is `/api/places`. |
| `/api/places` | `app/api/places/route.js` | `GET ?q=<text>` → up to 6 AU suburb matches `[{ label, suburb, state, postcode, lat, lng }]`. `lib/places.js` (Photon primary for typeahead → Nominatim fallback, cache). Powers `SuburbAutocomplete`. |
| `/api/ai/generate-bio` | `app/api/ai/generate-bio/route.js` | `runtime="nodejs"`. `POST { kind: "tagline" \| "bio", profile }` — generates copy via Groq (`lib/groq.js`, `GROQ_API_KEY`). Auth-gated (401). Allowlists + clamps `profile`, resolves subject slugs → labels server-side. Rate-limited **10/day/user** via `consume_ai_credit` (over → 429); Groq failure → 502 after `refund_ai_credit`. Returns `{ text, used, limit }`. |
| `/admin/verify` | `app/admin/verify/...` | Server `page.js`, `runtime="nodejs"`. Landing page for the admin approve link. **Login-unguarded** — the signed `?token=` (HMAC, `lib/verifyToken.js`) is the authorization. Reads the tutor via the service-role client and shows profile + `ApproveButton.jsx`. GET never mutates (email prefetch can't auto-approve); the button POSTs `/api/verification/approve`. |
| `/api/verification/request` | `app/api/verification/request/route.js` | `runtime="nodejs"`. `POST` (no body), auth-gated (401). `request_tutor_verification` RPC (`none`/`rejected` → `pending`). **Only on a real transition:** notifies the tutor and emails `ADMIN_EMAIL` a one-click approve link. Idempotent. |
| `/api/verification/approve` | `app/api/verification/approve/route.js` | `runtime="nodejs"`. `POST { token }` — **no session**; `verifyApproveToken` is the gate. Service-role client sets `verified = true` + `verification_status = 'verified'`, then `notifyUser`. Already-verified = no-op success; bad/expired token → 400. |

### Supabase data layer

**Clients:** `lib/supabase/client.js` (browser, `createBrowserClient`), `lib/supabase/server.js` (server components / routes, `createServerClient` + `cookies()`), `lib/supabase/admin.js` (server-only **service-role**, bypasses RLS — used to write notifications, read auth emails, and approve verification). `middleware.js` calls `getUser()` on every request to refresh the session cookie (matcher excludes static assets).

**Query helpers** (`lib/supabase/tutors.js`, all take a supabase client as the first arg):
- `getTutorsForBrowse(supabase, params)` — paginated `/browse` query. `params`: `{ q, name, subjectSlugs[], lat, lng, atarMin, rateMax, yearLevels[], modes, sort, page, pageSize }`; filters `visibility = 'public'`. `q` = overall search (tagline `bio`/`city`/`suburb` OR `full_name`); `name` = `full_name` only. Because `full_name` is on the joined `profiles` table, name/subject/location each **resolve to tutor ids first** (name via profiles, subjects via `tutor_subjects`, location via `tutors_within_service_radius` RPC), then intersect and apply with one `.in("id", …)` so count + pagination stay exact. **Location = in-person proximity:** geo filter is skipped when *only* online is selected; runs with `p_include_online` true only when both modes are selected, false for in-person-only / no-mode. Returns `{ tutors, total }` (each via internal `tutorRowToCard`).
- `getFeaturedTutors(supabase, limit, excludeId)` — top-N by `rating desc nulls last, review_count desc`. Used by `/` and the similar-tutors sidebar.
- `getTutorBySlug(supabase, slug)` — detail-page shape (internal `tutorRowToDetail`), normalises `availability`. Returns null if no public match.
- `getSubjects(supabase)` — exam-scoped catalog, flat, sorted by exam then subject position; rows `{ name, slug, exam, examName }`. Group with `groupByExam` (`lib/subjects.js`).
- `getTutorProfile` / `getTutorProfileForEditor` / `saveTutorProfile` — `/settings`. Editor helper returns camelCase. `saveTutorProfile` = scalar update + replace-all on the four child tables (subjects, packages, experience, education); **not transactional**.

**Rules:**
- **Never insert into `profiles` or extension tables from the client.** The `handle_new_user()` trigger reads `role` + `full_name` from `auth.users.raw_user_meta_data` and creates the matching rows on signup. The role chip only sets metadata; the trigger decides the extension table.
- **`saveTutorProfile` deliberately never writes `verified` / `verification_status`** — server-controlled; a tutor must not self-verify.
- `lib/notifications.js` `notifyUser()` is the single path that inserts a notification **and** emails the user (so "every notification is emailed" holds). `lib/verifyToken.js` signs/verifies the HMAC approve-link token (`VERIFICATION_APPROVE_SECRET`).

### Migrations (`supabase/migrations/`)

`0001_init` — Option B layout: shared `profiles` 1:1 with `auth.users`, plus `tutor_profiles` / `student_profiles` keyed by the same uuid. `handle_new_user()` trigger creates them atomically on signup. Self-only RLS.
`0002_tutor_profile` — public-profile columns on `tutor_profiles`; seeded `subjects` ref table; `tutor_subjects` join; ordered child tables `tutor_packages` / `tutor_experience` / `tutor_education` (each with `position`). Public-read RLS + tutor self-write.
`0003_tutor_dashboard` — `atar_rank`→`rank`; editor columns (`rank_subject`, `verified`, `delivers_in_person`, `delivers_online`, `service_area` jsonb, `visibility` text+CHECK); `credentials` → jsonb of `{label, icon}`. `service_area` shape `{ suburb, radiusKm, lat?, lng?, geocodedSuburb? }` (enforced in JS).
`0004_browse` — `tutor_profiles.slug` (unique) + `generate_unique_slug`; filter indexes; public-read SELECT policy on `profiles` for tutor rows (so the browse join returns names).
`0005_default_public` — `visibility` default back to `'public'`, so new signups are listed immediately.
`0006_profile_images` — Storage bucket `profile-images` for avatar + banner uploads.
`0007_email_confirmed` — `tutor_profiles.email_confirmed_at` mirrors `auth.users.email_confirmed_at` (anon role can't see the `auth` schema). Set on insert + via `on_auth_user_email_confirmed` trigger on confirmation. Public query helpers filter `email_confirmed_at IS NOT NULL` alongside `visibility = 'public'`, so unconfirmed signups never appear publicly.
`0008_service_area_geo` — lifts `service_lat` / `service_lng` / `service_radius_km` into real columns; adds `tutors_within_service_radius(lat, lng, include_online)`, a plain-SQL haversine (no PostGIS) returning ids of public+confirmed tutors whose radius covers the point, OR-ing in online tutors. `getTutorsForBrowse`'s "resolve ids first" step.
`0009_subject_catalog` — wipe-and-reseed to a 254-subject Australian catalog scoped by certificate (HSC/VCE/IB/QCE/SACE/WACE/TCE/ACT + a `TEST` group for UCAT/GAMSAT/LAT). Adds `certificates` ref table + `subjects.certificate_code` FK; **drops `subjects.name` UNIQUE** (slug stays the unique key, certificate-prefixed e.g. `vce-biology`; tests bare e.g. `ucat`). Subjects identified by **slug, not name** throughout; labelled via `subjectLabel()` (`lib/subjects.js`).
`0010_rename_certificates_to_exams` — pure rename: `certificates`→`exams`, `certificate_code`→`exam_code`. Codebase uses **"exam"** terminology from here.
`0011_year_levels_and_general` — `tutor_profiles.year_min`/`year_max` (int, CHECK 0–12 + min≤max) = year-level range; drives the `/browse` year filter + card. Adds a `GENERAL` exam group (English/Maths/Science/History/Geography, `general-*`) for pre-Year-11. Labels in `lib/yearLevels.js`.
`0012_remove_headline` — drops `headline`; the **tagline (`bio`) now owns** the one-line subtitle (shown under the name on profile + card, matched by `q`). Existing headline backfilled into empty `bio`.
`0013_slug_regen_and_race_safe` — race-safe `_assign_tutor_slug(id, name)` (retry loop on `unique_violation`); `handle_new_user()` inserts a placeholder slug then calls it. Authenticated `assign_tutor_slug(name)` RPC (scoped to `auth.uid()`) that `saveTutorProfile` calls on name change, so the slug URL doesn't go stale.
`0014_tutor_subjects_order` — `tutor_subjects.position`; the editor's `SubjectPicker` is a drag-and-drop list rewriting the slug order, persisted as sequential `position`. All reads `.order("position", …)`. Existing links backfilled alphabetically by label.
`0015_delete_own_account` — `delete_own_account()` `SECURITY DEFINER` RPC scoped to `auth.uid()`, deletes the caller's `auth.users` row (cascades through everything). Granted to `authenticated`. Known gap: `profile-images` objects are left orphaned (acceptable for v1).
`0016_oauth_default_role` — OAuth-safe `handle_new_user()`: `coalesce` defaults `v_role`→`'tutor'` and `v_name`→Google's `name` claim, so a first-time Google user is a confirmed tutor with a real name-derived slug.
`0017_full_name_not_blank` — normalises blank `full_name`→NULL, adds CHECK (`NULL OR btrim <> ''`). NULL stays allowed (OAuth without a name claim). UI + `saveTutorProfile` enforce the same earlier.
`0018_onboarded` — `tutor_profiles.onboarded` (bool, NOT NULL, default `false`) drives the `/onboarding` gate; existing rows backfilled `true`. Surfaced by `getTutorProfileForEditor`, flipped by `markOnboarded()`.
`0019_year_min_default_k` — lowers `year_min` default `7`→`0` (K), so new signups default K–12. New inserts only.
`0020_ai_usage` — `ai_usage` (PK `(user_id, day)`, `count`), self-only SELECT, no write policy. `consume_ai_credit()` — atomic conditional `UPDATE … WHERE count < limit` (limit **hardcoded 10**, not a parameter) → `(allowed, used, day_limit)`. `refund_ai_credit()` — decrement floored at 0, called only on Groq failure.
`0021_verification_and_notifications` — `verification_status` (`none`/`pending`/`verified`/`rejected`, default `none`) + `verification_requested_at`; `verified` bool stays the display flag (true **only on approval**). `notifications` table (self-only SELECT+UPDATE, **no INSERT policy** — written by service-role from routes). `request_tutor_verification()` RPC (`none`/`rejected`→`pending`, idempotent). Approval has **no RPC** (admin has no session). Verified ranking boost in `lib/ranking.js`; shown in the `/settings` checklist but **excluded from the percentage** (admin-gated). Dev shortcut: `supabase/utilities/verify_user.sql`.
`0022_education_level` — `tutor_education.level` (NOT NULL default `'high_school'`, CHECK in `{high_school, university}`). Threaded through `tutors.js`; card shows high school (falls back to university), profile `EducationTimeline` + editor `EducationSection` get a level picker.
`0023_banner_bg` — nullable `tutor_profiles.banner_bg`, decoupling the banner fallback colour from `avatar_bg` (readers fall back to `avatar_bg` when null). Renumbered from a duplicate `0014_`; additive, safe after `0022`.
`0024_hsc_english_extension_subjects` — seeds HSC English Extension 1 + 2 (`on conflict do nothing`, idempotent). Renumbered from a duplicate `0014_`; additive, safe after `0022`.

### Components

- `components/ui.js` — design primitives (`Avatar`, `VerifiedTick`, `OnlineDot`, `Chip`, `Button`). Prefer extending these over new inline styles.
- `components/Icon.js` — single-file Lucide-style SVG set (40+ icons). Add new icons here; don't import an icon library.
- `components/TutorCard.js` — canonical hover-animated card; lift driven by `motion/react` variants (`cardVariants` rest/hover), not `useState`. Other lift cards (e.g. `HomeHowItWorks.jsx`) follow the same shape. Links to `/tutor/${tutor.slug}`. Footer credentials + subject row use `CredentialChipsRow` / `SubjectChipsRow` — render chips off-screen, measure with a `ResizeObserver`, show as many as fit + a `+N` pill. **The `recalc` closure null-guards both refs internally** (not just at effect start) because the observer can fire after unmount — otherwise `containerRef.current.offsetWidth` throws.
- `components/HomeHero.jsx` / `HomeHowItWorks.jsx` / `HomeCta.jsx` — client subcomponents so `/` stays a server component. `HomeHero` builds a `/browse` query (`subject` slug, `lat`/`lng`/`place`, `year`) and `router.push`es it.
- `components/SubjectPicker.jsx` — shared exam-first picker fed by `getSubjects()` (`groupByExam`). `mode="single"` (hero/sidebar) or multi-select (editor); emits subject **slugs**, matching the `?subject=` URL contract.
- `components/ServiceMapLeaflet.jsx` — `"use client"` Leaflet map (OSM tiles, CARTO Voyager after >3 `tileerror`s). Imports `leaflet/dist/leaflet.css` and touches `window` at module init, so callers **must dynamic-import with `{ ssr: false }`** (editor does directly; tutor page via the `ServiceAreaMap.jsx` wrapper).
- `components/TopNav.js` — auth-aware: logged in → Browse/Settings/Log out collapse into a dropdown on the avatar chip; logged out → only Log in + Sign Up. `z-40` to sit above the editor's `z-30` sticky save bar.

### Maps & geocoding

- Leaflet + OpenStreetMap (no key, no account). Geocoding: **Nominatim** primary → **Photon** (Komoot, OSM) fallback. Both free, no key.
- `lib/geocode.js` `geocodeSuburb(suburb)` (single result), `lib/places.js` `searchSuburbs(q)` (typeahead — Photon primary, Nominatim fallback). Both server-only, cache in-process by lowercased query. **Keep the identifying `User-Agent` header** (Nominatim policy requires it).
- `/api/geocode` + `/api/places` are thin proxies so the client never calls Nominatim/Photon directly.
- `components/SuburbAutocomplete.jsx` — shared client picker (debounced `/api/places`, `variant="bar"` / `variant="box"`). A selected suggestion carries `{lat, lng, state}`, so the home/browse pages and `ServiceAreaSection` get coords with no second round-trip (`geocodedSuburb` is set so the fallback `/api/geocode` effect doesn't re-fire). On Save, `SettingsEditor.onSave` retries geocode only if coords are somehow missing.
- `ServiceAreaCard` on `/tutor/[slug]` renders the map **only when** `serviceArea.lat`/`lng` are present; otherwise just the "In-person within N km of <suburb>" line (no placeholder).

### State & navigation

- **`/browse` filter state lives in the URL.** `BrowseFilters.jsx` `router.replace()`s on every change; the server page re-runs the query. Repeated `subject` / `year` params encode multi-select (year as integers K=0…12). Every change drops `?page=` (resets pagination). Year filter matches when `[year_min, year_max]` covers any selected year.
- Navigation: `next/link` for static cases, `useRouter().push()` for form-submit redirects.
