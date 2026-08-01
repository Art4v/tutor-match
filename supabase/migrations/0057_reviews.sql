-- ============================================================================
-- tutormatch — slice 57: reviews (student ratings, admin-moderated)
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0001..0056 (in order). student_profiles/tutor_profiles from 0001,
--   profiles.status from 0052, student_profiles.avatar_url from 0043. Adopts the
--   rating / review_count columns created in 0002 and deliberately preserved by
--   0037.
--
-- WHY:
--   Ratings and reviews have been promised since launch (the terms of service
--   has a "Ratings & Reviews" section, the profile sidebar shows a hardcoded
--   "Coming soon" card) but nothing existed behind it. This is the data layer:
--   a student leaves ONE review per tutor, 1-5 whole stars plus optional text,
--   and it stays invisible until an admin approves it from an emailed signed
--   link (the moderation routes land in a later slice).
--
--   It also promotes tutor_profiles.rating / review_count from dead placeholders
--   (always NULL / 0, written by nothing) into TRIGGER-OWNED derived columns, so
--   the numbers already rendered on cards and the ordering in getFeaturedTutors
--   become true for the first time.
--
-- WHAT THIS DOES:
--   1. reviews — one row per (tutor, student). status pending -> approved /
--      rejected / removed. RLS carries the moderation ladder STRUCTURALLY: the
--      client INSERT/UPDATE policies both require status = 'pending', so a
--      student cannot self-approve and any edit is forced back into the queue.
--      No JS has to remember that rule.
--   2. get_tutor_reviews(tutor) — SECURITY DEFINER read path. 0055 narrowed the
--      public profiles read policy to tutor rows only, and student_profiles has
--      been self-only since 0001, so a public page CANNOT join a reviewer's name
--      or avatar through normal RLS. Rather than widen either policy, this
--      function returns approved reviews plus exactly the three author fields
--      the UI needs. Bonus: it filters on the author being enabled, so disabling
--      an abusive reviewer (0052) hides their reviews everywhere for free.
--   3. recalc_tutor_rating(tutor) + triggers — recompute rating / review_count
--      from APPROVED reviews only, on every insert/update/delete.
--   4. A one-time reconcile pass over every tutor (a trigger only fires on
--      future writes; this squares away any existing drift, as 0028 did before
--      changing how verification_status was owned).
--   5. A guard trigger pinning rating / review_count against client writes.
--      SECURITY FIX: "tutor self rw" (0001) is `for all` with no column
--      restriction, so until now a tutor could set their own rating to 5.0 with
--      one browser call. Harmless while nothing rendered it; not harmless once
--      the next slice puts it on every profile and card. (A column-level REVOKE
--      cannot do this job — see the long comment on section 6.)
-- ============================================================================

-- 1. Table -------------------------------------------------------------------
create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  tutor_id    uuid not null references public.tutor_profiles(id)   on delete cascade,
  student_id  uuid not null references public.student_profiles(id) on delete cascade,
  rating      int  not null check (rating between 1 and 5),
  -- Optional. Blank-but-present is rejected (like profiles.full_name in 0017) so
  -- the UI never has to render an empty paragraph: the route sends NULL instead.
  body        text check (body is null or (btrim(body) <> '' and char_length(body) <= 500)),
  status      text not null default 'pending'
                check (status in ('pending', 'approved', 'rejected', 'removed')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  approved_at timestamptz,
  -- One review per tutor per student. Makes a duplicate submit a clean 23505 the
  -- route translates into "you already reviewed this tutor" (409).
  unique (tutor_id, student_id)
);

-- 'rejected' vs 'removed': rejected = the admin declined it, and the student can
-- resubmit by editing (the UPDATE policy forces it back to 'pending'). removed =
-- a report took it down, and the UPDATE policy's `status <> 'removed'` USING
-- clause stops the author editing it back into circulation.

-- The profile page reads one tutor's approved reviews, newest first.
create index if not exists reviews_tutor_status_created_idx
  on public.reviews (tutor_id, status, created_at desc);

-- "my review of this tutor" is covered by the unique index, but "all reviews by
-- this author" (report resolution, any future my-reviews list) needs this.
create index if not exists reviews_student_idx
  on public.reviews (student_id);

alter table public.reviews enable row level security;

-- 2. RLS ---------------------------------------------------------------------
-- Approved reviews are public content.
drop policy if exists "reviews public read" on public.reviews;
create policy "reviews public read"
  on public.reviews for select
  using (status = 'approved');

-- The author sees their own row in ANY state, which is the only way a pending or
-- rejected review is visible to the person who wrote it.
drop policy if exists "reviews self read" on public.reviews;
create policy "reviews self read"
  on public.reviews for select
  using (student_id = auth.uid());

-- status = 'pending' in the WITH CHECK of both write policies is the moderation
-- gate. A student can only ever create or leave a row in the pending state.
drop policy if exists "reviews self insert" on public.reviews;
create policy "reviews self insert"
  on public.reviews for insert
  with check (student_id = auth.uid() and status = 'pending');

drop policy if exists "reviews self update" on public.reviews;
create policy "reviews self update"
  on public.reviews for update
  using (student_id = auth.uid() and status <> 'removed')
  with check (student_id = auth.uid() and status = 'pending');

drop policy if exists "reviews self delete" on public.reviews;
create policy "reviews self delete"
  on public.reviews for delete
  using (student_id = auth.uid());

-- 3. Public read path (author name/avatar) -----------------------------------
-- SECURITY DEFINER because the caller cannot read a student's profiles or
-- student_profiles row (0055 / 0001) — see the header. Returns only the three
-- author fields the review UI renders, never an email or an id.
create or replace function public.get_tutor_reviews(p_tutor_id uuid)
returns table (
  id                uuid,
  rating            int,
  body              text,
  created_at        timestamptz,
  updated_at        timestamptz,
  author_name       text,
  author_avatar_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.rating, r.body, r.created_at, r.updated_at,
         p.full_name, s.avatar_url
    from public.reviews r
    join public.profiles p         on p.id = r.student_id
    join public.student_profiles s on s.id = r.student_id
   where r.tutor_id = p_tutor_id
     and r.status = 'approved'
     -- A disabled reviewer's reviews disappear site-wide with no extra write.
     and p.status = 'enabled'
   order by r.created_at desc;
$$;

revoke all on function public.get_tutor_reviews(uuid) from public;
grant execute on function public.get_tutor_reviews(uuid) to anon, authenticated;

-- 4. Aggregates: rating / review_count are trigger-owned from here on --------
-- Private: only the trigger below calls it, so no client role gets execute.
create or replace function public.recalc_tutor_rating(p_tutor_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.tutor_profiles t set
    -- avg() over zero approved rows is NULL, which is exactly the existing
    -- "no rating" sentinel every reader already handles. So a tutor losing their
    -- last review returns to NULL rather than showing a bogus 0.0.
    rating       = (select round(avg(r.rating), 1) from public.reviews r
                     where r.tutor_id = p_tutor_id and r.status = 'approved'),
    review_count = (select count(*) from public.reviews r
                     where r.tutor_id = p_tutor_id and r.status = 'approved')
  where t.id = p_tutor_id;
$$;

revoke all on function public.recalc_tutor_rating(uuid) from public, anon, authenticated;

-- Must fire on UPDATE as well as INSERT/DELETE: every status transition
-- (pending->approved on approval, approved->pending on an edit,
-- approved->removed on a report) changes the aggregate without any row
-- appearing or disappearing. That is what makes "an edited review is hidden
-- until re-approved" and "removing a review drops the average" work with no
-- application code at all.
create or replace function public.reviews_recalc_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalc_tutor_rating(old.tutor_id);
    return old;
  end if;

  perform public.recalc_tutor_rating(new.tutor_id);

  -- A review should never move between tutors, but if it ever did, the old
  -- tutor's average has to be recomputed too.
  if tg_op = 'UPDATE' and old.tutor_id is distinct from new.tutor_id then
    perform public.recalc_tutor_rating(old.tutor_id);
  end if;

  return new;
end;
$$;

drop trigger if exists reviews_recalc_rating on public.reviews;
create trigger reviews_recalc_rating
  after insert or update or delete on public.reviews
  for each row execute function public.reviews_recalc_rating();

-- updated_at is maintained here so no route has to remember to pass it.
create or replace function public.reviews_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists reviews_touch_updated_at on public.reviews;
create trigger reviews_touch_updated_at
  before update on public.reviews
  for each row execute function public.reviews_touch_updated_at();

-- 5. One-time reconcile ------------------------------------------------------
-- The trigger only fires on future review writes, so square away every existing
-- tutor now. Currently a no-op (every row is NULL / 0), but it makes this
-- migration self-healing and safe to re-run rather than trusting that.
select public.recalc_tutor_rating(t.id) from public.tutor_profiles t;

-- 6. Close the client write hole on the derived columns ----------------------
-- "tutor self rw" (0001) is `for all using (auth.uid() = id)` with NO column
-- restriction, and Supabase grants table-level UPDATE to anon/authenticated by
-- default. So a tutor could run
--   supabase.from('tutor_profiles').update({ rating: 5, review_count: 99 })
-- straight from the browser and hand themselves a perfect score. Harmless while
-- nothing rendered those columns; not harmless from the next slice on.
--
-- WHY NOT `revoke update (rating, review_count) ... from authenticated`:
--   It would do NOTHING. Per the Postgres REVOKE docs, "if a role has been
--   granted privileges on a table, then revoking the same privileges from
--   individual columns will have no effect" — effective column privilege is the
--   UNION of the table-wide and column-specific grants. Making it work means
--   revoking table-level UPDATE and re-granting all ~30 other columns
--   individually, which then silently breaks every future `alter table ... add
--   column` until someone remembers to add a matching grant.
--
-- WHY NOT `revoke update on tutor_profiles` outright (the 0055 move for
-- conversations): unlike conversations, this table HAS a legitimate direct
-- client write — markOnboarded() in lib/supabase/tutors.js sets `onboarded`.
--
-- So: a guard trigger. It needs no column enumeration, survives new columns,
-- and leaves every other write path alone. It pins the two derived columns back
-- to their stored values for the two roles PostgREST exposes to the outside
-- world. Inside recalc_tutor_rating() (SECURITY DEFINER) current_user is the
-- function owner, not 'authenticated', so the legitimate writer passes through.
-- service_role also passes, keeping the usual admin escape hatch.
--
-- It PINS rather than RAISES so a caller that echoes back a whole row can't
-- start failing on a column it never meant to change.
create or replace function public.tutor_profiles_guard_derived()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.rating       := old.rating;
    new.review_count := old.review_count;
  end if;
  return new;
end;
$$;

drop trigger if exists tutor_profiles_guard_derived on public.tutor_profiles;
create trigger tutor_profiles_guard_derived
  before update on public.tutor_profiles
  for each row execute function public.tutor_profiles_guard_derived();
