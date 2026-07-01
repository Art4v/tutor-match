# matchtutor

A marketplace web app for finding and booking academic tutors across Australian senior-secondary exams (HSC, VCE, IB, QCE, SACE, WACE, TCE, ACT) and admissions tests (UCAT, GAMSAT, LAT). Live at **[matchtutor.com.au](https://matchtutor.com.au)**.

Built with Next.js 14 (App Router), Tailwind CSS, and Supabase. For contributor-level detail — naming conventions, architectural rules, query-helper shapes — see [`CLAUDE.md`](./CLAUDE.md).

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 14.2 (App Router), React 18.3 |
| Language | JavaScript (no TypeScript) |
| Styling | Tailwind CSS 3.4 + inline `style={{ }}` for design tokens |
| Animation | `motion` 11 (Framer Motion) + `lenis` smooth scroll |
| Backend | Supabase (Postgres + Auth + RLS) via `@supabase/ssr` 0.5 + `@supabase/supabase-js` 2.45 |
| Maps | `leaflet` 1.9 + `react-leaflet` 4.2 — OpenStreetMap tiles (CARTO fallback), no key |
| Geocoding | Nominatim primary, Photon (Komoot) fallback — no keys |
| Image crop | `react-easy-crop` for avatar/banner uploads |
| Icons | Self-contained Lucide-style SVG set in `components/Icon.js` |

---

## How it fits together

Public pages are **server components** that query Supabase at request time through `lib/supabase/tutors.js`. Interactive bits (search, filters, editor, maps) are small **client components**. There is no in-memory data fallback — empty DB renders empty states.

```mermaid
graph LR
    Browser["Browser"]
    MW["middleware.js<br/>refresh session cookie"]

    subgraph Pages["app/ (server components)"]
        Home["/"]
        Browse["/browse"]
        Profile["/tutor/[slug]"]
        Settings["/settings"]
    end

    subgraph Helpers["lib/supabase/tutors.js"]
        H1["getTutorsForBrowse"]
        H2["getFeaturedTutors"]
        H3["getTutorBySlug"]
        H4["getSubjects"]
        H5["save/getProfile"]
    end

    subgraph API["app/api/*"]
        Places["/api/places"]
        Geocode["/api/geocode"]
        Signup["/api/auth/signup"]
    end

    Supabase[("Supabase<br/>Postgres + Auth + RLS + Storage")]
    Geo["Nominatim / Photon"]

    Browser --> MW --> Pages
    Pages --> Helpers --> Supabase
    Browser -->|typeahead| Places --> Geo
    Browser -->|fallback| Geocode --> Geo
    Browser -->|POST signup| Signup --> Supabase
```

### Request → data flow on `/browse`

URL query string is the single source of truth for filter state, so every result page is shareable and back-button-friendly.

```mermaid
sequenceDiagram
    participant U as User
    participant F as BrowseFilters.jsx (client)
    participant P as /browse page.js (server)
    participant Q as getTutorsForBrowse()
    participant DB as Supabase

    U->>F: change a filter
    F->>F: router.replace(?q&subject&lat&lng&year…)
    F->>P: re-render with new searchParams
    P->>Q: { q, name, subjectSlugs, lat/lng, atarMin, rateMax, yearLevels, modes, sort, page }
    Q->>DB: resolve subject / location (RPC) / name → id sets
    Q->>DB: intersect ids → one .in("id", …) + count
    DB-->>Q: rows + total
    Q-->>P: { tutors, total }
    P-->>U: server-rendered results grid
```

### Auth flows

```mermaid
graph TD
    subgraph Email["Email + password"]
        S1["/signup form"] -->|POST| S2["/api/auth/signup<br/>password + email-domain (MX) check"]
        S2 -->|auth.signUp| S3[("auth.users")]
        S3 -->|handle_new_user trigger| S4["profiles + tutor_profiles + slug"]
        S3 -->|confirm email link| S5["/auth/callback<br/>verifyOtp (signup) + welcome"]
        S5 --> S6["/settings"]
    end

    subgraph OAuth["Google OAuth (PKCE)"]
        O1["Continue with Google"] -->|signInWithOAuth| O2["Google consent"]
        O2 -->|?code=| O3["/auth/callback<br/>exchangeCodeForSession + welcome"]
        O3 --> O4["/settings"]
    end

    subgraph Reset["Password reset"]
        R1["/forgot-password"] -->|POST| R2["/api/auth/forgot-password<br/>resetPasswordForEmail"]
        R2 -->|email link| R3["/auth/callback<br/>verifyOtp (recovery)"]
        R3 --> R4["/reset-password → /login?reset=1"]
    end
```

### Tutor verification pipeline

A tutor requests verification; the admin approves via a signed email link (no admin login). Every notification is **both** an in-app row and an email, funnelled through `lib/notifications.js → notifyUser()` using the service-role client (the `notifications` table has no INSERT RLS policy).

```mermaid
sequenceDiagram
    participant T as Tutor (/settings)
    participant RQ as /api/verification/request
    participant DB as Supabase
    participant N as notifyUser() (service-role)
    participant A as Admin (email)
    participant AP as /api/verification/approve

    T->>RQ: POST (auth-gated)
    RQ->>DB: request_tutor_verification() RPC → status 'pending'
    RQ->>N: notify tutor ("request received")
    RQ->>A: email approve link (HMAC token, lib/verifyToken.js)
    A->>AP: open /admin/verify?token → click Approve (POST { token })
    AP->>DB: verify token → set verification_status = 'verified'
    AP->>N: notify tutor ("you're verified ✓")
    N-->>T: in-app notification + email
```

### Emailing all tutors (Resend Broadcasts)

Product updates go out via **Resend Broadcasts**, not the app. `npm run sync:audience` reconciles a Resend Audience with the live tutor list; you compose + send from the Resend dashboard. Email bodies live in `email-updates/` as numbered HTML files (see that folder's `README.md`).

```mermaid
graph LR
    Script["npm run sync:audience<br/>scripts/sync-tutors-audience.mjs"]
    DB[("Supabase<br/>confirmed tutors")]
    Aud["Resend Audience<br/>(contacts)"]
    BC["Resend Broadcasts<br/>compose + send"]
    HTML["email-updates/NNNN_*.html"]

    Script -->|service-role read| DB
    Script -->|create missing contacts only<br/>preserves opt-outs| Aud
    HTML -.paste.-> BC
    Aud --> BC --> Tutors["All tutors"]
```

---

## Project layout

```mermaid
graph TD
    root["tutor-match/"]

    root --> app["app/"]
    root --> comp["components/"]
    root --> lib["lib/"]
    root --> sb["supabase/"]
    root --> scripts["scripts/ — sync-tutors-audience.mjs"]
    root --> emails["email-updates/ — NNNN_*.html broadcasts + README"]
    root --> mw["middleware.js<br/>jsconfig.json · *.config.*"]

    app --> auth["(auth)/ — login · signup ·<br/>forgot-password · reset-password"]
    app --> apidir["api/ — auth/* · places · geocode ·<br/>ai/generate-bio · verification/{request,approve}"]
    app --> callback["auth/callback/ — OAuth + recovery landing"]
    app --> browse["browse/ — page + BrowseFilters + ResultsGrid"]
    app --> tutor["tutor/[slug]/ — page + Rate/About/Availability/<br/>Service-area/Education/Experience cards"]
    app --> settings["settings/ — page · SettingsEditor · sections"]
    app --> onboard["onboarding/ — first-login wizard"]
    app --> account["account/ — change password · delete account"]
    app --> notif["notifications/ — list + mark-read"]
    app --> admin["admin/verify/ — approve-link landing"]
    app --> pages["page.js (home) · layout.js · messages/"]

    comp --> ui["ui.js · Icon.js · TopNav · Footer · TutorCard"]
    comp --> home["HomeHero · HomeFeaturedTutors · HomeHowItWorks · HomeCta"]
    comp --> pick["SubjectPicker · SuburbAutocomplete · OAuthButtons · PasswordChecklist"]
    comp --> media["ServiceMapLeaflet · ImageCropModal · RichText · anim/*"]
    comp --> vnotif["RequestVerification · NotificationsList"]

    lib --> data["supabase/ — client · server · admin · storage · tutors"]
    lib --> dom["password · email · mailDomain · subjects · yearLevels · availability · ranking"]
    lib --> loc["places · geocode · richText · motion · groq"]
    lib --> mail["email/send · notifications · verifyToken"]

    sb --> migr["migrations/ — 0001 … 0024"]
    sb --> tmpl["email-templates/ — confirm-signup · reset-password"]
    sb --> util["utilities/ — verify_user (dev)"]
    sb --> reset["reset/ — data_reset · delete_user (dev only)"]
```

`_design/` holds the original HTML/CSS/JS prototype (gitignored) — treat it as the read-only source of truth for visual decisions.

---

## Routes

| Path | File | Notes |
| --- | --- | --- |
| `/` | `app/page.js` | Server. Hero search, featured tutors, how-it-works, CTA. |
| `/browse` | `app/browse/page.js` | Server. Filter state parsed from `searchParams`; `getTutorsForBrowse()`. Geospatial location via `tutors_within_service_radius` RPC. Sidebar rewrites the URL on every change. |
| `/tutor/[slug]` | `app/tutor/[slug]/page.js` | Public profile via `getTutorBySlug()`; `notFound()` unless `visibility = 'public'`. Leaflet service-area map when coords exist. |
| `/settings` | `app/settings/page.js` | Tutor profile editor. Redirects to `/login` if unauthenticated, or `/onboarding` if not yet onboarded. Avatar + banner uploads, drag-to-order subjects, live card preview, AI bio copy, request-verification card, high-school/university education picker. |
| `/onboarding` | `app/onboarding/page.js` | First-login one-question-per-step wizard that reuses the real `/settings` section components. Redirects to `/settings` once `onboarded`. Saves once on finish, then `markOnboarded()`. |
| `/account` | `app/account/page.js` | Change password (re-verifies current) + delete account (`delete_own_account` RPC). |
| `/notifications` | `app/notifications/page.js` | The user's notifications (verification request sent / approved). Marks unread rows read on view. |
| `/admin/verify` | `app/admin/verify/page.js` | Approve-link landing page (no login — a signed `?token=` is the authorization). Shows the tutor + an Approve button. |
| `/signup`, `/login` | `app/(auth)/…` | Email + password forms + Google OAuth. Tutor-only (Student "coming soon"). |
| `/forgot-password`, `/reset-password` | `app/(auth)/…` | Password recovery (no email enumeration). |
| `/auth/callback` | `app/auth/callback/route.js` | Landing for OAuth (`?code=` → `exchangeCodeForSession`), signup confirmation (`token_hash`/`type=signup` → `verifyOtp`, lands at `/settings`), and recovery (`token_hash`/`type=recovery` → `verifyOtp`). Sends the one-time welcome notification + email on OAuth + signup confirmation (idempotent; not on recovery). |
| `/api/auth/signup` | route | `POST { fullName, email, password, role }` — re-validates password + email domain (MX/A lookup) then `auth.signUp`. Returns `session \| confirm \| exists`. |
| `/api/auth/forgot-password` | route | `POST { email }` → `resetPasswordForEmail`. Always neutral response. |
| `/api/places` | route | `GET ?q` → up to 6 AU suburb matches `{ label, suburb, state, postcode, lat, lng }` (Photon → Nominatim). Primary location path. |
| `/api/geocode` | route | `GET ?q` → `{ lat, lng }` single result (Nominatim → Photon). Fallback path. |
| `/api/ai/generate-bio` | route | `POST { kind, profile }` → AI tagline/long-bio copy via Groq. Auth-gated, 10/day per user (`consume_ai_credit` RPC). |
| `/api/verification/request` | route | `POST` — auth-gated. Flips the tutor to `pending` (`request_tutor_verification` RPC), emails the admin an approve link + notifies the tutor. Idempotent. |
| `/api/verification/approve` | route | `POST { token }` — no session; the signed token is the gate. Sets `verified`, notifies the tutor. |
| `/messages` | `app/messages/page.js` | Stub ("coming soon"); not linked from nav. |

---

## Getting started

### 1. Install

```bash
npm install
```

### 2. Configure Supabase

1. Create a project at <https://supabase.com>.
2. Copy `.env.example` → `.env.local` and set:
   - `NEXT_PUBLIC_SUPABASE_URL` — Project Settings → API → Project URL.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the `anon public` key. **Not** the `service_role` key (it bypasses RLS).
3. Run every file in `supabase/migrations/` (`0001`–`0024`) **in numeric order** in the SQL Editor — they build the schema below incrementally.

Without Supabase configured, public pages render empty states and signup/login fail.

### 3. Configure auth email (Resend SMTP)

Confirmation/recovery emails are sent **by Supabase over Resend custom SMTP** — there is no Resend key in `.env.local` (the app never sends mail itself). This replaces Supabase's built-in sender (~2/hr, poor deliverability).

1. Create a [Resend](https://resend.com) API key (`re_…`).
2. Supabase → **Project Settings → Authentication → SMTP Settings** → enable Custom SMTP: host `smtp.resend.com`, port `465`/`587`, username `resend`, password = the key. Sender `onboarding@resend.dev` until a domain is verified.
3. **Authentication → Emails** → paste `supabase/email-templates/confirm-signup.html` (Confirm signup) and `reset-password.html` (Reset Password). Re-paste after any edit — Supabase renders the live copy. The confirm-signup link routes through `<origin>/auth/callback?next=/settings&token_hash=…&type=signup` (mirroring recovery), so confirmation logs the user in at `/settings` and triggers the one-time welcome email + notification.
4. **Authentication → Rate Limits** → raise emails/hour above 2.
5. **Authentication → URL Configuration** → set **Site URL** to the live domain, and add **wildcard** Redirect URLs for every origin: `https://matchtutor.com.au/auth/callback**` and `http://localhost:3000/auth/callback**`. The `**` is required — the `?next=…` query string won't match a bare entry, and a failed match silently falls back to the Site URL.

With no verified domain, `onboarding@resend.dev` only delivers to your own Resend account email — sign up with that address when testing. Going live: verify a domain (SPF/DKIM/DMARC) in Resend, then set the Sender to e.g. `noreply@matchtutor.com.au`.

### 4. Configure Google OAuth

The OAuth client secret lives in the Supabase dashboard, not `.env.local` — the app only calls `supabase.auth.signInWithOAuth`.

1. **Google Cloud Console → Credentials → OAuth client ID → Web application**. Authorized redirect URI = your Supabase callback `https://YOUR-REF.supabase.co/auth/v1/callback`. Copy the Client ID + secret.
2. **Supabase → Authentication → Providers → Google** → enable and paste them.
3. Ensure the wildcard Redirect URLs from step 3 cover `<origin>/auth/callback**`.

A first-time Google user carries no `role` metadata, so the `handle_new_user()` trigger (`0016`) defaults them to a confirmed tutor and takes their name from Google's `name` claim.

### 5. Configure AI profile copy (Groq) — optional

`/settings → About` can AI-generate a tutor's **tagline** and **long bio** from their own profile data. It runs **server-side only** through [Groq Cloud](https://console.groq.com).

1. Create a Groq API key at **console.groq.com → API Keys**.
2. Set `GROQ_API_KEY` in `.env.local` (a server secret — **no** `NEXT_PUBLIC_` prefix, never shipped to the browser). Optionally override `GROQ_MODEL` (defaults to `llama-3.3-70b-versatile`).
3. Each tutor is capped at **10 generations/day**, enforced by the `consume_ai_credit` RPC in migration `0020` (so the limit holds across serverless instances). A failed Groq call refunds the credit.

Leaving `GROQ_API_KEY` unset simply disables the feature — the button surfaces an error instead of generating.

### 6. Configure tutor verification — optional

Tutors can request a **verified badge** from `/settings` (sidebar) or the final `/onboarding` step. The request emails the admin a one-click approve link; approving flips the badge on and ranks that tutor above unverified ones. Both "request sent" and "approved" appear on `/notifications` and are emailed to the tutor.

This is the one place the **app itself** sends mail (separate from the Supabase auth SMTP above). Set these **server-only** vars in `.env.local`:

1. `RESEND_API_KEY` — a [Resend](https://resend.com) API key (`re_…`). The app calls Resend's HTTP API directly. **Leaving it unset disables sending** — emails are logged to the server console instead, so the flow still works end-to-end locally.
2. `EMAIL_FROM` — the From address (e.g. `matchtutor <noreply@yourdomain.com>`). Must be on a **verified Resend domain** or Resend only delivers to your own account email.
3. `ADMIN_EMAIL` — where verification requests land (defaults to `matchtutoraustralia@gmail.com`).
4. `SUPABASE_SERVICE_ROLE_KEY` — **Project Settings → API → service_role key**. Bypasses RLS; used server-side only to write notifications and to approve (the admin has no session when clicking the email link). **Never expose it.**
5. `VERIFICATION_APPROVE_SECRET` — any long random string (`openssl rand -hex 32`). Signs the approve link's HMAC token.

Apply migration `0021_verification_and_notifications.sql`. Dev shortcut: `supabase/utilities/verify_user.sql` flips one tutor verified by id without the email round-trip.

### 7. Email all tutors (Resend Broadcasts) — optional

Send product updates/newsletters to every tutor via **Resend Broadcasts**. The app only owns a sync that pushes current tutors into a Resend Audience; you compose + send from the Resend dashboard. Email bodies live in `email-updates/` as numbered HTML files (`NNNN_short-description.html`, kept in order like migrations).

1. **Resend → Audience** — Resend gives you one default audience automatically. `RESEND_AUDIENCE_ID` is **optional** — leave it blank and the sync auto-detects the single audience; set it only if you have several.
2. `RESEND_AUDIENCE_API_KEY` — managing contacts needs a **full-access** Resend key (the sending-only `RESEND_API_KEY` returns 401). Resend → API Keys → create one with **Full access**. (If `RESEND_API_KEY` already has full access, the sync falls back to it.)
3. Run `npm run sync:audience` — adds every confirmed tutor as a contact. Idempotent, and it only *adds* missing contacts, so re-running never re-subscribes anyone who unsubscribed in Resend.
4. **Resend → Broadcasts → New** → pick the audience → paste the HTML from `email-updates/` → send a test → send. See `email-updates/README.md` for the full walkthrough.

Broadcasts only deliver to arbitrary recipients from a **verified domain** `From` (same caveat as step 3). Resend appends the required unsubscribe footer automatically.

### 8. Run

```bash
npm run dev      # http://localhost:3000
npm run build    # production build (needs the two NEXT_PUBLIC_* vars; placeholders OK for smoke tests)
npm run start    # serve the production build
```

No tests are configured.

---

## Database schema

**Option B layout:** a shared `profiles` row (1:1 with `auth.users`) plus a role-specific extension table keyed by the same uuid. A `handle_new_user()` trigger creates the matching rows on signup. Public reads are gated on `visibility = 'public'` **and** a non-null `email_confirmed_at`. RLS is self-write everywhere, public-read on tutor + catalog data.

```mermaid
erDiagram
    auth_users ||--|| profiles : "id (trigger)"
    profiles ||--o| tutor_profiles : "id"
    profiles ||--o| student_profiles : "id"
    exams ||--o{ subjects : "exam_code"
    tutor_profiles ||--o{ tutor_subjects : "tutor_id"
    subjects ||--o{ tutor_subjects : "subject_id"
    tutor_profiles ||--o{ tutor_packages : "tutor_id"
    tutor_profiles ||--o{ tutor_experience : "tutor_id"
    tutor_profiles ||--o{ tutor_education : "tutor_id"
    auth_users ||--o{ notifications : "user_id"
    auth_users ||--o{ ai_usage : "user_id"

    auth_users {
        uuid id PK
        text email
        timestamptz email_confirmed_at
        jsonb raw_user_meta_data "role + full_name / name"
    }
    profiles {
        uuid id PK,FK "→ auth.users"
        user_role role "tutor | student"
        text full_name "CHECK not blank"
    }
    tutor_profiles {
        uuid id PK,FK "→ profiles"
        text slug UK "name-derived, race-safe"
        text visibility "public | unlisted"
        timestamptz email_confirmed_at "mirror of auth.users"
        text bio "tagline + bio_long"
        numeric atar
        text rank "+ rank_subject"
        int rate
        int year_min "0–12"
        int year_max "0–12"
        bool delivers_in_person
        bool delivers_online
        numeric service_lat
        numeric service_lng
        int service_radius_km
        jsonb service_area
        jsonb credentials "{label, icon}[]"
        jsonb availability
        text avatar_url "+ banner_url"
        text avatar_bg "+ banner_bg"
        numeric rating "+ review_count"
        bool verified "set on approval only"
        text verification_status "none|pending|verified|rejected"
        bool onboarded
    }
    student_profiles {
        uuid id PK,FK "→ profiles"
    }
    exams {
        text code PK "HSC | VCE | TEST | GENERAL …"
        text name
        text jurisdiction
        int position
    }
    subjects {
        uuid id PK
        text slug UK "exam-prefixed, e.g. vce-biology"
        text name
        text exam_code FK "→ exams"
        int position
    }
    tutor_subjects {
        uuid tutor_id PK_FK
        uuid subject_id PK_FK
        int position "drag-to-order"
    }
    tutor_packages {
        uuid id PK
        uuid tutor_id FK
        text label
        int price
        int position
    }
    tutor_experience {
        uuid id PK
        uuid tutor_id FK
        text role
        text org
        int position
    }
    tutor_education {
        uuid id PK
        uuid tutor_id FK
        text school
        text detail
        text level "high_school | university"
        int position
    }
    notifications {
        uuid id PK
        uuid user_id FK "→ auth.users"
        text type
        text title
        text body
        bool read
        timestamptz created_at
    }
    ai_usage {
        uuid user_id PK "→ auth.users"
        date day PK
        int count "≤ 10 / UTC-day"
    }
```

**Key DB functions** (all `SECURITY DEFINER` RPCs scoped to `auth.uid()` unless noted): `handle_new_user()` (signup trigger — OAuth-safe, defaults role to tutor), `tutors_within_service_radius(lat, lng, include_online)` (haversine RPC for location search), `assign_tutor_slug(name)` (race-safe slug regen on rename), `delete_own_account()`, `request_tutor_verification()` (flips `none`/`rejected` → `pending`), `consume_ai_credit()` / `refund_ai_credit()` (atomic 10/day AI cap). Approval has no RPC — it runs through the service-role client because the admin has no session when clicking the email link. Plus a public `profile-images` Storage bucket (owner-scoped RLS) for avatar/banner uploads.

The schema is built incrementally by the ordered files in `supabase/migrations/` (`0001`–`0024`) — apply them all in numeric order; each new migration takes the next sequential number (no reuse), like `email-updates/`. `supabase/utilities/` has dev shortcuts (e.g. `verify_user.sql`) and `supabase/reset/` holds dev-only destructive scripts.

---

## Architecture notes

### Styling

A deliberate mix of **Tailwind utilities** for layout and **inline `style={{ }}`** for the specific colors/radii/borders from the design — keeping design tokens local to where they're used. Card hover-lift is driven by `motion/react` variants (Tailwind `hover:` can't override an inline `style.border`). Don't refactor inline styles into a global stylesheet without a reason.

### Supabase clients

- `lib/supabase/client.js` — `createBrowserClient` for client components.
- `lib/supabase/server.js` — `createServerClient` wired to `cookies()` for server components / route handlers.
- `lib/supabase/admin.js` — **server-only** `service_role` client (bypasses RLS). Used only where no user session exists: writing `notifications`, reading user emails (`auth.admin.getUserById`), approving verification, and the broadcast sync. Returns `null` when the key is unset so callers degrade gracefully.
- `middleware.js` — calls `getUser()` on every request to refresh the session cookie (official `@supabase/ssr` pattern; matcher excludes static assets).

### Verification, notifications & email

`lib/notifications.js → notifyUser()` is the single path for user notifications — it inserts the in-app row **and** emails the user, so "every notification is emailed" always holds. `lib/email/send.js` sends via the Resend **HTTP API** (`RESEND_API_KEY`/`EMAIL_FROM`; unset = no-op + console log) and holds the inline-styled templates. `lib/verifyToken.js` signs/verifies the HMAC approve-link token. `saveTutorProfile` deliberately never writes `verified`/`verification_status` — those are server-controlled so a tutor can't self-verify. The verified flag adds a ranking boost in `lib/ranking.js`. Bulk update emails are out-of-app via Resend Broadcasts (`scripts/sync-tutors-audience.mjs` + `email-updates/`).

### Signup gate

The form POSTs to `/api/auth/signup` (it never calls `supabase.auth.signUp` from the client). The route re-validates the password (`lib/password.js`), email format (`lib/email.js`), and that the domain can receive mail (`lib/mailDomain.js` — DNS MX → A/AAAA fallback, so `gmial.con` is rejected), then signs up server-side. The DB trigger — not the client — decides which extension table gets a row. Never insert into `profiles`/extension tables from the client.

### Query helpers (`lib/supabase/tutors.js`)

All take a Supabase client as the first arg (work from server + browser). Subject, location, and name filters each resolve to a tutor-id set first, then intersect into one `.in("id", …)` so the exact count and pagination stay correct. Public reads filter `visibility = 'public'` **and** confirmed email.

### Maps & geocoding

Service area renders as a real Leaflet + OSM map (CARTO Voyager tiles after >3 `tileerror`s). `SuburbAutocomplete` (debounced `/api/places`, Photon primary) is the primary location picker — a selected suggestion already carries `{ lat, lng, state }`, so no second round-trip. `/api/geocode` (Nominatim primary) is the single-result fallback. Both Nominatim/Photon are free, keyless, OSM-based; the public profile hides the map entirely when coords are missing.

### State & navigation

`/browse` filter state lives in the URL (`router.replace()` on every change). `components/TopNav.js` is auth-aware: logged-in users get an avatar-chip dropdown; logged-out users see only Log in + Sign Up. `jsconfig.json` maps `@/*` to the project root.
