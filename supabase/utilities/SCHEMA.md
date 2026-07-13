# tutormatch — Current Database Schema

**Living reference.** This file describes the *cumulative* state of the `public` schema
after all migrations in `supabase/migrations/` have been applied in order. It is the
human-readable snapshot — the migrations remain the source of truth.

> **KEEP THIS UPDATED.** Every time you add a migration (`NNNN_*.sql`), edit this file in the
> same change so it reflects the new final state: add/rename/drop the columns, functions,
> triggers, policies, or seed data the migration introduces, and bump **Applied through** below.
> Edit the affected section in place (don't append a changelog) — this doc describes the *end
> state*, not the history. The migration files are the history.

**Applied through:** `0045_message_interactions.sql`
**Last reviewed:** 2026-07-12

---

## Conventions

- All tables live in the `public` schema unless noted.
- "Self-write" RLS = `auth.uid() = <owner col>` for `INSERT`/`UPDATE`/`DELETE`.
- `(NNNN)` after a column/feature notes the migration that introduced or last changed it.

---

## Deliberate denormalizations / redundancy

These duplications are **intentional** — don't "tidy them up" without understanding why:

- **`service_area` (jsonb) ↔ `service_lat` / `service_lng` / `service_radius_km` (scalars).**
  `service_area` is the source of truth (the editor writes it); the three scalar columns are
  copies kept in sync on every save (`saveTutorProfile`, `lib/supabase/tutors.js`) so `/browse`
  can filter by distance in SQL via `tutors_within_service_radius()` (0008). Filtering inside
  jsonb isn't indexable here — hence the flattened scalars.
- **`atar` (scalar) is a derived mirror of the `credentials` ATAR entry (0036).** The ATAR is
  a genuine `credentials` entry (`icon="atar"`) — the single source of truth for its value AND
  its order (the tutor controls which credential leads). The scalar `atar` column is kept only
  as a write-derived mirror, recomputed from that credential on every save by
  `extractAtarFromCredentials` (`lib/supabase/tutors.js`) and read ONLY by the `/browse`
  Minimum-ATAR filter (`query.gte("atar", …)`, indexed). It is never read for display. At most
  one credential may carry `icon="atar"` — enforced client-side (editor dropdown) and
  server-side (the `save_tutor_profile` RPC raises on a second ATAR).
- **`rating` / `review_count` are static.** No reviews feature exists yet; nothing writes them.
  They are placeholders for a future reviews table, surfaced read-only on cards/profiles.

---

## Enums / Types

| Type | Values | Migration |
| --- | --- | --- |
| `public.user_role` | `'tutor'`, `'student'` | 0001 |

---

## Tables

### `profiles`
1:1 with `auth.users`. Created by the `handle_new_user()` trigger on signup.

| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `id` | uuid | PK → `auth.users(id)` ON DELETE CASCADE |
| `role` | `user_role` | **nullable** since 0041 (was NOT NULL); NULL ⇒ role not chosen yet (new user must pass `/choose-role`). Set by `choose_role()`, not the signup trigger |
| `full_name` | text | nullable; CHECK `full_name IS NULL OR btrim(full_name) <> ''` (0017) |
| `terms_agreed_at` | timestamptz | nullable; consent stamp for every role, NULL ⇒ must (re-)agree (0025 on `tutor_profiles`, moved here in 0039) |
| `messages_disclaimer_ack_at` | timestamptz | nullable; `/messages` first-open disclaimer acknowledgment, NULL/stale ⇒ show the blocking gate (versioned via `lib/messagesDisclaimer.js`). NOT stamped on signup, so new users see it once too (0046) |
| `created_at` | timestamptz | NOT NULL DEFAULT `now()` |
| `updated_at` | timestamptz | NOT NULL DEFAULT `now()` |

### `tutor_profiles`
Extension table keyed 1:1 with `profiles`. The most-altered table — columns below are in **final form**.

| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `id` | uuid | PK → `profiles(id)` ON DELETE CASCADE |
| `slug` | text | UNIQUE (0004); race-safe assignment via `_assign_tutor_slug()` (0013) |
| `email_confirmed_at` | timestamptz | mirrored from `auth.users` (0007); indexed |
| `avatar_url` | text | profile-images upload (0006) |
| `banner_url` | text | profile-images upload (0006) |
| `service_lat` | double precision | geo coords for distance filter (0008) |
| `service_lng` | double precision | (0008) |
| `service_radius_km` | int | (0008) |
| `year_min` | int | NOT NULL DEFAULT `0` (0011; default `7`→`0` in 0019); CHECK 0–12 & `year_min ≤ year_max` |
| `year_max` | int | NOT NULL DEFAULT `12` (0011) |
| `bio` | text | the "tagline" shown under the name; absorbed old `headline` (0012) |
| `bio_long` | text | long description (0002) |
| `suburb` | text | (0002) |
| `city` | text | indexed (0002) |
| `avatar_bg` | text | CSS `oklch()` fallback colour when no avatar (0002) |
| `banner_bg` | text | banner fallback colour; falls back to `avatar_bg` when null (0023) |
| `initials` | text | 2-char monogram (0002) |
| `atar` | numeric(4,2) | e.g. 99.85 (0002); write-derived mirror of the ATAR credential (0036) |
| `rate` | int | AUD/hour; indexed (0002) |
| `delivers_in_person` | bool | NOT NULL DEFAULT true (0003) |
| `delivers_online` | bool | NOT NULL DEFAULT true (0003) |
| `responsive` | text | responsiveness label (0002) |
| `years_tutoring` | int | (0002) |
| `credentials` | jsonb | NOT NULL DEFAULT `'[]'`; `{label, icon}` objects (text[]→jsonb in 0003) |
| `languages` | text[] | NOT NULL DEFAULT `'{}'` (0002) |
| `rating` | numeric(2,1) | e.g. 4.9 (0002) |
| `review_count` | int | NOT NULL DEFAULT 0 (0002) |
| `availability` | jsonb | `{hours, days, grid}` (0002) |
| `service_area` | jsonb | source-of-truth base suburb + radius; flattened to `service_*` scalars for geo filter (0008) |
| `visibility` | text | NOT NULL DEFAULT `'public'` (0003; default `'unlisted'`→`'public'` in 0005); CHECK `public/unlisted/hidden` |
| `verification_status` | text | NOT NULL DEFAULT `'none'`; CHECK `none/pending/verified/rejected` (0021). **Single source of truth** — the app derives the `verified` boolean from `= 'verified'`; the standalone `verified` bool was dropped in 0028 |
| `verification_requested_at` | timestamptz | (0021) |
| `onboarded` | bool | NOT NULL DEFAULT false; drives `/onboarding` gate (0018) |
| `updated_at` | timestamptz | NOT NULL DEFAULT `now()` (0002) |

**Indexes:** `(visibility)`, `(city)`, `(atar)`, `(rate)` (0004); `(email_confirmed_at)` (0007); `(service_lat, service_lng)` (0008).

### `student_profiles`
| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `id` | uuid | PK → `profiles(id)` ON DELETE CASCADE |
| `avatar_url` | text | Student profile photo — `profile-images` upload (0043); shown on `/account` + the top-nav chip |
| `created_at` | timestamptz | NOT NULL DEFAULT `now()` |

### `saved_tutors` (join, 0042)
Student bookmarks — one row per saved tutor. Read/written by the bookmark button and the `/browse ?saved=1` filter.

| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `student_id` | uuid | PK part → `student_profiles(id)` ON DELETE CASCADE |
| `tutor_id` | uuid | PK part → `tutor_profiles(id)` ON DELETE CASCADE |
| `created_at` | timestamptz | NOT NULL DEFAULT `now()` |

**Index:** `(student_id, created_at desc)`. Self-only RLS on `student_id` (student reads/writes only their own saves).

### `conversations` (0044)
One row per (student, tutor) pair — the direction-gated chat thread. Created lazily by `start_conversation()` on the student's first send (no client INSERT policy), so a tutor sees nothing until then.

| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `id` | uuid | PK DEFAULT `gen_random_uuid()` |
| `student_id` | uuid | NOT NULL → `student_profiles(id)` ON DELETE CASCADE |
| `tutor_id` | uuid | NOT NULL → `tutor_profiles(id)` ON DELETE CASCADE |
| `created_at` | timestamptz | NOT NULL DEFAULT `now()` |
| `last_message_at` | timestamptz | Bumped by the `messages_bump_conversation` trigger; drives list ordering |
| `student_last_read_at` | timestamptz | Student's read cursor (set by `mark_conversation_read`) |
| `tutor_last_read_at` | timestamptz | Tutor's read cursor |

**Unique** `(student_id, tutor_id)` (one thread per pair). **Indexes:** `(student_id, last_message_at desc)`, `(tutor_id, last_message_at desc)`. RLS: participants read; participants UPDATE (read cursors); **no INSERT policy** (created only via the RPC).

### `messages` (0044)
| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `id` | uuid | PK DEFAULT `gen_random_uuid()` |
| `conversation_id` | uuid | NOT NULL → `conversations(id)` ON DELETE CASCADE |
| `sender_id` | uuid | NOT NULL → `auth.users(id)` ON DELETE CASCADE |
| `body` | text | NOT NULL, CHECK non-blank |
| `created_at` | timestamptz | NOT NULL DEFAULT `now()` |
| `reply_to_id` | uuid | NULLABLE → `messages(id)` ON DELETE SET NULL (0045); the quoted message |
| `edited_at` | timestamptz | NULLABLE (0045); non-null ⇒ show "Edited" |
| `unsent_at` | timestamptz | NULLABLE (0045); non-null ⇒ soft-deleted, filtered out of every read (row + body kept for audit) |

**Index:** `(conversation_id, created_at)`, `(reply_to_id)` (0045). RLS: participants read; participant INSERT with `sender_id = auth.uid()` **and** the first message must be the student's (a tutor may insert only once a message already exists — only the student can post into an empty conversation). No UPDATE/DELETE policy — edits/unsends go through the `edit_message`/`unsend_message` RPCs (0045). Both `messages` and `conversations` are in the `supabase_realtime` publication (`replica identity full`) for live delivery; the change feed is RLS-filtered per subscriber.

### `message_reactions` (0045)
One emoji reaction per (message, user) — the composite PK enforces at most one per person per message. Read by conversation participants; each user writes only their own row (plain self-RLS, no RPC), so the toggle is a client upsert (overwrite emoji) / delete (same emoji again). In the `supabase_realtime` publication (`replica identity full`) as its own event stream, distinct from message UPDATEs.
| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `message_id` | uuid | NOT NULL → `messages(id)` ON DELETE CASCADE; part of PK |
| `user_id` | uuid | NOT NULL → `auth.users(id)` ON DELETE CASCADE; part of PK |
| `emoji` | text | NOT NULL, CHECK non-blank |
| `created_at` | timestamptz | NOT NULL DEFAULT `now()` |

**Index:** `(message_id)`. RLS: participant SELECT; `user_id = auth.uid()` (+ participant) INSERT/UPDATE/DELETE.

### `exams` (renamed from `certificates` in 0010)
Reference catalog of exam systems.

| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `code` | text | PK (e.g. `HSC`, `VCE`, `GENERAL`, `TEST`) |
| `name` | text | NOT NULL |
| `jurisdiction` | text | nullable (null for `TEST`/`GENERAL`) |
| `external_exams` | bool | nullable |
| `position` | int | NOT NULL DEFAULT 0; `GENERAL`=0, `TEST`=9 |

**Seed:** 10 rows — `GENERAL, HSC, VCE, IB, QCE, SACE, WACE, TCE, ACT, TEST` (0009/0010/0011). Public-read RLS.

### `subjects`
| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `id` | uuid | PK DEFAULT `gen_random_uuid()` |
| `name` | text | NOT NULL; **not unique** (exam-scoped) — `name` UNIQUE dropped in 0009 |
| `slug` | text | NOT NULL UNIQUE; canonical key, exam-prefixed e.g. `vce-biology` (0009) |
| `exam_code` | text | NOT NULL → `exams(code)`; renamed from `certificate_code` (0009/0010) |
| `position` | int | NOT NULL DEFAULT 0; order within exam group |

**Seed:** ~260 subjects across the exam groups (`GENERAL` 8, `TEST` ~14, each state cert ~30). Maintained 0009; `GENERAL` group 0011; HSC English Extension 1 & 2 0024; HSC Japanese/French/Italian 0030; GENERAL Art/Music/Languages 0031. Public-read RLS. **Index:** `(exam_code, position)`.

### `tutor_subjects` (join)
| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `tutor_id` | uuid | PK part → `tutor_profiles(id)` ON DELETE CASCADE |
| `subject_id` | uuid | PK part → `subjects(id)` ON DELETE CASCADE |
| `position` | int | NOT NULL DEFAULT 0; drag-order, 0-indexed (0014) |

**Index:** `(tutor_id, position)`. Public read; tutor self-write.

### `tutor_packages`
| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `id` | uuid | PK DEFAULT `gen_random_uuid()` |
| `tutor_id` | uuid | NOT NULL → `tutor_profiles(id)` ON DELETE CASCADE |
| `label` | text | NOT NULL |
| `price` | int | NOT NULL; AUD |
| `position` | int | NOT NULL DEFAULT 0 |

**Index:** `(tutor_id, position)`. Public read; tutor self-write.

### `tutor_experience`
| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `id` | uuid | PK DEFAULT `gen_random_uuid()` |
| `tutor_id` | uuid | NOT NULL → `tutor_profiles(id)` ON DELETE CASCADE |
| `role` | text | |
| `org` | text | |
| `period` | text | "2024 — present" |
| `note` | text | |
| `position` | int | NOT NULL DEFAULT 0 |

**Index:** `(tutor_id, position)`. Public read; tutor self-write.

### `tutor_education`
| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `id` | uuid | PK DEFAULT `gen_random_uuid()` |
| `tutor_id` | uuid | NOT NULL → `tutor_profiles(id)` ON DELETE CASCADE |
| `school` | text | always-present display name (free text) |
| `detail` | text | |
| `level` | text | NOT NULL DEFAULT `'high_school'`; CHECK `high_school/university` (0022) |
| `school_id` | uuid | → `schools(id)` ON DELETE SET NULL; set only for high-school rows matching a listed school (0026) |
| `position` | int | NOT NULL DEFAULT 0 |

**Indexes:** `(tutor_id, position)`, `(school_id)` (0026). Public read; tutor self-write.

### `schools` (0026)
| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `id` | uuid | PK DEFAULT `gen_random_uuid()` |
| `name` | text | NOT NULL UNIQUE |
| `slug` | text | NOT NULL UNIQUE |
| `position` | int | NOT NULL DEFAULT 0; global rank order — NSW 1–50, Melbourne 51–100 |

**Seed:** top 50 NSW schools by 2025 HSC ranking (0026) + top 50 Melbourne schools by 2025 VCE ranking (0032). Public-read RLS, no write policy.

### `ai_usage` (0020)
| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `user_id` | uuid | PK part → `auth.users(id)` ON DELETE CASCADE |
| `day` | date | PK part (UTC day) |
| `count` | int | NOT NULL DEFAULT 0 |

Self-only SELECT; **no write policy** (writes only via `consume_ai_credit()` / `refund_ai_credit()`).

### `notifications` (0021)
| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `id` | uuid | PK DEFAULT `gen_random_uuid()` |
| `user_id` | uuid | NOT NULL → `auth.users(id)` ON DELETE CASCADE |
| `type` | text | NOT NULL (e.g. `verification_requested`, `verification_approved`, `verification_rejected`) |
| `title` | text | NOT NULL |
| `body` | text | |
| `read` | bool | NOT NULL DEFAULT false |
| `created_at` | timestamptz | NOT NULL DEFAULT `now()` |

Self-only SELECT + UPDATE (mark-read); **no INSERT policy** — written by the service-role client in API routes.

### `tutor_documents` (0034)
| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `id` | uuid | PK DEFAULT `gen_random_uuid()` |
| `tutor_id` | uuid | NOT NULL → `tutor_profiles(id)` ON DELETE CASCADE |
| `storage_path` | text | NOT NULL UNIQUE; `<uid>/<timestamp>-<name>` in `tutor-docs`; CHECK `split_part(storage_path,'/',1) = tutor_id::text` (row can only point into the owner's folder) |
| `title` | text | NOT NULL, CHECK non-blank — tutor-chosen display title (app defaults to the cleaned filename) |
| `uploaded_at` | timestamptz | NOT NULL DEFAULT `now()` |

Index on `tutor_id`. Public SELECT (the profile page reads any tutor's rows with the anon client); owner-scoped INSERT/UPDATE/DELETE (UPDATE = retitling). This table is the source of truth for the profile "Documentation" card — the app never lists the bucket. On account deletion rows cascade; the storage files orphan (accepted, like 0015's profile-images note).

### Storage: `profile-images` bucket (0006)
Public read; owner-scoped INSERT/UPDATE/DELETE keyed on `(storage.foldername(name))[1] = auth.uid()::text`.

### Storage: `tutor-docs` bucket (0034; replaced the private `verification-docs` bucket from 0033)
**Public** — the files behind `tutor_documents`, at `<uid>/<timestamp>-<name>`. Bucket-level `file_size_limit` 10 MB + `allowed_mime_types` `{application/pdf, image/*}`. Owner-scoped SELECT (0035) / INSERT / DELETE (folder = uid) — the app never lists the bucket (reads go through the table; public-bucket downloads bypass RLS), but the owner SELECT is required because the Storage API's `remove()` checks SELECT as well as DELETE (without it the owner's delete silently no-ops). **No UPDATE policy** — files are immutable, so uploads must not use upsert. Not part of the verification flow. 0034 dropped the old bucket's policies; the bucket itself is emptied + deleted in the dashboard (Supabase's `storage.protect_delete()` trigger blocks SQL DELETEs on storage tables) rather than migrating the files — they were uploaded under a private-and-deleted-after-review promise.

---

## Functions / RPCs

| Function | Returns | Purpose | Migration |
| --- | --- | --- | --- |
| `handle_new_user()` | trigger | On signup: create the `profiles` row only, with **role NULL** (role is deferred to `choose_role()`); name←Google `name` claim; stamp `profiles.terms_agreed_at` for every role. No longer creates the role extension table or assigns a slug | 0001 → 0016/0025/0039/0041 |
| `choose_role(p_role)` | void | Authenticated, `auth.uid()`-scoped, one-time: set `profiles.role` and create the matching extension row (tutor → placeholder slug + `_assign_tutor_slug` + mirror `email_confirmed_at`; else `student_profiles`). Raises if a role is already set | 0041 |
| `handle_user_email_confirmed()` | trigger | Mirror `auth.users.email_confirmed_at` onto `tutor_profiles` on confirmation | 0007 |
| `generate_unique_slug(p_name)` | text | Name→slug with collision suffix; superseded by `_assign_tutor_slug` (0013) but still present | 0004 |
| `_assign_tutor_slug(p_id, p_name)` | text | Race-safe slug assignment (retry on unique_violation). SECURITY DEFINER; execute revoked from anon/authenticated | 0013 |
| `assign_tutor_slug(p_name)` | text | Authenticated wrapper scoped to `auth.uid()`; called by `saveTutorProfile` on rename | 0013 |
| `tutors_within_service_radius(lat, lng, include_online)` | TABLE(id uuid) | Haversine (no PostGIS) — ids of public+confirmed tutors whose radius covers the point, OR online when `include_online`. Public execute | 0008 |
| `delete_own_account()` | void | Delete caller's `auth.users` row (cascades everything). SECURITY DEFINER, `auth.uid()`-scoped | 0015 |
| `consume_ai_credit()` | TABLE(allowed bool, used int, day_limit int) | Atomic conditional increment of `ai_usage` (limit hardcoded 10/day) | 0020 |
| `refund_ai_credit()` | void | Decrement floored at 0; called only on Groq failure | 0020 |
| `request_tutor_verification()` | text | `none`/`rejected` → `pending`, idempotent; returns new status. `auth.uid()`-scoped | 0021 |
| `accept_current_terms()` | void | Stamp caller's `profiles.terms_agreed_at = now()` server-side. SECURITY DEFINER, `auth.uid()`-scoped | 0025 → 0039 |
| `acknowledge_messages_disclaimer()` | void | Stamp caller's `profiles.messages_disclaimer_ack_at = now()` server-side. SECURITY DEFINER, `auth.uid()`-scoped | 0046 |
| `save_tutor_profile(p_payload jsonb)` | jsonb | Atomically update the caller's `tutor_profiles` scalars + replace-all the four child tables (resolving subject/school slugs server-side); returns `{ dropped_subjects }`. SECURITY DEFINER, `auth.uid()`-scoped. Replaces the old non-transactional JS save path. Raises `Only one ATAR credential is allowed` if the payload carries >1 `icon="atar"` credential (0036) | 0029, 0036 |
| `start_conversation(p_tutor_id)` | uuid | Student-only gate (raises otherwise): validates the target is a public, email-confirmed tutor, then find-or-creates the `(student, tutor)` conversation and returns its id. Invoked at first-send. SECURITY DEFINER, `auth.uid()`-scoped | 0044 |
| `mark_conversation_read(p_conversation_id)` | void | Set the caller's own read cursor (`student_`/`tutor_last_read_at = now()`); raises if not a participant | 0044 |
| `unread_message_count()` | integer | Total unread across the caller's conversations (messages from the other party newer than the caller's cursor, `unsent_at IS NULL`). Drives the TopNav Messages pill. Recreated in 0045 to skip unsent | 0044 (0045) |
| `edit_message(p_message_id, p_body)` | messages | Sender rewrites their own, not-yet-unsent message: sets `body` + `edited_at = now()`; raises for non-sender / missing / unsent / blank. SECURITY DEFINER, `auth.uid()`-scoped | 0045 |
| `unsend_message(p_message_id)` | void | Sender soft-deletes their own message (`unsent_at = now()`, body kept for audit); raises for non-sender / missing. SECURITY DEFINER, `auth.uid()`-scoped | 0045 |

Note: verification **approve/reject have no RPC** — the admin has no session; the routes write via the service-role client gated by a signed HMAC token.

---

## Triggers

| Trigger | Table | Event | Function | Migration |
| --- | --- | --- | --- | --- |
| `on_auth_user_created` | `auth.users` | AFTER INSERT | `handle_new_user()` | 0001 |
| `on_auth_user_email_confirmed` | `auth.users` | AFTER UPDATE OF `email_confirmed_at` | `handle_user_email_confirmed()` | 0007 |
| `messages_bump_conversation` | `messages` | AFTER INSERT | `bump_conversation_last_message()` (sets `conversations.last_message_at`) | 0044 |

---

## RLS summary

| Table | Read | Write |
| --- | --- | --- |
| `profiles` | self; **+ public read for tutor rows** (0004); **+ conversation participants read each other** (0044) | self UPDATE |
| `tutor_profiles` | public | tutor self (ALL) |
| `student_profiles` | self; **+ the tutor in a shared conversation may read the student** (0044, for name/avatar) | self (ALL) |
| `saved_tutors` | self (own `student_id`) | self (ALL) |
| `conversations` | participants (`student_id`/`tutor_id` = uid) | participants UPDATE (read cursors); no INSERT (RPC-created, 0044) |
| `messages` | participants of the conversation | participant INSERT, `sender_id` = uid + first message must be the student's (0044); no UPDATE/DELETE — edit/unsend via RPC (0045) |
| `message_reactions` | participants of the reacted message's conversation (0045) | `user_id` = uid (+ participant) INSERT/UPDATE/DELETE (0045) |
| `subjects` / `exams` / `schools` | public | none (reference data) |
| `tutor_subjects` / `tutor_packages` / `tutor_experience` / `tutor_education` | public | tutor self-write |
| `ai_usage` | self | none (SECURITY DEFINER fns only) |
| `notifications` | self | self UPDATE (mark-read); no INSERT (service-role only) |
| `tutor_documents` | public | owner-scoped INSERT/UPDATE/DELETE |
| `storage.objects` (`profile-images`) | public | owner-scoped by folder = uid |
| `storage.objects` (`tutor-docs`) | public bucket (downloads bypass RLS; owner-only SELECT, needed by remove()) | owner-scoped INSERT/DELETE, no UPDATE |

> **Invariant:** `saveTutorProfile` never writes `verified` / `verification_status` — those are
> server-controlled so a tutor cannot self-verify.
