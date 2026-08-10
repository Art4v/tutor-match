# tutormatch — Current Database Schema

**Living reference.** This file describes the *cumulative* state of the `public` schema
after all migrations in `supabase/migrations/` have been applied in order. It is the
human-readable snapshot — the migrations remain the source of truth.

> **KEEP THIS UPDATED.** Every time you add a migration (`NNNN_*.sql`), edit this file in the
> same change so it reflects the new final state: add/rename/drop the columns, functions,
> triggers, policies, or seed data the migration introduces, and bump **Applied through** below.
> Edit the affected section in place (don't append a changelog) — this doc describes the *end
> state*, not the history. The migration files are the history.

**Applied through:** `0061_articles.sql`
**Last reviewed:** 2026-08-02

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
- **`rating` / `review_count` are trigger-derived from `reviews` (0057, 0058).** They were static
  placeholders (always NULL / 0) until 0057. `recalc_tutor_rating()` recomputes both by
  aggregating over **`get_tutor_reviews()`** (0058) — so there is exactly one definition of "a
  review that counts" (approved AND the author's account enabled) and the stored average always
  equals the average of the rows the profile actually renders. Fired on every insert/update/delete
  of a review, **and** on any change to `profiles.status` (0058), since disabling a reviewer
  changes the aggregate without touching a review row. `rating` is NULL when a tutor has no
  visible reviews, which is the "no rating" sentinel every reader already handles. **Never write them by hand:** a `before update` guard trigger
  (`tutor_profiles_guard_derived`) pins both columns back to their stored values for the `anon`
  and `authenticated` roles, because the `for all` self-write policy from 0001 would otherwise
  let a tutor set their own rating to 5.0 straight from the browser. A column-level `REVOKE`
  can't close that (a table-level grant wins over a column-level revoke in Postgres), hence the
  trigger.

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
| `status` | text | NOT NULL default `'enabled'`, CHECK in (`enabled`,`disabled`) (0052). `disabled` ⇒ `middleware.js` gates the user to `/account-disabled`, hides a disabled tutor from public reads, and (structurally) freezes their messaging. Flipped by the report-resolve route; reverse manually via `supabase/utilities/enable_user.sql` |
| `can_author_articles` | boolean | NOT NULL default `false` (0061). The blog authoring capability: `/author` and every `articles` write policy require it. **Not self-grantable** — the `profiles_guard_capabilities` trigger pins it for `authenticated`/`anon`, so the only grant path is `supabase/utilities/grant_author.sql` run as a superuser role. Independent of `role`: an author is a designated tutor, not a separate role |
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
| `rating` | numeric(2,1) | e.g. 4.9 (0002). **Derived** — recomputed from approved `reviews` by `recalc_tutor_rating()` (0057); NULL ⇒ no approved reviews. Not client-writable (guard trigger) |
| `review_count` | int | NOT NULL DEFAULT 0 (0002). **Derived** alongside `rating` (0057); not client-writable |
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

### `reviews` (0057)
One row per (tutor, student) — a student's 1–5 star rating of a tutor with optional text. Held invisible until an admin approves it from an emailed signed link. Drives the derived `tutor_profiles.rating` / `review_count`.

| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `id` | uuid | PK DEFAULT `gen_random_uuid()` |
| `tutor_id` | uuid | NOT NULL → `tutor_profiles(id)` ON DELETE CASCADE |
| `student_id` | uuid | NOT NULL → `student_profiles(id)` ON DELETE CASCADE — the FK is what makes "only students may review" a data-layer invariant (same reasoning as `saved_tutors`) |
| `rating` | int | NOT NULL, CHECK `between 1 and 5` — whole stars only, always required |
| `body` | text | nullable (text is optional); CHECK `body IS NULL OR (btrim(body) <> '' AND char_length(body) <= 500)` so a blank-but-present body can't reach the UI |
| `status` | text | NOT NULL DEFAULT `'pending'`, CHECK in (`pending`,`approved`,`rejected`,`removed`). `rejected` = admin declined (resubmittable by editing); `removed` = a report took it down (not resubmittable) |
| `created_at` | timestamptz | NOT NULL DEFAULT `now()` |
| `updated_at` | timestamptz | NOT NULL DEFAULT `now()`; maintained by the `reviews_touch_updated_at` trigger, never passed by a route |
| `approved_at` | timestamptz | nullable; stamped on approval |

UNIQUE `(tutor_id, student_id)` — one review per tutor per student, so a duplicate submit is a clean `23505` the route turns into a 409. Indexes: `(tutor_id, status, created_at desc)` (the profile read), `(student_id)` (all reviews by one author).

**RLS carries the moderation ladder structurally.** Both write policies have `status = 'pending'` in their `WITH CHECK`, so a student can neither self-approve nor leave a row in any other state — which means "editing an approved review sends it back to the queue" is a database invariant, not something a route has to remember. The UPDATE policy's `USING (… AND status <> 'removed')` stops an author editing a removed review back into circulation. Public SELECT is `status = 'approved'`; the author additionally reads their own row in **any** state (the only way a pending/rejected review is visible to its writer).

**Reads go through `get_tutor_reviews()`, not the table.** A public page cannot join the reviewer's name or avatar: 0055 narrowed the public `profiles` read to tutor rows, and `student_profiles` has been self-only since 0001. Rather than widen either policy, that SECURITY DEFINER function returns approved reviews plus exactly `full_name` + `avatar_url`. It also filters on the author's `profiles.status = 'enabled'`, so **disabling a reviewer (0052) hides their reviews site-wide** — which is how report resolution takes an abusive reviewer's content down. Since 0058 it is also the **single definition of a countable review**: `recalc_tutor_rating()` aggregates over it, so `tutor_profiles.rating` / `review_count` and the rendered list can never disagree.

### `articles` (0061)
The blog. One row per article, replacing the five JSX modules that used to live in `content/blog/` behind a manifest. `lib/blog.js` is the only reader.

| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `id` | uuid | PK DEFAULT `gen_random_uuid()` |
| `slug` | text | NOT NULL UNIQUE, CHECK non-blank — the `/blog/[slug]` URL |
| `title` | text | NOT NULL, CHECK non-blank |
| `excerpt` | text | nullable, CHECK non-blank if present. Card copy and the page's meta description |
| `category` | text | nullable, CHECK non-blank if present. **Free text, no CHECK list** — the page renders it conditionally and pinning the vocabulary would make "add a category" a migration |
| `body_md` | text | nullable, CHECK non-blank if present. **Markdown**, parsed per request by `lib/markdown.js` into the node tree `app/blog/[slug]/ArticleBody.jsx` renders. Sections and anchor ids come from `##` headings at parse time, so structure is derived from the copy rather than stored beside it |
| `status` | text | NOT NULL DEFAULT `'draft'`, CHECK in (`draft`,`pending`,`published`,`removed`) |
| `author_id` | uuid | → `tutor_profiles(id)` ON DELETE **SET NULL**. FK to `tutor_profiles` rather than `profiles` is what makes "an author is a tutor" structural (a CHECK cannot subquery). Set-null, not cascade: deleting the account costs the site its byline, not its article |
| `cover_path` | text | nullable, CHECK non-blank if present. A **path** inside `blog-images`, never a URL — baking the project ref into data breaks every image on a restore into another project |
| `cover_alt` | text | nullable, CHECK non-blank if present |
| `published_at` | **date** | reader-visible publish date |
| `content_updated_at` | **date** | reader-visible "Updated …" date, nullable |
| `created_at` | timestamptz | NOT NULL DEFAULT `now()` |
| `updated_at` | timestamptz | NOT NULL DEFAULT `now()`; maintained by `articles_touch_updated_at` |

CHECK `articles_cover_in_author_folder`: `cover_path IS NULL OR author_id IS NULL OR split_part(cover_path,'/',1) = author_id::text` — a row can only point at a path its own author could have written under the bucket policy. Both NULL branches matter: they are what stop ON DELETE SET NULL failing this check on an article that still has cover art. Indexes: `(status, published_at desc)` (the index page), `(author_id)`, `(category)`.

**Two date columns on purpose.** `content_updated_at` is authored copy the reader sees; `updated_at` is row bookkeeping. Merging them would mean the touch trigger bumped the reader-visible "Updated" date every time an admin flipped a status.

**RLS gates on the CAPABILITY, not just ownership.** Both write policies carry `exists (select 1 from profiles where id = auth.uid() and can_author_articles)` alongside `author_id = auth.uid()`, so an ordinary tutor cannot write to the blog even under their own name. `status in ('draft','pending','published')` in the same `WITH CHECK` means a designated author **does** publish their own work — the deliberate difference from `reviews` (0057), where a student is structurally barred from approving themselves. The trust boundary here is the flag plus its guard trigger, not the status. UPDATE and DELETE both carry `USING (… AND status <> 'removed')`, so removal is terminal and the record of what was published survives a takedown. Public SELECT is `status = 'published'`; the author additionally reads their own row in any status.

Revoking `can_author_articles` freezes everything that author owns: published articles stay live (public SELECT only looks at status) but every write policy fails from then on. To take an article down, set its `status` to `removed` instead.

`pending` is in the CHECK but nothing sets it. It is kept so an editorial review step is later a route plus a UI rather than a schema change: the signed-link pattern (`lib/reviewToken.js` → `/api/reviews/approve` → `/admin/review`) drops straight on top.

**No SECURITY DEFINER read function**, unlike `reviews`. That one exists because a public page cannot join a *student's* name; article authors are tutors, so a plain PostgREST select with embeds works for anonymous readers. The author embed is a **LEFT join** in `lib/blog.js`, deliberately: an inner join would silently unpublish every article an author ever wrote the moment their account was disabled (0055 hides the rows). Left-joined, the byline degrades to nothing and the article stays up — account status governs the account, `articles.status` governs the article.

### `blocked_users` (join, 0049)
Mutual block between two accounts — one row per (blocker, blocked) pair. Written by the block/unblock controls (messages thread header + tutor profile). A block is **silent** (no policy exposes rows where you are the `blocked_id`) and **reversible** (unblock deletes the row).

| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `blocker_id` | uuid | PK part → `auth.users(id)` ON DELETE CASCADE |
| `blocked_id` | uuid | PK part → `auth.users(id)` ON DELETE CASCADE; CHECK `blocker_id <> blocked_id` |
| `created_at` | timestamptz | NOT NULL DEFAULT `now()` |

**Index:** `(blocked_id)` (reverse lookup). Self-only RLS on `blocker_id` (SELECT/INSERT/DELETE). **Enforcement:** the `messages` INSERT policy and `start_conversation()` were recreated in 0049 to refuse when a block exists in **either** direction between the two participants (freezes sends + blocks reopening a thread). **Blocked-party visibility:** the table's RLS stays blocker-only, but `conversation_block_state()` (0050, SECURITY DEFINER) lets a participant learn the block state of *their own* conversation (`blocked_by_me` / `blocked_by_other`) so the blocked party sees a closed "you've been blocked" composer instead of a silent failure.

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
| `student_last_notified_at` | timestamptz | When the student was last notified about this thread (0047); throttles email/notifications to one per unread streak, set by `claim_message_notification` |
| `tutor_last_notified_at` | timestamptz | Tutor's notified cursor (0047) |
| `student_last_active_at` | timestamptz | Student's presence heartbeat while viewing this thread (0048); set by `touch_conversation_presence`, read by `claim_message_notification` to skip notifying a recipient watching live |
| `tutor_last_active_at` | timestamptz | Tutor's presence cursor (0048) |

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

### `reports` (0053)
"Report and block": a user reports the other party in a conversation; an admin reviews on `/admin/report` (signed-token, no login) and resolves by disabling an account or dismissing.
| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `id` | uuid | PK DEFAULT `gen_random_uuid()` |
| `reporter_id` | uuid | NOT NULL → `auth.users(id)` ON DELETE CASCADE |
| `reported_id` | uuid | NOT NULL → `auth.users(id)` ON DELETE CASCADE; CHECK `reporter_id <> reported_id` |
| `conversation_id` | uuid | → `conversations(id)` ON DELETE SET NULL; NULL on a review report |
| `review_id` | uuid | → `reviews(id)` **ON DELETE SET NULL** (0059); NULL on a conversation report |
| `category` | text | NOT NULL, CHECK in (`harassment`,`spam`,`inappropriate`,`scam`,`other`,`inappropriate_review`) (0059) |
| `details` | text | nullable; optional free-text |
| `status` | text | NOT NULL default `'pending'`, CHECK in (`pending`,`resolved`) |
| `resolution` | text | nullable, CHECK in (`disabled_reported`,`disabled_reporter`,`dismissed`,`removed_review`) (0059) — set on resolve |
| `resolved_at` | timestamptz | nullable |
| `created_at` | timestamptz | NOT NULL DEFAULT `now()` |

A report is about **either** a conversation **or** a review (0059): `review_id` is a nullable FK to `reviews`, **ON DELETE SET NULL** rather than cascade, so an author deleting a reported review can't erase the report along with it (otherwise: post abuse, wait for a report, delete before the admin looks, repeat).

Two partial unique indexes, split by kind (0059), so a pending conversation report can't silently swallow a report about the same person's review: `reports_one_open_per_pair` on `(reporter_id, reported_id) WHERE status='pending' AND conversation_id IS NOT NULL` (re-keyed in 0060 — the 0059 predicate was `review_id IS NULL`, which the ON DELETE SET NULL FK would migrate an orphaned review report into, aborting the review delete on collision or squatting the pair slot so a later conversation report silently no-oped), and `reports_one_open_per_review` on `(reporter_id, review_id) WHERE status='pending' AND review_id IS NOT NULL`. Indexes on `conversation_id` and `review_id`. RLS: reporter self-SELECT only; **no INSERT/UPDATE policy** — written by the service-role client in the report routes (like `notifications`).

**Filing a review report does not block anyone**, unlike the conversation path where the block is a server-owned invariant: you may be reporting a stranger's review of a third party, and a tutor auto-blocking a critic would read as retaliation.

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

### Storage: `blog-images` bucket (0061)
**Public** — article cover art behind `articles.cover_path`, at `<author_uid>/<slug>-<timestamp>.<ext>`. Bucket-level `file_size_limit` 5 MB + `allowed_mime_types` `{image/*}`. Public SELECT; owner-scoped INSERT/UPDATE/DELETE keyed on `(storage.foldername(name))[1] = auth.uid()::text`. Modelled on `profile-images`, **not** `tutor-docs`: cover art is replaceable, so UPDATE exists and uploads may use upsert. The public SELECT policy is also what keeps owner deletes working (the 0035 lesson: `remove()` checks SELECT as well as DELETE) — do not narrow it without adding an owner SELECT policy in the same change.

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
| `start_conversation(p_tutor_id)` | uuid | Student-only gate (raises otherwise): validates the target is a public, email-confirmed tutor, **that no block exists in either direction** (0049), **and that neither party is disabled** (0052), then find-or-creates the `(student, tutor)` conversation and returns its id. Invoked at first-send. SECURITY DEFINER, `auth.uid()`-scoped | 0044, 0049, 0052 |
| `conversation_block_state(p_conversation_id)` | `(blocked_by_me bool, blocked_by_other bool)` | Reports the block state of a conversation the caller participates in (raises for non-participants). Lets the blocked party see a closed composer without broadening `blocked_users` RLS. SECURITY DEFINER, `auth.uid()`-scoped | 0050 |
| `mark_conversation_read(p_conversation_id)` | void | Set the caller's own read cursor (`student_`/`tutor_last_read_at = now()`); raises if not a participant | 0044 |
| `unread_message_count()` | integer | Total unread across the caller's conversations (messages from the other party newer than the caller's cursor, `unsent_at IS NULL`). Drives the TopNav Messages pill. Recreated in 0045 to skip unsent | 0044 (0045) |
| `edit_message(p_message_id, p_body)` | messages | Sender rewrites their own, not-yet-unsent message: sets `body` + `edited_at = now()`; raises for non-sender / missing / unsent / blank. SECURITY DEFINER, `auth.uid()`-scoped | 0045 |
| `unsend_message(p_message_id)` | void | Sender soft-deletes their own message (`unsent_at = now()`, body kept for audit); raises for non-sender / missing. SECURITY DEFINER, `auth.uid()`-scoped | 0045 |
| `claim_message_notification(p_conversation_id)` | uuid | Called by the sender after inserting a message: atomically (row lock) decides whether to notify the recipient, throttled to one per unread streak (`notified IS NULL OR notified <= read`) **and** skipped (without stamping) when the recipient is actively viewing the thread (`active_at` within 60s, 0048); stamps the recipient's `*_last_notified_at` when notifying, and returns the recipient id to notify or NULL to skip. SECURITY DEFINER, `auth.uid()`-scoped | 0047 (0048) |
| `get_tutor_reviews(p_tutor_id)` | TABLE(id, rating, body, created_at, updated_at, author_name, author_avatar_url) | The public read path for reviews. SECURITY DEFINER because the caller can't read a student's `profiles` / `student_profiles` row (0055 / 0001) — returns approved reviews joined to exactly the two author display fields, and skips authors whose account is disabled. Execute granted to anon + authenticated | 0057 |
| `recalc_tutor_rating(p_tutor_id)` | void | Recompute `tutor_profiles.rating` (`round(avg,1)`, NULL when none) + `review_count` by **aggregating over `get_tutor_reviews()`** (0058), so the columns can never disagree with the rendered list. SECURITY DEFINER; **execute revoked from anon/authenticated** — called only by the `reviews_recalc_rating` and `profiles_status_recalc_ratings` triggers | 0057 → 0058 |
| `profiles_status_recalc_ratings()` | trigger | On a `profiles.status` change, recalculate every tutor the user has reviewed — the aggregate depends on author status, and the review trigger alone would leave it stale. No-op for tutors (`reviews.student_id` → `student_profiles`) | 0058 |
| `reviews_recalc_rating()` | trigger | Calls `recalc_tutor_rating` after any review insert/update/delete (and for the old tutor too if `tutor_id` ever changed). Fires on UPDATE as well, because every status transition moves the aggregate without a row appearing/disappearing | 0057 |
| `reviews_touch_updated_at()` | trigger | Stamps `reviews.updated_at = now()` before update | 0057 |
| `tutor_profiles_guard_derived()` | trigger | Pins `rating` / `review_count` to their stored values when `current_user` is `anon`/`authenticated`, so the 0001 `for all` self-write policy can't be used to self-award a rating. Pins rather than raises. Passes through for the SECURITY DEFINER recalc path and `service_role` | 0057 |
| `touch_conversation_presence(p_conversation_id)` | void | Recipient's client heartbeat (~30s while the thread is open + tab visible): sets the caller's own `*_last_active_at = now()`; no-op for non-participants. Feeds the presence skip in `claim_message_notification`. SECURITY DEFINER, `auth.uid()`-scoped | 0048 |

Note: verification **approve/reject have no RPC** — the admin has no session; the routes write via the service-role client gated by a signed HMAC token.

---

## Triggers

| Trigger | Table | Event | Function | Migration |
| --- | --- | --- | --- | --- |
| `on_auth_user_created` | `auth.users` | AFTER INSERT | `handle_new_user()` | 0001 |
| `on_auth_user_email_confirmed` | `auth.users` | AFTER UPDATE OF `email_confirmed_at` | `handle_user_email_confirmed()` | 0007 |
| `messages_bump_conversation` | `messages` | AFTER INSERT | `bump_conversation_last_message()` (sets `conversations.last_message_at`) | 0044 |
| `reviews_recalc_rating` | `reviews` | AFTER INSERT/UPDATE/DELETE | `reviews_recalc_rating()` → recomputes the tutor's `rating` / `review_count` | 0057 |
| `reviews_touch_updated_at` | `reviews` | BEFORE UPDATE | `reviews_touch_updated_at()` | 0057 |
| `tutor_profiles_guard_derived` | `tutor_profiles` | BEFORE UPDATE | `tutor_profiles_guard_derived()` → pins the derived `rating` / `review_count` against client writes | 0057 |
| `profiles_status_recalc_ratings` | `profiles` | AFTER UPDATE OF `status` (WHEN changed) | `profiles_status_recalc_ratings()` → refresh the aggregates of every tutor this user reviewed | 0058 |
| `articles_touch_updated_at` | `articles` | BEFORE UPDATE | `articles_touch_updated_at()` — touches `updated_at` only, never the reader-visible `content_updated_at` | 0061 |
| `profiles_guard_capabilities` | `profiles` | BEFORE UPDATE | `profiles_guard_capabilities()` → pins `can_author_articles` against client writes, so nobody can grant themselves blog authoring | 0061 |

---

## RLS summary

| Table | Read | Write |
| --- | --- | --- |
| `profiles` | self; **+ public read for tutor rows** (0004); **+ conversation participants read each other** (0044) | self UPDATE, **except `can_author_articles`, pinned by the `profiles_guard_capabilities` trigger (0061)** — note the self-update policy has no `WITH CHECK` and no column restriction, which is exactly why the guard is a trigger |
| `tutor_profiles` | public | tutor self (ALL), **except the derived `rating` / `review_count`, pinned by a guard trigger (0057)** |
| `student_profiles` | self; **+ the tutor in a shared conversation may read the student** (0044, for name/avatar) | self (ALL) |
| `saved_tutors` | self (own `student_id`) | self (ALL) |
| `reviews` | public where `status='approved'`; **+ author reads own row in any status** | author (`student_id` = uid) INSERT/UPDATE/DELETE, with INSERT+UPDATE forced to `status='pending'` so a student can't self-approve (0057) |
| `blocked_users` | self (own `blocker_id`) — a block is invisible to the blocked user | self (own `blocker_id`) INSERT/DELETE (0049) |
| `conversations` | participants (`student_id`/`tutor_id` = uid) | participants UPDATE (read cursors); no INSERT (RPC-created, 0044) |
| `messages` | participants of the conversation | participant INSERT, `sender_id` = uid + first message must be the student's (0044) + no block between participants (0049) + neither participant disabled (0052); no UPDATE/DELETE — edit/unsend via RPC (0045) |
| `message_reactions` | participants of the reacted message's conversation (0045) | `user_id` = uid (+ participant) INSERT/UPDATE/DELETE (0045) |
| `subjects` / `exams` / `schools` | public | none (reference data) |
| `tutor_subjects` / `tutor_packages` / `tutor_experience` / `tutor_education` | public | tutor self-write |
| `ai_usage` | self | none (SECURITY DEFINER fns only) |
| `notifications` | self | self UPDATE (mark-read); no INSERT (service-role only) |
| `reports` | reporter self (own `reporter_id`) | none (service-role only, 0053) |
| `tutor_documents` | public | owner-scoped INSERT/UPDATE/DELETE |
| `storage.objects` (`profile-images`) | public | owner-scoped by folder = uid |
| `storage.objects` (`tutor-docs`) | public bucket (downloads bypass RLS; owner-only SELECT, needed by remove()) | owner-scoped INSERT/DELETE, no UPDATE |
| `articles` | public where `status='published'`; **+ author reads own row in any status** | author (`author_id` = uid) **who also holds `profiles.can_author_articles`** — INSERT/UPDATE may set `status in ('draft','pending','published')` (designated authors self-publish); UPDATE/DELETE blocked once `status='removed'` (0061) |
| `storage.objects` (`blog-images`) | public | owner-scoped by folder = uid, INSERT/UPDATE/DELETE (0061) |

> **Invariant:** `saveTutorProfile` never writes `verified` / `verification_status` — those are
> server-controlled so a tutor cannot self-verify.
>
> **Invariant:** nothing in the app writes `tutor_profiles.rating` / `review_count`. They are
> derived from approved `reviews` by `recalc_tutor_rating()` and pinned against client writes by
> the `tutor_profiles_guard_derived` trigger (0057), so a tutor cannot self-award a rating.
>
> **Invariant:** nothing in the app writes `profiles.can_author_articles`. It is granted out of
> band via `supabase/utilities/grant_author.sql` and pinned against client writes by the
> `profiles_guard_capabilities` trigger (0061), so a user cannot grant themselves the ability to
> publish to the blog.
