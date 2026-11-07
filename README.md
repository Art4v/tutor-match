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
| Animation | `motion` 11 (Framer Motion); native scrolling |
| Backend | Supabase (Postgres + Auth + RLS) via `@supabase/ssr` 0.5 + `@supabase/supabase-js` 2.45 |
| Maps | `leaflet` 1.9 + `react-leaflet` 4.2 — OpenStreetMap tiles (CARTO fallback), no key |
| Geocoding | Nominatim primary, Photon (Komoot) fallback — no keys |
| Image crop | `react-easy-crop` for avatar/banner uploads |
| Icons | Self-contained Lucide-style SVG set in `components/Icon.js` |
| Blog bodies | `markdown-it` parsed into a whitelisted node tree (never raw HTML) |
| Email | Resend (Supabase auth SMTP, plus the app's own HTTP API sends) |
| AI copy | Groq (`/api/ai/generate-bio`) |

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
        Settings["/tutor/[slug] (owner editor)"]
        Companies["/companies · /blog · /tutors"]
        Admin["/admin"]
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
        S3 -->|handle_new_user trigger| S4["profiles row (role NULL)"]
        S3 -->|confirm email link| S5["/auth/callback<br/>verifyOtp (signup) + welcome"]
        S5 --> S6["/choose-role → home"]
    end

    subgraph OAuth["Google OAuth (PKCE)"]
        O1["Continue with Google"] -->|signInWithOAuth| O2["Google consent"]
        O2 -->|?code=| O3["/auth/callback<br/>exchangeCodeForSession + welcome"]
        O3 --> O4["/choose-role → home"]
    end

    subgraph Reset["Password reset"]
        R1["/forgot-password"] -->|POST| R2["/api/auth/forgot-password<br/>resetPasswordForEmail"]
        R2 -->|email link| R3["/auth/callback<br/>verifyOtp (recovery)"]
        R3 --> R4["/reset-password → /login?reset=1"]
    end
```

### Tutor verification pipeline

A tutor requests verification; an admin decides it on the `/admin` dashboard (0074), behind an admin login. Every notification is **both** an in-app row and an email, funnelled through `lib/notifications.js → notifyUser()` using the service-role client (the `notifications` table has no INSERT RLS policy).

```mermaid
sequenceDiagram
    participant T as Tutor (profile editor)
    participant RQ as /api/verification/request
    participant DB as Supabase
    participant N as notifyUser() (service-role)
    participant A as Admin (alert email → /admin)
    participant AP as /api/admin/verification

    T->>RQ: POST (auth-gated)
    RQ->>DB: request_tutor_verification() RPC → status 'pending'
    RQ->>N: notify tutor ("request received")
    RQ->>A: alert every unmuted admin (lib/admin/alerts.js) with /admin/verification/<id>
    A->>AP: sign in as an admin → click Approve (POST { tutorId, decision, reason? })
    AP->>DB: admin_decide_verification() RPC → checks is_admin, sets 'verified', logs History
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
    root --> scripts["scripts/ — sync-tutors-audience · seed-blog-articles ·<br/>create-company · gen-og-image"]
    root --> emails["email-updates/ — NNNN_*.html broadcasts + README"]
    root --> mw["middleware.js<br/>jsconfig.json · *.config.*"]

    app --> auth["(auth)/ — login · signup · join ·<br/>forgot-password · reset-password"]
    app --> apidir["api/ — auth · join · places · geocode · ai · verification ·<br/>reviews · reports · profile-revisions · companies · admin · account"]
    app --> browse["browse/ · tutors/ — search + crawler landing pages"]
    app --> tutor["tutor/[slug]/ — public profile + owner editor (OwnerProfile)"]
    app --> companies["companies/ · company/ — directory, company pages, claim"]
    app --> blog["blog/ · author/ — articles + the Markdown editor"]
    app --> admin["admin/ — admin dashboard (is_admin only)"]
    app --> rest["onboarding · account · notifications · messages · profile"]

    comp --> rows["TutorRow · CompanyCard — ruled-list rows"]
    comp --> home["HomeHero · SchoolsStrip · FeaturedTutors · HomeHowItWorks · HomeCta"]
    comp --> ui["ui.js · Icon.js · TopNav · SiteFooter · StarRating"]
    comp --> pick["SubjectPicker · CatalogPicker · SuburbAutocomplete · SchoolCombobox"]
    comp --> edit["profile-edit/sections · DocumentationUploader · ImageCropModal"]

    lib --> data["supabase/ — the only data-access layer (tutors, companies, reviews, …)"]
    lib --> dom["ranking · subjects · yearLevels · availability · cities · states · markdown"]
    lib --> mail["email/send · notifications · admin/alerts"]
    lib --> seo["seo/ — landing pages · llms.txt · JSON-LD"]

    sb --> migr["migrations/ — 0001 … 0076"]
    sb --> tmpl["email-templates/ — confirm-signup · reset-password"]
    sb --> util["utilities/ — SCHEMA.md · grant_admin · grant_author · dev helpers"]
```

`_design/` holds the original HTML/CSS/JS prototype (gitignored), a read-only reference for visual decisions.

---

## Routes

The main pages. [`CLAUDE.md`](./CLAUDE.md) has the full route table, including every API route.

| Path | File | Notes |
| --- | --- | --- |
| `/` | `app/page.js` | Server. Hero search, schools strip, featured tutors (marquee of rows from `md`, five stacked rows on phones), how it works, CTA. |
| `/browse` | `app/browse/page.js` | Server. Filter state lives in `searchParams`; `getTutorsForBrowse()`. Results are a ruled list of `TutorRow`s. |
| `/tutor/[slug]` | `app/tutor/[slug]/page.js` | Public profile (`PublicProfileView`), or the owner's editor (`OwnerProfile`) when the owner is signed in. |
| `/profile` | `app/profile/page.js` | Redirects a tutor to their own `/tutor/<slug>` editor (or `/login`, `/onboarding`). |
| `/onboarding` | `app/onboarding/page.js` | First-login wizard reusing the editor's section components. |
| `/tutors/...` | `app/tutors/...` | Cached landing pages per state, city and subject, for search engines and AI agents. |
| `/companies`, `/companies/[slug]` | `app/companies/...` | Tutoring company directory and pages (invite only). |
| `/blog`, `/blog/[slug]`, `/author` | `app/blog/...`, `app/author/...` | Articles from the `articles` table; designated tutors write them at `/author`. |
| `/messages` | `app/messages/page.js` | Student/tutor messaging: conversation list plus a row-style thread. |
| `/account`, `/notifications` | `app/account/...`, `app/notifications/...` | Password, delete account, management opt-out; the notification list. |
| `/admin` | `app/admin/...` | Admin dashboard, for accounts with `profiles.is_admin` (404 for everyone else). |
| `/signup`, `/login`, `/join` | `app/(auth)/...` | Email + password or Google. Role is chosen afterwards at `/choose-role`; `/join` is the admin tutor-invite link. |

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
3. Run every file in `supabase/migrations/` (`0001`–`0076`) **in numeric order** in the SQL Editor. They build the schema incrementally. On an **existing** deployment three pairs are split around an app deploy: 0070 → app → 0071, 0072 → app → 0073, 0074 → app → 0075 (the second of each only removes access the old app needed).

Without Supabase configured, public pages render empty states and signup/login fail.

### 3. Configure auth email (Resend SMTP)

Confirmation/recovery emails are sent **by Supabase over Resend custom SMTP** — there is no Resend key in `.env.local` (the app never sends mail itself). This replaces Supabase's built-in sender (~2/hr, poor deliverability).

1. Create a [Resend](https://resend.com) API key (`re_…`).
2. Supabase → **Project Settings → Authentication → SMTP Settings** → enable Custom SMTP: host `smtp.resend.com`, port `465`/`587`, username `resend`, password = the key. Sender `onboarding@resend.dev` until a domain is verified.
3. **Authentication → Emails** → paste `supabase/email-templates/confirm-signup.html` (Confirm signup) and `reset-password.html` (Reset Password). Re-paste after any edit — Supabase renders the live copy. The confirm-signup link routes through `<origin>/auth/callback?next=…&token_hash=…&type=signup` (mirroring recovery), so confirmation logs the user in; a new account then picks its role at `/choose-role`.
4. **Authentication → Rate Limits** → raise emails/hour above 2.
5. **Authentication → URL Configuration** → set **Site URL** to the live domain, and add **wildcard** Redirect URLs for every origin: `https://matchtutor.com.au/auth/callback**` and `http://localhost:3000/auth/callback**`. The `**` is required — the `?next=…` query string won't match a bare entry, and a failed match silently falls back to the Site URL.

With no verified domain, `onboarding@resend.dev` only delivers to your own Resend account email — sign up with that address when testing. Going live: verify a domain (SPF/DKIM/DMARC) in Resend, then set the Sender to e.g. `noreply@matchtutor.com.au`.

### 4. Configure Google OAuth

The OAuth client secret lives in the Supabase dashboard, not `.env.local` — the app only calls `supabase.auth.signInWithOAuth`.

1. **Google Cloud Console → Credentials → OAuth client ID → Web application**. Authorized redirect URI = your Supabase callback `https://YOUR-REF.supabase.co/auth/v1/callback`. Copy the Client ID + secret.
2. **Supabase → Authentication → Providers → Google** → enable and paste them.
3. Ensure the wildcard Redirect URLs from step 3 cover `<origin>/auth/callback**`.

A first-time Google user carries no `role` metadata, so (since `0041`) every new account, email or Google, is created with a NULL role and `middleware.js` sends it to `/choose-role` before anything else.

### 5. Configure AI profile copy (Groq) — optional

The profile editor's About section can AI-generate a tutor's **tagline** and **long bio** from their own profile data. It runs **server-side only** through [Groq Cloud](https://console.groq.com).

1. Create a Groq API key at **console.groq.com → API Keys**.
2. Set `GROQ_API_KEY` in `.env.local` (a server secret — **no** `NEXT_PUBLIC_` prefix, never shipped to the browser). Optionally override `GROQ_MODEL` (defaults to `llama-3.3-70b-versatile`).
3. Each tutor is capped at **10 generations/day**, enforced by the `consume_ai_credit` RPC in migration `0020` (so the limit holds across serverless instances). A failed Groq call refunds the credit.

Leaving `GROQ_API_KEY` unset simply disables the feature — the button surfaces an error instead of generating.

### 6. Configure tutor verification — optional

Tutors can request a **verified badge** from the owner card on their own profile or the final `/onboarding` step. The request alerts the admins by email with a link into the `/admin` dashboard; approving there flips the badge on and ranks that tutor above unverified ones. Both "request sent" and "approved" appear on `/notifications` and are emailed to the tutor.

This is the one place the **app itself** sends mail (separate from the Supabase auth SMTP above). Set these **server-only** vars in `.env.local`:

1. `RESEND_API_KEY` — a [Resend](https://resend.com) API key (`re_…`). The app calls Resend's HTTP API directly. **Leaving it unset disables sending** — emails are logged to the server console instead, so the flow still works end-to-end locally.
2. `EMAIL_FROM` — the From address (e.g. `matchtutor <noreply@yourdomain.com>`). Must be on a **verified Resend domain** or Resend only delivers to your own account email.
3. `ADMIN_EMAIL` — bug reports land here, and admin alerts fall back to it when no admin is set up (defaults to `matchtutoraustralia@gmail.com`). Alerts normally go to every admin who hasn't muted them on `/admin`.
4. `SUPABASE_SERVICE_ROLE_KEY` — **Project Settings → API → service_role key**. Bypasses RLS; used server-side only, to write notifications, look up admins' email addresses and read the dashboard queues after the admin check. **Never expose it.**
5. `VERIFICATION_APPROVE_SECRET`, `REPORT_REVIEW_SECRET`, `REVIEW_APPROVE_SECRET`, `PROFILE_REVISION_SECRET` — **retired by 0074.** Nothing signs these links any more; they are only read so an old email link redirects into the dashboard. Remove them 30 days after deploying 0074.

**Admins** are granted (and revoked) only in SQL: run `supabase/utilities/grant_admin.sql` once per admin per environment after applying `0074_admin_dashboard.sql`.

Dev shortcut: `supabase/utilities/verify_user.sql` flips one tutor verified by id without the email round-trip.

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

A simplified view; `supabase/utilities/SCHEMA.md` is the full, maintained snapshot (companies, reviews, messaging, articles, admin History and more).

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
        user_role role "tutor | student | partner, NULL until chosen"
        text full_name "CHECK not blank"
    }
    tutor_profiles {
        uuid id PK,FK "→ profiles"
        text slug UK "name-derived, race-safe"
        text visibility "public | unlisted"
        timestamptz email_confirmed_at "mirror of auth.users"
        text bio "tagline + bio_long"
        numeric atar
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
        text verification_status "none|pending|verified|rejected"
        uuid partner_id "company tutor, NULL otherwise"
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

**Writes go through RPCs.** Since 0070/0071 no client role can write `tutor_profiles` or its child tables directly; every tutor write is a `SECURITY DEFINER` function that checks the caller (`save_tutor_profile`, `set_tutor_visibility`, the document RPCs, the draft/revision RPCs for verified tutors). Other key functions: `handle_new_user()` (signup trigger), `choose_role()`, `tutors_within_service_radius()` (haversine location search), `delete_own_account()`, `request_tutor_verification()`, `consume_ai_credit()` / `refund_ai_credit()`, and the `admin_*` RPCs behind the dashboard, which re-check `is_admin()` and log to `admin_actions`.

The schema is built incrementally by the ordered files in `supabase/migrations/` (`0001`–`0076`) — apply them all in numeric order; each new migration takes the next sequential number (no reuse), like `email-updates/`. `supabase/utilities/` holds the admin grants (`grant_admin.sql`, `grant_author.sql`) and dev shortcuts (e.g. `verify_user.sql`).

---

## Architecture notes

### Styling

A deliberate mix of **Tailwind utilities** for layout and **inline `style={{ }}`** for the specific colors/radii/borders from the design — keeping design tokens local to where they're used. Lists of tutors and companies are borderless rows divided by 1px rules (the list draws the rules, never the row), and profile pages are flat sections rather than cards. Don't refactor inline styles into a global stylesheet without a reason.

### Supabase clients

- `lib/supabase/client.js` — `createBrowserClient` for client components.
- `lib/supabase/server.js` — `createServerClient` wired to `cookies()` for server components / route handlers.
- `lib/supabase/admin.js` — **server-only** `service_role` client (bypasses RLS). Used only where a user session can't do the job: writing `notifications`, reading user emails (`auth.admin.getUserById`), reading the admin dashboard queues after the admin check, and the broadcast sync. Returns `null` when the key is unset so callers degrade gracefully.
- `middleware.js` — calls `getUser()` on every request to refresh the session cookie (official `@supabase/ssr` pattern; matcher excludes static assets).

### Verification, notifications & email

`lib/notifications.js → notifyUser()` is the single path for user notifications — it inserts the in-app row **and** emails the user, so "every notification is emailed" always holds. `lib/email/send.js` sends via the Resend **HTTP API** (`RESEND_API_KEY`/`EMAIL_FROM`; unset = no-op + console log) and holds the inline-styled templates. Admin decisions happen on `/admin` (0074); the old `lib/*Token.js` files only verify links sent before that, so they can redirect into the dashboard. `saveTutorProfile` deliberately never writes `verified`/`verification_status` — those are server-controlled so a tutor can't self-verify. The verified flag adds a ranking boost in `lib/ranking.js`. Bulk update emails are out-of-app via Resend Broadcasts (`scripts/sync-tutors-audience.mjs` + `email-updates/`).

### Signup gate

The form POSTs to `/api/auth/signup` (it never calls `supabase.auth.signUp` from the client). The route re-validates the password (`lib/password.js`), email format (`lib/email.js`), and that the domain can receive mail (`lib/mailDomain.js` — DNS MX → A/AAAA fallback, so `gmial.con` is rejected), then signs up server-side. The DB trigger — not the client — decides which extension table gets a row. Never insert into `profiles`/extension tables from the client.

### Query helpers (`lib/supabase/tutors.js`)

All take a Supabase client as the first arg (work from server + browser). Subject, location, and name filters each resolve to a tutor-id set first, then intersect into one `.in("id", …)` so the exact count and pagination stay correct. Public reads filter `visibility = 'public'` **and** confirmed email.

### Maps & geocoding

Service area renders as a real Leaflet + OSM map (CARTO Voyager tiles after >3 `tileerror`s). `SuburbAutocomplete` (debounced `/api/places`, Photon primary) is the primary location picker — a selected suggestion already carries `{ lat, lng, state }`, so no second round-trip. `/api/geocode` (Nominatim primary) is the single-result fallback. Both Nominatim/Photon are free, keyless, OSM-based; the public profile hides the map entirely when coords are missing.

### State & navigation

`/browse` filter state lives in the URL (`router.replace()` on every change). `components/TopNav.js` is auth-aware: logged-in users get an avatar-chip dropdown; logged-out users see only Log in + Sign Up. `jsconfig.json` maps `@/*` to the project root.
