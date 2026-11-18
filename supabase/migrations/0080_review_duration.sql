-- ============================================================================
-- 0080_review_duration — how long the student has been with the tutor
-- ----------------------------------------------------------------------------
-- A review becomes { rating, time with the tutor, text }. The new part is one
-- nullable column, reviews.duration_months: the total number of months the
-- student has been with the tutor (or tutoring centre: the column serves both
-- kinds of review, 0067). The form collects years + months and sends the total.
--
-- OPTIONAL. NULL means "not given", which is also what every review written
-- before this migration has. There is no 0: a zero total is stored as NULL, the
-- same "NULL rather than blank" rule the body CHECK uses.
--
-- The CHECK is the real bound, not the route. The 0057 INSERT / UPDATE policies
-- restrict rows (student_id, status), never columns, so an author can write
-- this column straight through PostgREST. 155 = 12 years 11 months, the most
-- the form's two dropdowns can produce. Must match MAX_DURATION_MONTHS in
-- lib/reviewDuration.js.
--
-- DISPLAY ONLY. It feeds no aggregate, no ordering and no ranking, so
-- recalc_tutor_rating / recalc_partner_rating are untouched (they read `rating`
-- from the two functions below and nothing else).
--
-- The two public read functions gain the column. Both are RETURNS TABLE, and
-- CREATE OR REPLACE cannot change a return type, so each is dropped and
-- re-created with an otherwise identical body, then re-granted. The recalc
-- functions call them by name from a `language sql` body, which Postgres does
-- not track as a dependency, so the drop needs no CASCADE. Everything is in one
-- transaction, so there is no moment when the functions do not exist.
--
-- RLS needs no change: an edit that changes only this column is still an
-- UPDATE, so the 0057 WITH CHECK still forces the row back to 'pending'.
--
-- Safe with the previous app (it ignores the extra returned column).
-- DEPLOY ORDER: 0080 → app. The new app writes duration_months on every review
-- insert, which fails until this has run. Additive after 0079.
-- ============================================================================

begin;

-- 1. The column ----------------------------------------------------------------

alter table public.reviews
  add column if not exists duration_months int;

alter table public.reviews
  drop constraint if exists reviews_duration_months_range;
alter table public.reviews
  add constraint reviews_duration_months_range
  check (duration_months is null or duration_months between 1 and 155);

-- 2. get_tutor_reviews: 0057 body + duration_months -----------------------------

drop function if exists public.get_tutor_reviews(uuid);

create function public.get_tutor_reviews(p_tutor_id uuid)
returns table (
  id                uuid,
  rating            int,
  body              text,
  created_at        timestamptz,
  updated_at        timestamptz,
  author_name       text,
  author_avatar_url text,
  duration_months   int
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.rating, r.body, r.created_at, r.updated_at,
         p.full_name, s.avatar_url, r.duration_months
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

-- 3. get_partner_reviews: 0067 body + duration_months ---------------------------

drop function if exists public.get_partner_reviews(uuid);

create function public.get_partner_reviews(p_partner_id uuid)
returns table (
  id                uuid,
  rating            int,
  body              text,
  created_at        timestamptz,
  updated_at        timestamptz,
  author_name       text,
  author_avatar_url text,
  duration_months   int
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.rating, r.body, r.created_at, r.updated_at,
         p.full_name, s.avatar_url, r.duration_months
    from public.reviews r
    join public.profiles p         on p.id = r.student_id
    join public.student_profiles s on s.id = r.student_id
   where r.partner_id = p_partner_id
     and r.status = 'approved'
     -- A disabled reviewer's reviews disappear site-wide with no extra write.
     and p.status = 'enabled'
   order by r.created_at desc;
$$;

revoke all on function public.get_partner_reviews(uuid) from public;
grant execute on function public.get_partner_reviews(uuid) to anon, authenticated;

commit;
