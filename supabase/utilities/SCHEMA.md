# tutormatch — Current Database Schema

**Living reference.** This file describes the *cumulative* state of the `public` schema
after all migrations in `supabase/migrations/` have been applied in order. It is the
human-readable snapshot — the migrations remain the source of truth.

> **KEEP THIS UPDATED.** Every time you add a migration (`NNNN_*.sql`), edit this file in the
> same change so it reflects the new final state: add/rename/drop the columns, functions,
> triggers, policies, or seed data the migration introduces, and bump **Applied through** below.
> Edit the affected section in place (don't append a changelog) — this doc describes the *end
> state*, not the history. The migration files are the history.

**Applied through:** `0075_drop_company_inviters.sql`
**Last reviewed:** 2026-10-19

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
| `public.user_role` | `'tutor'`, `'student'`, `'partner'` | 0001; `'partner'` added 0062 |

> `'partner'` is **not selectable at `/choose-role`** — `choose_role()` raises on it (0063). The only
> way an account becomes a partner is claiming a signed invite link, which is what makes "partners
> are invite only" a property of the database rather than of which buttons the UI renders.
> Note `alter type ... add value` is irreversible: Postgres has no `drop value`.

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
| `is_admin` | boolean | NOT NULL default `false` (0074). The admin capability: every `/admin` page (404 otherwise) and every `admin_*` RPC require it, via `is_admin()`, which also requires `status = 'enabled'`. **Changed only in SQL** with `supabase/utilities/grant_admin.sql`: no RPC, route or UI writes it, and `profiles_guard_capabilities` RAISES on a client change. Any role may hold it. The dashboard refuses to disable an admin or change their authoring |
| `admin_alerts_muted` | boolean | NOT NULL default `false` (0074). An admin's opt-out of the alert emails (`lib/admin/alerts.js`). Self-writable through `"profile self update"`; meaningless for a non-admin |
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
| `rate` | int | AUD/hour. **Always NULL for partner tutors** since 0069 (a centre prices by package only; 0066's cheapest-package mirror showed a package price as hourly, so it was removed and the column cleared). Enforced by CHECK `tutor_profiles_partner_no_rate` (`partner_id IS NULL OR rate IS NULL`), since 0065's partner write policy would otherwise let an owner set it via PostgREST. /browse's `rateMax` filter lets partner tutors through explicitly. An ordinary tutor still sets it themselves |
| `partner_id` | uuid | nullable → `partners(id)` ON DELETE CASCADE (0065). **Non-null ⇒ a partner tutor**: listed and controlled by a tutoring centre, backed by a shadow `auth.users` row that cannot sign in. One nullable FK rather than a boolean plus a link, so the two can't disagree. Drives the partner chip, the centre's rate card, the Enquire button, the `start_conversation` refusal and the `/api/reviews` 403 |
| `onboarded` | bool | NOT NULL DEFAULT false; drives `/onboarding` gate (0018) |
| `managed_at` | timestamptz | (0076) **Non-null ⇒ admin-managed**: the tutor consented on `/join` to MatchTutor managing the profile (doubles as the consent time). Makes `tutor_edits_gated()` true, so the tutor's own edits become drafts; visibility is admin-only. Cleared only by `opt_out_of_management()` |
| `managed_setup_done_at` | timestamptz | (0076) NULL ⇒ in the admin "New tutors" queue (`admin_pending_counts().invites`) |
| `invite_materials_submitted_at` | timestamptz | (0076) The once-only `/join/details` submit (or Skip) |
| `admin_edited_at` | timestamptz | (0076) Last live admin edit; drives the stale-draft warning on `/admin/profile-changes/[id]` |
| `updated_at` | timestamptz | NOT NULL DEFAULT `now()` (0002) |

**Indexes:** `(visibility)`, `(city)`, `(atar)`, `(rate)` (0004); `(email_confirmed_at)` (0007); `(service_lat, service_lng)` (0008).

### `student_profiles`
| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `id` | uuid | PK → `profiles(id)` ON DELETE CASCADE |
| `avatar_url` | text | Student profile photo — `profile-images` upload (0043); shown on `/account` + the top-nav chip |
| `created_at` | timestamptz | NOT NULL DEFAULT `now()` |

### `partners` (0063)
A tutoring centre. **Invite only:** we create the row (pre-filled from the centre's own website),
the page goes live immediately, and the centre claims it later with a signed link. There is
deliberately **no verification column** — only we can create a partner, so existence is the
endorsement and there is nothing left to verify.

**This table breaks the extension-table pattern on purpose.** `tutor_profiles` and
`student_profiles` key on `profiles.id`; `partners` has its own uuid plus a separate nullable
`owner_id`, because the row must exist *before* anyone signs up. Keying on `profiles.id` would make
the entire invite model impossible. Do not "fix" this.

| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `id` | uuid | PK DEFAULT `gen_random_uuid()` — **not** `profiles.id`, see above |
| `owner_id` | uuid | UNIQUE, nullable → `profiles(id)` **ON DELETE SET NULL**. NULL ⇒ unclaimed (and still publicly visible). Set null, not cascade, so an owner deleting their account reverts the centre to unclaimed rather than deleting the page and its tutors |
| `slug` | text | NOT NULL UNIQUE; assigned by `_assign_partner_slug()` |
| `name` | text | NOT NULL, CHECK `btrim(name) <> ''`. The **business** name — distinct from `profiles.full_name`, which is the person who manages it |
| `website_url` | text | nullable; where "Enquire at &lt;name&gt;" sends people. Partners cannot be DM'd |
| `bio` | text | one-line tagline |
| `bio_long` | text | the About section |
| `suburb` | text | nullable |
| `city` | text | nullable; stores the **state code**, matching `tutor_profiles.city` |
| `service_lat` / `service_lng` | double precision | nullable; the centre is a fixed site |
| `logo_url` / `banner_url` | text | nullable; `profile-images` bucket |
| `avatar_bg` / `banner_bg` / `initials` | text | nullable; fallbacks when no image is set |
| `visibility` | text | NOT NULL default `'public'`, CHECK in (`public`,`hidden`). Companies created in-app via `create_partner_as_inviter` (0068) start `hidden`; the CLI script leaves the default |
| `rating` | numeric(2,1) | nullable (0067); derived from approved company reviews by `recalc_partner_rating()`, pinned against client writes by `partners_guard_derived` |
| `review_count` | int | NOT NULL default `0` (0067); derived, as above |
| `created_by` | uuid | nullable → `profiles(id)` ON DELETE SET NULL (0068). The inviter who created the company in-app; NULL for companies made by `npm run create:company` |
| `created_at` / `updated_at` | timestamptz | NOT NULL DEFAULT `now()`; `updated_at` maintained by `partners_touch_updated_at` |

**Indexes:** `(visibility)`, `(city)`.
**RLS:** public SELECT on `visibility = 'public' AND (owner_id IS NULL OR owner profiles.status = 'enabled')` —
the `owner_id IS NULL` arm is what keeps an unclaimed page live. Owner SELECT/UPDATE on
`owner_id = auth.uid()`. **No INSERT or DELETE policy at all:** partners are created by us, either
through the service role (`npm run create:company`) or in-app by an inviter through the SECURITY
DEFINER `create_partner_as_inviter()` (0068), which checks the caller is an admin (0074). Nothing
creates one through table RLS. Deletion is the admin RPC `admin_delete_company` (0074) or
`supabase/utilities/delete_company.sql`.

### `partner_packages` (0063)
The centre's one rate card, and since 0069 its only pricing: there is no hourly rate for a centre or
its tutors. Every tutor listed under the partner displays these packages rather than a rate of their
own. Nothing derives from it any more (0066's rate mirror is gone).

| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `id` | uuid | PK DEFAULT `gen_random_uuid()` |
| `partner_id` | uuid | NOT NULL → `partners(id)` ON DELETE CASCADE |
| `label` | text | NOT NULL, e.g. "Single lesson" |
| `price` | int | NOT NULL, AUD |
| `position` | int | NOT NULL default 0 |

**Index:** `(partner_id, position)`. Public SELECT follows the parent partner's visibility; owner
has `FOR ALL` scoped through `partners.owner_id`.

### `saved_tutors` (join, 0042)
Student bookmarks — one row per saved tutor. Read/written by the bookmark button and the `/browse ?saved=1` filter.

| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `student_id` | uuid | PK part → `student_profiles(id)` ON DELETE CASCADE |
| `tutor_id` | uuid | PK part → `tutor_profiles(id)` ON DELETE CASCADE |
| `created_at` | timestamptz | NOT NULL DEFAULT `now()` |

**Index:** `(student_id, created_at desc)`. Self-only RLS on `student_id` (student reads/writes only their own saves).

### `reviews` (0057, widened 0067)
One row per (tutor, student) **or** (partner, student) — a student's 1–5 star rating of a tutor with optional text. Held invisible until an admin approves it from an emailed signed link. Drives the derived `tutor_profiles.rating` / `review_count`.

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

`pending` is in the CHECK but nothing sets it. It is kept so an editorial review step is later a route plus a UI rather than a schema change: an admin-RPC + `/admin` section in the shape of reviews (`admin_decide_review` → `/api/admin/reviews` → `/admin/reviews`) drops straight on top.

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

**Index:** `(tutor_id, position)`. Public read; writes RPC-only since 0071 (`save_tutor_profile`).

### `tutor_packages`
| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `id` | uuid | PK DEFAULT `gen_random_uuid()` |
| `tutor_id` | uuid | NOT NULL → `tutor_profiles(id)` ON DELETE CASCADE |
| `label` | text | NOT NULL |
| `price` | int | NOT NULL; AUD |
| `position` | int | NOT NULL DEFAULT 0 |

**Index:** `(tutor_id, position)`. Public read; writes RPC-only since 0071 (`save_tutor_profile`).

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

**Index:** `(tutor_id, position)`. Public read; writes RPC-only since 0071 (`save_tutor_profile`).

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

**Indexes:** `(tutor_id, position)`, `(school_id)` (0026). Public read; writes RPC-only since 0071 (`save_tutor_profile`).

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
"Report and block": a user reports the other party in a conversation; an admin reviews on `/admin/reports/[id]` (0074, admin session) and resolves through `admin_resolve_report` by disabling an account, removing the review, or dismissing.
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

### `admin_actions` (0074)
Append-only History of every admin action, shown at `/admin/history`, on each user's page, and as the "decided by" line on a decided item.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | PK, `gen_random_uuid()` |
| `admin_id` | uuid | FK → `profiles.id`, ON DELETE SET NULL |
| `admin_name` | text | Snapshot of the admin's name, so the row survives their account |
| `action` | text | NOT NULL, CHECK in `verification_approved/rejected`, `review_approved/rejected`, `report_disable_reported/disable_reporter/dismiss/remove_review`, `revision_approved/rejected`, `account_disabled/enabled`, `author_granted/revoked`, `company_invited/link_issued/hidden/shown/deleted`, and (0076) `tutor_invite_rotated`, `managed_profile_edited`, `managed_visibility_set`, `managed_document_changed`, `verification_set`, `managed_setup_done` |
| `target_type` | text | NOT NULL, CHECK in `tutor` / `review` / `report` / `revision` / `company` / `user` |
| `target_id` | uuid | **No FK**, so the record outlives a deleted target |
| `target_label` | text | Readable snapshot ("Review of …", the company name) |
| `reason` | text | The admin's optional note, ≤ 500 chars |
| `details` | jsonb | NOT NULL default `{}` (e.g. a deleted company's slug and tutor count) |
| `created_at` | timestamptz | NOT NULL default `now()` |

Indexes on `(created_at desc)`, `(admin_id, created_at desc)`, `(target_type, target_id, created_at desc)`. **RLS:** SELECT where `is_admin()`; no write policy. Rows are written only by `_log_admin_action`, called from the admin RPCs.

### `tutor_documents` (0034)
| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `id` | uuid | PK DEFAULT `gen_random_uuid()` |
| `tutor_id` | uuid | NOT NULL → `tutor_profiles(id)` ON DELETE CASCADE |
| `storage_path` | text | NOT NULL UNIQUE; `<uid>/<timestamp>-<name>` in `tutor-docs`; CHECK `split_part(storage_path,'/',1) = tutor_id::text` (row can only point into the owner's folder) |
| `title` | text | NOT NULL, CHECK non-blank — tutor-chosen display title (app defaults to the cleaned filename) |
| `uploaded_at` | timestamptz | NOT NULL DEFAULT `now()` |

Index on `tutor_id`. Public SELECT (the profile page reads any tutor's rows with the anon client). **Writes are RPC-only** (0071 dropped the 0034 owner INSERT/UPDATE/DELETE policies): `add_tutor_document` (checks the folder, that the object exists in `tutor-docs`, and the 5-document cap), `rename_tutor_document`, `delete_tutor_document` (returns the storage path for file cleanup). This table is the source of truth for the profile "Documentation" card — the app never lists the bucket. On account deletion rows cascade; the storage files orphan (accepted, like 0015's profile-images note).

### Storage: `profile-images` bucket (0006)
Public read; owner-scoped INSERT/UPDATE/DELETE keyed on `(storage.foldername(name))[1] = auth.uid()::text`. Bucket-level `file_size_limit` 5 MB + `allowed_mime_types` `{image/jpeg, image/png, image/webp, image/gif}` since 0070 (no SVG: public bucket). A stored `avatar_url` / `banner_url` must point into the writer's own folder of this bucket (`_valid_profile_image`, 0070), or be unchanged.

### Storage: `tutor-docs` bucket (0034; replaced the private `verification-docs` bucket from 0033)
**Public** — the files behind `tutor_documents`, at `<uid>/<timestamp>-<name>`. Bucket-level `file_size_limit` 10 MB + `allowed_mime_types` `{application/pdf, image/*}`. Owner-scoped SELECT (0035) / INSERT / DELETE (folder = uid) — the app never lists the bucket (reads go through the table; public-bucket downloads bypass RLS), but the owner SELECT is required because the Storage API's `remove()` checks SELECT as well as DELETE (without it the owner's delete silently no-ops). **No UPDATE policy** — files are immutable, so uploads must not use upsert. Not part of the verification flow. 0034 dropped the old bucket's policies; the bucket itself is emptied + deleted in the dashboard (Supabase's `storage.protect_delete()` trigger blocks SQL DELETEs on storage tables) rather than migrating the files — they were uploaded under a private-and-deleted-after-review promise.

### `tutor_profile_revisions` (0072)
A verified tutor's reviewed profile draft. Verified, non-company tutors (`tutor_edits_gated()`) edit through this table instead of the live profile; nothing reaches `tutor_profiles` until an admin approves a submission.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | PK, `gen_random_uuid()` |
| `tutor_id` | uuid | FK → `tutor_profiles.id`, ON DELETE CASCADE |
| `status` | text | NOT NULL default `'draft'`, CHECK in `draft` / `pending` / `approved` / `rejected` / `withdrawn` / `discarded` / `cancelled` |
| `payload` | jsonb | NOT NULL. The `save_tutor_profile` payload (minus visibility) plus `full_name` and `documents: [{ id \| null, title, path \| null, staged_path \| null }]`. A new photo is `'staging:<uid>/<file>'` in `profile.avatar_url` / `banner_url` |
| `applied_payload` | jsonb | The payload as applied, staged references swapped for public ones |
| `parent_id` | uuid | FK → self, ON DELETE SET NULL. The rejected/withdrawn revision this draft was copied from |
| `reason` | text | Admin's optional rejection note; CHECK non-blank and ≤ 500 chars |
| `created_at` / `updated_at` | timestamptz | |
| `submitted_at` | timestamptz | Set by `submit_profile_revision` |
| `admin_notified_at` | timestamptz | Last admin alert; enforces the once-a-day resend durably |
| `decided_at` | timestamptz | Approve / reject / withdraw / discard / cancel time |

Partial UNIQUE index `tutor_profile_revisions_one_open (tutor_id) WHERE status IN ('draft','pending')`: one open revision per tutor. `rejected` and `withdrawn` are final; each opens a fresh draft copying the content (`parent_id` back), so an old email link always reports the true outcome. RLS: owner SELECT only; every write is an RPC.

### Storage: `profile-staging` bucket (0072)
**Private.** Draft photos and documents of verified tutors at `<uid>/<file>`, until approval copies them into `profile-images` / `tutor-docs` under the same path. `file_size_limit` 10 MB, `allowed_mime_types` `{image/*, application/pdf}`. Owner SELECT / DELETE on their own folder; owner INSERT additionally requires `caller_edits_gated()` (0076; `tutor_edits_gated(auth.uid())` before). The owner previews through signed URLs, the admin page through the service role.

### `tutor_invite_key` (0076)
Singleton (`id boolean PK CHECK (id)`): `key` (32 hex chars), `rotated_at`, `rotated_by` → `profiles` ON DELETE SET NULL. The key in the universal tutor invite link `/join?k=<key>`. RLS on, **no policies**: read and rotated only by `admin_get_tutor_invite_key` / `admin_rotate_tutor_invite_key`, compared only inside `tutor_invite_key_valid` / `redeem_tutor_invite` (service role). No expiry, by decision; rotating kills the old link.

### `tutor_invite_materials` (0076)
The optional private documents and links a tutor sends from `/join/details`. `id`, `tutor_id` → `tutor_profiles` ON DELETE CASCADE, `kind` (`document` / `link`), `storage_path` (documents; CHECK first folder = `tutor_id`), `title` (documents only; a link's must be NULL), `url` (links only; CHECK `^https?://[^\s]+$`, ≤ 500), `position`, `created_at`. RLS on, **no client policies**: written by `submit_invite_materials`, read by admins through the service role, deleted by `opt_out_of_management`.

### Storage: `tutor-invite-materials` bucket (0076)
**Private**, 10 MB, `{application/pdf, image/jpeg, image/png, image/webp, image/gif}` (explicit, so no SVG). **No client policies at all.** The tutor uploads only through a signed upload URL from `/api/join/materials/upload`, which first checks the session, `can_upload_invite_materials` (managed and not yet submitted), type, size and that the folder holds fewer than 10 files. The tutor never reads these back; admins use signed URLs; `/api/join/materials` sweeps unsent files and the opt-out route removes the rest, both with the service role.

### Storage: `blog-images` bucket (0061)
**Public** — article cover art behind `articles.cover_path`, at `<author_uid>/<slug>-<timestamp>.<ext>`. Bucket-level `file_size_limit` 5 MB + `allowed_mime_types` `{image/*}`. Public SELECT; owner-scoped INSERT/UPDATE/DELETE keyed on `(storage.foldername(name))[1] = auth.uid()::text`. Modelled on `profile-images`, **not** `tutor-docs`: cover art is replaceable, so UPDATE exists and uploads may use upsert. The public SELECT policy is also what keeps owner deletes working (the 0035 lesson: `remove()` checks SELECT as well as DELETE) — do not narrow it without adding an owner SELECT policy in the same change.

The bucket holds **two** object shapes. Cover art as above, and **body images** at `<author_uid>/body-<epochms>-<rand>-<w>x<h>.webp`, referenced from inside `articles.body_md` as `![alt](<path>)` rather than from any column. That difference matters: `articles_cover_in_author_folder` constrains `cover_path`, but **no CHECK can constrain a body image path**, because a constraint would have to parse Markdown in SQL and stay in lockstep with `lib/markdown.js`. Their per-author folder is therefore enforced by exactly two things: the bucket's owner INSERT policy, which is airtight since an author physically cannot write outside their own folder, and `safeImagePath` in `lib/markdown.js`, which refuses to turn any other shape into a renderable node. What is **not** enforced is that the uuid is *this* author's — hand-typing another author's uuid yields an `<img>` pointing at an already-public object in the same public bucket, which is intra-bucket hotlinking rather than a privacy or XSS issue, and the owner-scoped DELETE policy means the article delete sweep cannot touch it either. The `-<w>x<h>` segment is the post-downscale size, parsed back out by the renderer to reserve the box; it is written only by `uploadArticleBodyImage`.

---

## Functions / RPCs

| Function | Returns | Purpose | Migration |
| --- | --- | --- | --- |
| `handle_new_user()` | trigger | On signup: create the `profiles` row only, with **role NULL** (role is deferred to `choose_role()`); name←Google `name` claim; stamp `profiles.terms_agreed_at` for every role. No longer creates the role extension table or assigns a slug | 0001 → 0016/0025/0039/0041 |
| `choose_role(p_role)` | void | Authenticated, `auth.uid()`-scoped, one-time: set `profiles.role` and create the matching extension row (tutor → placeholder slug + `_assign_tutor_slug` + mirror `email_confirmed_at`; else `student_profiles`). Raises if a role is already set. **Raises on `'partner'`** (0063) — 0041's `else` was a catch-all that would otherwise hand a partner a `student_profiles` row, and raising is what makes invite-only structural | 0041 → 0063 |
| `handle_user_email_confirmed()` | trigger | Mirror `auth.users.email_confirmed_at` onto `tutor_profiles` on confirmation | 0007 |
| `generate_unique_slug(p_name)` | text | Name→slug with collision suffix; superseded by `_assign_tutor_slug` (0013) but still present | 0004 |
| `_assign_tutor_slug(p_id, p_name)` | text | Race-safe slug assignment (retry on unique_violation). SECURITY DEFINER; execute revoked from anon/authenticated | 0013 |
| `assign_tutor_slug(p_name)` | text | Authenticated wrapper scoped to `auth.uid()`. **Execute revoked from every client role in 0071**; renames go through `save_tutor_profile` → `_apply_tutor_name` | 0013, 0071 |
| `tutors_within_service_radius(lat, lng, include_online)` | TABLE(id uuid) | Haversine (no PostGIS) — ids of public+confirmed tutors whose radius covers the point, OR online when `include_online`. Public execute | 0008 |
| `delete_own_account()` | void | Delete caller's `auth.users` row (cascades everything). SECURITY DEFINER, `auth.uid()`-scoped | 0015 |
| `consume_ai_credit()` | TABLE(allowed bool, used int, day_limit int) | Atomic conditional increment of `ai_usage` (limit hardcoded 10/day) | 0020 |
| `refund_ai_credit()` | void | Decrement floored at 0; called only on Groq failure | 0020 |
| `request_tutor_verification()` | text | `none`/`rejected` → `pending`, idempotent; returns new status. `auth.uid()`-scoped | 0021 |
| `accept_current_terms()` | void | Stamp caller's `profiles.terms_agreed_at = now()` server-side. SECURITY DEFINER, `auth.uid()`-scoped | 0025 → 0039 |
| `acknowledge_messages_disclaimer()` | void | Stamp caller's `profiles.messages_disclaimer_ack_at = now()` server-side. SECURITY DEFINER, `auth.uid()`-scoped | 0046 |
| `save_tutor_profile(p_payload jsonb)` | jsonb | The tutor's only profile write. One transaction: optional `full_name` (+ slug on a real rename, via `_apply_tutor_name`), then `_apply_tutor_payload` (scalars + replace-all of the four child tables, slugs resolved server-side). Returns `{ dropped_subjects }` (correct since 0070; 0029-0037 always returned an empty list). SECURITY DEFINER, `auth.uid()`-scoped via `_require_own_tutor()` (raises for company tutors). Since 0070 it **derives `atar` itself** (`_atar_from_credentials`, raises on >1 ATAR or > 99.95) and refuses an `avatar_url` / `banner_url` that is not unchanged or inside the caller's own `profile-images` folder of this project (`_valid_profile_image`, origin taken from the JWT issuer) | 0029, 0036, 0070 |
| `set_tutor_visibility(p_visibility)` | text | Caller's own visibility (`public`/`unlisted`/`hidden`), persisted immediately from the owner card | 0070 |
| `mark_tutor_onboarded()` | void | Flips the caller's `onboarded` flag (the first-login wizard gate) | 0070 |
| `add_tutor_document(p_path, p_title)` / `rename_tutor_document(p_id, p_title)` / `delete_tutor_document(p_id)` | uuid / text / text | The `tutor_documents` write path (see that table). Title 1-200 chars | 0070 |
| `_require_own_tutor()` / `_apply_tutor_payload(id, payload, apply_visibility)` / `_apply_tutor_name(id, name)` / `_atar_from_credentials(jsonb)` / `_valid_profile_image(url, current, folder)` | — | Internal helpers behind the RPCs above, revoked from every client role. `_apply_tutor_payload` is the body `save_tutor_profile` had in 0037, kept in one place so later write paths reuse it | 0070 |
| `start_conversation(p_tutor_id)` | uuid | Student-only gate (raises otherwise): validates the target is a public, email-confirmed tutor **with `partner_id IS NULL`** (0065 — a centre's tutor is contacted through the centre's website; with partner tutors sharing `tutor_profiles` this guard has to be explicit, where a separate table would have made it structural), **that no block exists in either direction** (0049), **and that neither party is disabled** (0052), then find-or-creates the `(student, tutor)` conversation and returns its id. Invoked at first-send. SECURITY DEFINER, `auth.uid()`-scoped | 0044, 0049, 0052 |
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
| `tutor_profiles_guard_derived()` | trigger | When `current_user` is `anon`/`authenticated`: pins `rating` / `review_count` (0057, silently) and **raises** `42501 protected_column:<name>` on a change to `verification_status`, `verification_requested_at`, `partner_id`, `slug`, `email_confirmed_at` (0070) or `onboarded` (0071). An unchanged value passes. SECURITY DEFINER callers and `service_role` pass through | 0057, 0070, 0071 |
| `profiles_guard_tutor_name()` | trigger | Raises when `anon`/`authenticated` changes `full_name` on a tutor's `profiles` row | 0071 |
| `save_partner_profile(p_payload jsonb)` | jsonb | Atomically update the caller's `partners` scalars + replace-all `partner_packages`. SECURITY DEFINER, resolves the target through `owner_id = auth.uid()`. **Deliberately does not write `owner_id`, `id` or `slug`** — with no verification column, ownership is the security-relevant field, so the same "the only write path doesn't mention it" trick `save_tutor_profile` uses for `verification_status` applies here; slug renames go through the race-safe `assign_partner_slug()` | 0064 |
| `get_partner_reviews(p_partner_id)` | TABLE(id, rating, body, created_at, updated_at, author_name, author_avatar_url) | Sibling of `get_tutor_reviews`, and SECURITY DEFINER for the same reason: 0055 narrowed the public `profiles` read to tutor rows and `student_profiles` is self-only, so a public page cannot join a reviewer's name itself. Approved-only, and skips authors whose account is disabled. Granted to anon + authenticated | 0067 |
| `recalc_partner_rating(p_partner_id)` | void | Recomputes `partners.rating` / `review_count` by **aggregating over `get_partner_reviews()`**, so the stored average is by construction the average of exactly the rows the page renders. Execute revoked from anon/authenticated | 0067 |
| `partners_guard_derived()` | trigger | Pins `partners.rating` / `review_count` when `current_user` is `anon`/`authenticated`, so the owner-update policy can't be used to self-award a rating. Pins rather than raises, same as `tutor_profiles_guard_derived` | 0067 |
| `sync_partner_tutors(p_partner_id)` | void | Recomputes the derived location mirror on every one of a centre's tutors: `suburb` / `city` / `service_lat` / `service_lng` (the centre's address). Exists because /browse filters those columns in SQL — State is `.in("city", …)` and location goes through `tutors_within_service_radius` — so leaving them null silently dropped partner tutors from the two most-used filters. Same demote-to-derived-mirror pattern as `atar` in 0036. Skips no-op updates. **Not mirrored:** `rate` (0066 mirrored the cheapest package; 0069 removed that, partner tutors have no rate), `service_radius_km` (the RPC already reads null as `coalesce(…, 5)`) and `delivers_*` | 0066, 0069 |
| `partners_sync_tutors()` / `tutor_profiles_sync_from_partner()` | trigger | Call the above from each source: a change to the centre's address, and a tutor joining a centre. The last is scoped to `insert or update of partner_id` so the sync's own write can't re-fire it. (0066's `partner_packages_sync_tutors` fed the rate mirror and was dropped in 0069) | 0066, 0069 |
| `partner_owns_tutor(p_tutor_id)` | boolean | STABLE SECURITY DEFINER predicate shared by every partner-write policy, so the same condition can't drift across six tables. DEFINER because it reads `partners`, which the caller only sees through its own policies (same reasoning as `conversation_writable` in 0054) | 0065 |
| `provision_partner_tutor(p_uid, p_partner_id, p_name)` | text | Promotes a freshly created shadow `auth.users` row into a partner tutor: sets `profiles.role='tutor'` + `full_name`, inserts `tutor_profiles` with `partner_id`, stamps `email_confirmed_at`, assigns the slug. `full_name` and `email_confirmed_at` are load-bearing (a null name drops the tutor from the `profiles!inner` browse join; a null confirmation fails all five public read filters) and are set here so they're atomic with the insert. Granted only to `service_role` | 0065 |
| `save_partner_tutor_profile(p_tutor_id, p_payload)` | jsonb | Sibling of `save_tutor_profile`, scoped by partner ownership instead of `auth.uid() = id`. Updates name/bio/photo/year range, **credentials + the derived `atar`** (0070; previously a second, non-atomic direct write) and replace-alls `tutor_subjects`; returns `{ dropped_subjects }`. The only way a company owner writes a tutor since 0071. The photo must be unchanged or in the owner's own `profile-images` folder | 0065, 0070 |
| `sync_partner_tutor_visibility(p_partner_id)` | void | Recomputes every listed tutor's `tutor_profiles.visibility` from the centre's visibility AND its owner's `profiles.status`. Drives `visibility`, **not** `profiles.status`: status is the moderation field (0052), and overloading it would let un-hiding a centre silently re-enable an account a report had disabled | 0065 |
| `partners_cascade_visibility()` / `profiles_cascade_partner_visibility()` | trigger | Call the above when `partners.visibility`/`owner_id` changes, and when an owner's `profiles.status` changes. The second is needed because 0055's public read checks the TUTOR's own status, not the owner's | 0065 |
| `_assign_partner_slug(p_id, p_name)` | text | Race-safe partner slug assignment, a clone of `_assign_tutor_slug`. SECURITY DEFINER; execute revoked from public, **granted to `service_role`** so `npm run create:company` can name a new centre. Since 0068 the reserved words `claim` and `invite` (static routes under `/companies`) start at `-2` | 0063, 0068 |
| `_is_company_inviter()` | boolean | STABLE SECURITY DEFINER alias for `is_admin()` since 0074 (0068 checked `can_invite_companies`, dropped in 0075). The check behind the three invite RPCs | 0068, 0074 |
| `create_partner_as_inviter(p_name, p_website, p_suburb, p_state, p_allow_duplicate)` | jsonb | SECURITY DEFINER, granted to `authenticated`. Raises `42501` unless an admin, `22023` on bad input (blank name, unknown state code). Without `p_allow_duplicate`, a case-insensitive name match returns `{status:'duplicate', matches}` instead of inserting. Otherwise inserts with `visibility='hidden'`, `created_by = auth.uid()`, assigns the slug, logs `company_invited`, returns `{status:'created', id, slug}` | 0068, 0074 |
| `list_partners_for_inviter()` | table | SECURITY DEFINER, granted to `authenticated`. Every company (hidden and claimed included) with `claimed` and `invited_by_name`, newest first. Raises unless an admin | 0068 |
| `partner_link_target(p_id)` | boolean | SECURITY DEFINER (volatile since 0074, because it logs `company_link_issued`), granted to `authenticated`. Raises unless an admin; true = unclaimed, false = claimed, NULL = no such id. The token itself is signed in Node (`lib/companyToken.js`) | 0068, 0074 |
| `assign_partner_slug(p_name)` | text | Authenticated wrapper; resolves the target through `partners.owner_id = auth.uid()`, so a caller can only rename their own centre | 0063 |
| `claim_partner_as(p_partner_id, p_user_id)` | text | Binds an invited partner to an account and sets `profiles.role = 'partner'`; returns the slug, or NULL when already claimed. Takes the user id **explicitly** because the claim route must call it through the service role (which has no `auth.uid()`). Execute revoked from public, granted only to `service_role` — if it were callable from a browser, anyone could claim any centre by guessing its uuid. The `where owner_id is null` guard on its UPDATE is the entire replay defence, which is why there is no invites table | 0063 |
| `partners_touch_updated_at()` | trigger | Stamps `partners.updated_at = now()` before update | 0063 |
| `touch_conversation_presence(p_conversation_id)` | void | Recipient's client heartbeat (~30s while the thread is open + tab visible): sets the caller's own `*_last_active_at = now()`; no-op for non-participants. Feeds the presence skip in `claim_message_notification`. SECURITY DEFINER, `auth.uid()`-scoped | 0048 |

Note: verification **approve/reject have no RPC** — the admin has no session; the routes write via the service-role client gated by a signed HMAC token.

---

| `_tutor_snapshot(id)` / `_withdraw_pending_verification(id)` | jsonb / boolean | Internal (0072). The comparable stored profile, compared before/after a live save: a real change by a `pending` tutor sends the request back to `none`, a no-op save doesn't. The document RPCs withdraw too. `save_tutor_profile` returns `verification_withdrawn` | 0072 |
| `tutor_edits_gated(id)` | boolean | Verified and not a company tutor: whose edits need review. Granted to `authenticated` until 0076 (the storage policies called it) | 0072 |
| `_assert_live_edit_allowed(id)` | void | Called first by every RPC that edits the live profile (`save_tutor_profile`, the three document RPCs). A no-op in 0072; **0073 makes it raise `profile_changes_require_review` for gated tutors**, which is the whole gate | 0072, 0073 |
| `save_profile_draft(p_payload)` | jsonb | Gated tutor's draft save. Strips visibility, validates name, ATAR, photos (`_valid_draft_image`: unchanged, empty or a file in the caller's own staging folder) and documents (ids must be theirs; new files a staged path in their folder). Withdraws a submission under review (final row + fresh draft). Returns `{ revision_id, withdrew_submission, orphaned_staged }` | 0072 |
| `submit_profile_revision()` / `discard_profile_draft()` / `resend_profile_revision()` | uuid / jsonb / uuid | Owner: draft → `pending`; drop the open revision (returns staged paths to delete); re-stamp `admin_notified_at`, at most once per 24 h (hint `too_soon`) | 0072 |
| `apply_profile_revision(p_revision_id, p_file_map)` | jsonb | **service_role only.** Locks the revision, requires `pending` and a still-gated tutor, swaps staged references via `p_file_map`, applies documents (retitle / delete / insert), name + slug and `_apply_tutor_payload(…, false)`, marks it approved. Returns `{ applied, replaced_images, removed_docs }` or `{ applied: false, status \| reason }` | 0072 |
| `reject_profile_revision(p_revision_id, p_reason)` | jsonb | **service_role only.** Pending → `rejected` (+ reason), and a fresh draft copying the content | 0072 |
| `is_admin()` | boolean | STABLE SECURITY DEFINER: `profiles.is_admin AND status = 'enabled'` for `auth.uid()`. The single admin check, called by every admin RPC, the `admin_actions` policy (which runs as the caller) and the app (TopNav, the `/admin` guard, the API routes). Granted to `authenticated`; it takes no arguments and answers only about the caller | 0074 |
| `_require_admin()` / `_log_admin_action(…)` / `_assert_admin_target(id)` / `_clean_reason(text)` | | Internal (0074). Raise 42501 unless an admin; insert an `admin_actions` row with the caller's name snapshot; refuse the caller themselves or any admin as a target (22023); trim, blank → NULL, cap at 500 | 0074 |
| `admin_decide_verification(p_tutor_id, p_decision, p_reason)` | jsonb | `approve` / `reject` a **pending** request (`verified` / `rejected`), logs; otherwise `{ applied: false, status }`. Returns `name`, `slug` for the route's email | 0074 |
| `admin_decide_review(p_review_id, p_decision, p_reason)` | jsonb | Pending → `approved` (+ `approved_at`) / `rejected`; `removed` stays terminal because only pending moves. Logs | 0074 |
| `admin_resolve_report(p_report_id, p_action, p_reason)` | jsonb | `disable_reported` / `disable_reporter` / `dismiss` / `remove_review` in one transaction, **only while the report is pending** (the old token route had no such guard). Refuses to disable an admin or the caller. Logs | 0074 |
| `admin_apply_profile_revision(p_revision_id, p_file_map, p_reason)` / `admin_reject_profile_revision(p_revision_id, p_reason)` | jsonb | Admin-checked wrappers over the service-role `apply_profile_revision` / `reject_profile_revision`; log on success | 0074 |
| `admin_set_account_status(p_user_id, p_status, p_reason)` | jsonb | Enable / disable any non-admin account other than the caller's. Logs | 0074 |
| `admin_set_author(p_user_id, p_enabled, p_reason)` | jsonb | Grant / revoke `can_author_articles`; target must be a non-company tutor and not an admin. Logs | 0074 |
| `admin_set_company_visibility(p_partner_id, p_visibility, p_reason)` / `admin_delete_company(p_partner_id, p_reason)` | jsonb | Hide / show (through the 0065 cascade) and delete (the body of `delete_company.sql`: shadow tutor accounts, owner's role → NULL, the row with its packages and reviews). Log | 0074 |
| `admin_pending_counts()` | jsonb | `{ verifications, reviews, reports, revisions, invites }` pending counts, for the dashboard sidebar and the TopNav badge (`invites` = managed tutors not yet marked set up, 0076) | 0074, 0076 |
| `tutor_edits_gated(id)` (0076) | boolean | Now `(verified OR managed_at IS NOT NULL) AND partner_id IS NULL`, so managed tutors use the draft flow everywhere the 0072/0073 gate applies. **No longer granted to `authenticated`** (with any id it would reveal who is managed); only SECURITY DEFINER functions and the service role call it | 0076 |
| `caller_edits_gated()` | boolean | `tutor_edits_gated(auth.uid())`, about the caller only (like `is_admin()`). Granted to `authenticated`; the `profile-images` INSERT/UPDATE, `tutor-docs` INSERT and `profile-staging` INSERT policies use it | 0076 |
| `can_upload_invite_materials(p_id)` | boolean | Managed and `invite_materials_submitted_at` NULL. **service_role only**: called by `/api/join/materials/upload` before it signs an upload, and inside `submit_invite_materials` | 0076 |
| `redeem_tutor_invite(p_user_id, p_key)` | jsonb | **service_role only.** Binds an account to the invite: role NULL → a hidden, onboarded tutor (choose_role's tutor branch); a tutor keeps everything; anything else raises hint `wrong_role`, and an admin account hint `admin_account` (no admin action could ever reach it). Sets `managed_at`. Hint `invalid_key` on a dead key. Idempotent (`already`) | 0076 |
| `tutor_invite_key_valid(p_key)` | boolean | **service_role only.** Lets `/api/join/signup` refuse a dead link before it creates an account | 0076 |
| `submit_invite_materials(p_docs, p_links)` | void | Tutor, once (hint `already_submitted`): ≤ 5 documents already uploaded to their folder of `tutor-invite-materials`, ≤ 5 http(s) links | 0076 |
| `opt_out_of_management()` | jsonb | Tutor: clears `managed_*`, verification → `none`, withdraws the open revision, deletes the materials rows; returns `{ materials, staged }` storage paths for the route to remove | 0076 |
| `admin_get_tutor_invite_key()` / `admin_rotate_tutor_invite_key()` | jsonb | Admin read / replace the invite key (rotate logs) | 0076 |
| `admin_save_managed_tutor_profile(p_tutor_id, p_payload, p_expected_updated_at)` | jsonb | Admin LIVE save of a managed tutor (`_apply_tutor_name` + `_apply_tutor_payload`, photos must be in the tutor's folder). The payload is the whole profile, so a save whose `p_expected_updated_at` is older than the row is refused (hint `stale_profile`) instead of reverting a newer save or an approved draft. Stamps `admin_edited_at` and logs only on a real change; returns `changed`, `dropped_subjects`, `updated_at`. A photo the tutor's open draft had not changed follows the new live one, so the draft stays saveable | 0076 |
| `admin_set_managed_tutor_visibility` / `admin_set_tutor_verification(p_tutor_id, p_verified, p_reason)` / `admin_mark_managed_setup_done(p_tutor_id, p_reason)` | jsonb | Managed tutors only (`_require_managed_tutor`, which also refuses admins and the caller). Verification toggles `verified` ↔ `none` with no request. Log | 0076 |
| `admin_add/rename/delete_managed_tutor_document` | uuid / text / text | The 0072 document bodies keyed on `p_tutor_id`; the browser puts the file in `tutor-docs/<tutor_id>/` first, on an upload URL the admin upload route signs. Each also updates the tutor's open draft (adds the new document, carries an unchanged title, drops a deleted id) | 0076 |

## Triggers

| Trigger | Table | Event | Function | Migration |
| --- | --- | --- | --- | --- |
| `on_auth_user_created` | `auth.users` | AFTER INSERT | `handle_new_user()` | 0001 |
| `on_auth_user_email_confirmed` | `auth.users` | AFTER UPDATE OF `email_confirmed_at` | `handle_user_email_confirmed()` | 0007 |
| `messages_bump_conversation` | `messages` | AFTER INSERT | `bump_conversation_last_message()` (sets `conversations.last_message_at`) | 0044 |
| `reviews_recalc_rating` | `reviews` | AFTER INSERT/UPDATE/DELETE | `reviews_recalc_rating()` → recomputes the tutor's `rating` / `review_count` | 0057 |
| `reviews_touch_updated_at` | `reviews` | BEFORE UPDATE | `reviews_touch_updated_at()` | 0057 |
| `tutor_profiles_guard_derived` | `tutor_profiles` | BEFORE UPDATE | `tutor_profiles_guard_derived()` → pins `rating` / `review_count`; raises on client changes to the system columns | 0057, 0070, 0071 |
| `profiles_status_recalc_ratings` | `profiles` | AFTER UPDATE OF `status` (WHEN changed) | `profiles_status_recalc_ratings()` → refresh the aggregates of every tutor this user reviewed | 0058 |
| `articles_touch_updated_at` | `articles` | BEFORE UPDATE | `articles_touch_updated_at()` — touches `updated_at` only, never the reader-visible `content_updated_at` | 0061 |
| `profiles_guard_capabilities` | `profiles` | BEFORE UPDATE | `profiles_guard_capabilities()` → pins `can_author_articles`; raises on client changes to `is_admin` (0074), `role` / `status` (0070) | 0061, 0068, 0070, 0074, 0075 |
| `profiles_guard_tutor_name` | `profiles` | BEFORE UPDATE | `profiles_guard_tutor_name()` → a tutor's name changes only through an RPC | 0071 |
| `tutor_profiles_cancel_revisions` | `tutor_profiles` | AFTER UPDATE OF `verification_status` | `tutor_profiles_cancel_revisions()` → leaving `verified` cancels the open revision, unless the tutor is managed (still gated, 0076) | 0072, 0076 |

---

## RLS summary

| Table | Read | Write |
| --- | --- | --- |
| `profiles` | self; **+ public read for tutor rows** (0004); **+ conversation participants read each other** (0044); **+ a company owner reads its tutors** (0065) | self UPDATE, **except `can_author_articles` (silently pinned, 0061), `is_admin` (raises, 0074), `role` / `status` (raise, 0070) and a tutor's `full_name` (raises, 0071; renamed only through `save_tutor_profile` / `save_partner_tutor_profile`)**. The self-update policy has no `WITH CHECK` and no column restriction, which is exactly why the guards are triggers. Students rename themselves through it. 0065's company-owner UPDATE policy was dropped in 0071 |
| `tutor_profiles` | public (enabled accounts, 0055); **+ own row** (`tutor self read`, 0071); **+ a company owner reads its tutors** (0065) | **none: RPC-only since 0071.** Tutors write through `save_tutor_profile`, `set_tutor_visibility`, `mark_tutor_onboarded`; company owners through `save_partner_tutor_profile`. The guard trigger additionally raises on any `authenticated`/`anon` change to `verification_status`, `verification_requested_at`, `partner_id`, `slug`, `email_confirmed_at`, `onboarded` (0070/0071), `managed_at`, `managed_setup_done_at`, `invite_materials_submitted_at`, `admin_edited_at` (0076) and pins `rating` / `review_count` (0057) |
| `student_profiles` | self; **+ the tutor in a shared conversation may read the student** (0044, for name/avatar) | self (ALL) |
| `saved_tutors` | self (own `student_id`) | self (ALL) |
| `reviews` | public where `status='approved'`; **+ author reads own row in any status** | author (`student_id` = uid) INSERT/UPDATE/DELETE, with INSERT+UPDATE forced to `status='pending'` so a student can't self-approve (0057) |
| `blocked_users` | self (own `blocker_id`) — a block is invisible to the blocked user | self (own `blocker_id`) INSERT/DELETE (0049) |
| `conversations` | participants (`student_id`/`tutor_id` = uid) | participants UPDATE (read cursors); no INSERT (RPC-created, 0044) |
| `messages` | participants of the conversation | participant INSERT, `sender_id` = uid + first message must be the student's (0044) + no block between participants (0049) + neither participant disabled (0052); no UPDATE/DELETE — edit/unsend via RPC (0045) |
| `message_reactions` | participants of the reacted message's conversation (0045) | `user_id` = uid (+ participant) INSERT/UPDATE/DELETE (0045) |
| `subjects` / `exams` / `schools` | public | none (reference data) |
| `tutor_subjects` / `tutor_packages` / `tutor_experience` / `tutor_education` | public | **none: RPC-only since 0071** (`save_tutor_profile`; `save_partner_tutor_profile` for subjects of company tutors). The 0002 self-write and 0065 company-write policies are gone |
| `ai_usage` | self | none (SECURITY DEFINER fns only) |
| `notifications` | self | self UPDATE (mark-read); no INSERT (service-role only) |
| `reports` | reporter self (own `reporter_id`) | none (service-role insert, 0053; resolved by `admin_resolve_report`, 0074) |
| `admin_actions` | admins (`is_admin()`, 0074) | none (written by the admin RPCs only) |
| `tutor_documents` | public | **none: RPC-only since 0071** (`add_tutor_document`, `rename_tutor_document`, `delete_tutor_document`) |
| `storage.objects` (`profile-images`) | public | owner-scoped by folder = uid; bucket limits 5 MB, jpeg/png/webp/gif (0070); INSERT/UPDATE refused for gated tutors (0073) |
| `storage.objects` (`tutor-docs`) | public bucket (downloads bypass RLS; owner-only SELECT, needed by remove()) | owner-scoped INSERT/DELETE, no UPDATE; INSERT refused for gated tutors (0073) |
| `tutor_profile_revisions` | owner (`tutor_id` = uid) | none (RPCs only, 0072) |
| `tutor_invite_key` / `tutor_invite_materials` | none (admin RPCs / service role, 0076) | none (RPCs only, 0076) |
| `storage.objects` (`tutor-invite-materials`) | none (private; admins via service role) | none; uploads only via signed URLs from `/api/join/materials/upload` (0076) |
| `storage.objects` (`profile-staging`) | owner by folder (private bucket) | owner INSERT (gated tutors only) / DELETE by folder (0072) |
| `articles` | public where `status='published'`; **+ author reads own row in any status** | author (`author_id` = uid) **who also holds `profiles.can_author_articles`** — INSERT/UPDATE may set `status in ('draft','pending','published')` (designated authors self-publish); UPDATE/DELETE blocked once `status='removed'` (0061) |
| `storage.objects` (`blog-images`) | public | owner-scoped by folder = uid, INSERT/UPDATE/DELETE (0061) |

> **Invariant:** tutor and company-tutor writes are **RPC-only** (0070/0071). No client role holds
> a write policy on `tutor_profiles`, its four child tables or `tutor_documents`, so every write
> passes through a SECURITY DEFINER function that checks who is writing and what. Read access is
> unchanged.
>
> **Invariant:** a verified, non-company tutor's live profile changes only through an admin-approved
> revision (0072/0073): `_assert_live_edit_allowed` refuses their live saves and document writes,
> and they cannot upload to the public buckets. Visibility stays instant for everyone.
>
> **Invariant:** no save path writes `verification_status`, `slug`, `partner_id`,
> `email_confirmed_at`, `verification_requested_at` or `onboarded`, and the
> `tutor_profiles_guard_derived` trigger raises if `authenticated`/`anon` changes any of them, so a
> tutor (or a company owner) cannot self-verify or re-point a row. Likewise `profiles.role` /
> `status` raise via `profiles_guard_capabilities` (0070), so a disabled account cannot re-enable
> itself.
>
> **Invariant:** nothing in the app writes `tutor_profiles.rating` / `review_count`. They are
> derived from approved `reviews` by `recalc_tutor_rating()` and pinned against client writes by
> the `tutor_profiles_guard_derived` trigger (0057), so a tutor cannot self-award a rating.
>
> **Invariant:** nothing in the app writes `profiles.can_author_articles`. It is granted out of
> band via `supabase/utilities/grant_author.sql` and pinned against client writes by the
> `profiles_guard_capabilities` trigger (0061), so a user cannot grant themselves the ability to
> publish to the blog.
>
> The one exception (0074): an admin can grant or revoke it from `/admin/users`, through the
> SECURITY DEFINER `admin_set_author`, which logs to `admin_actions`.
>
> **Invariant:** nothing in the app writes `profiles.is_admin`, not even an admin. It is changed
> only with `supabase/utilities/grant_admin.sql`, and the guard trigger RAISES on any client
> attempt (0074). `can_invite_companies` (0068) was dropped in 0075; invites are an admin power.
