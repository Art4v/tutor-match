-- ============================================================================
-- tutormatch — 0067: reviews of a tutoring centre
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0057/0058 (reviews + the derived rating), 0063 (partners),
--             0065 (tutor_profiles.partner_id).
--
-- WHAT THIS DOES:
--   A `reviews` row now points at EITHER a tutor or a partner. Students review
--   the CENTRE, not the individual tutors a centre lists — the profile page
--   already hides the per-tutor review UI for them (0065) and /api/reviews
--   already 403s on a partner-managed tutor id.
--
-- WORTH SAYING OUT LOUD: this slice COSTS work rather than saving it.
--   reviews.tutor_id already points at tutor_profiles, so a partner tutor would
--   have been reviewable for free the moment 0065 landed. Keeping reviews
--   centre-level is a deliberate product decision, and everything below is the
--   price of it. If that decision is ever reversed, this migration is the thing
--   to read first.
--
-- THE PART THAT HAS ALREADY BEEN GOT WRONG ONCE:
--   The old `unique (tutor_id, student_id)` becomes TWO PARTIAL unique indexes,
--   and each is keyed on ITS OWN column being NOT NULL — never on the other
--   one being null. 0059 keyed a partial index the second way and 0060 had to
--   undo it: an orphaned row migrated into the wrong domain, squatted the slot,
--   and silently turned a later genuine write into a no-op. Same trap, same
--   table, one migration apart.
--
-- WHAT NEEDS NO CHANGE, and why that is not luck:
--   The 0057 RLS policies are keyed on `student_id` and `status` ONLY — they
--   never mention tutor_id. The whole moderation ladder (a student can only
--   ever write `pending`; any edit is forced back into the queue; `removed` is
--   terminal) therefore covers partner reviews unchanged, with no second copy
--   to keep in sync.
-- ============================================================================

-- 1. reviews: either a tutor or a partner --------------------------------------

alter table public.reviews
  alter column tutor_id drop not null;

alter table public.reviews
  add column if not exists partner_id uuid references public.partners(id) on delete cascade;

alter table public.reviews
  drop constraint if exists reviews_subject_exactly_one;
alter table public.reviews
  add constraint reviews_subject_exactly_one
  check ((tutor_id is not null) <> (partner_id is not null));

-- Replace the table-level UNIQUE with two domain-scoped partial indexes. Both
-- still produce a clean 23505 that /api/reviews turns into a 409.
alter table public.reviews
  drop constraint if exists reviews_tutor_id_student_id_key;

drop index if exists public.reviews_one_per_tutor;
create unique index reviews_one_per_tutor
  on public.reviews (tutor_id, student_id)
  where tutor_id is not null;

drop index if exists public.reviews_one_per_partner;
create unique index reviews_one_per_partner
  on public.reviews (partner_id, student_id)
  where partner_id is not null;

create index if not exists reviews_partner_status_created_idx
  on public.reviews (partner_id, status, created_at desc)
  where partner_id is not null;

-- 2. The derived aggregate on partners ----------------------------------------
-- Deliberately added HERE rather than in 0063, so the columns and the only
-- thing that writes them arrive in the same migration (the 0057 lesson).

alter table public.partners
  add column if not exists rating       numeric(2,1);
alter table public.partners
  add column if not exists review_count int not null default 0;

-- 3. Public read path ----------------------------------------------------------
-- Straight sibling of get_tutor_reviews. SECURITY DEFINER for the same reason:
-- 0055 narrowed the public profiles read to tutor rows and student_profiles is
-- self-only, so a public page cannot join a reviewer's name or avatar itself.
create or replace function public.get_partner_reviews(p_partner_id uuid)
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
   where r.partner_id = p_partner_id
     and r.status = 'approved'
     -- A disabled reviewer's reviews disappear site-wide with no extra write.
     and p.status = 'enabled'
   order by r.created_at desc;
$$;

grant execute on function public.get_partner_reviews(uuid) to anon, authenticated;

-- 4. The aggregate, over that same function -----------------------------------
-- Aggregating over get_partner_reviews() rather than over `reviews` directly is
-- the 0058 lesson applied up front: ONE definition of "a review that counts", so
-- the stored average is by construction the average of exactly the rows the
-- page renders. 0058 exists because that predicate was written twice and drifted.
create or replace function public.recalc_partner_rating(p_partner_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.partners pa set
    rating       = (select round(avg(v.rating), 1) from public.get_partner_reviews(p_partner_id) v),
    review_count = (select count(*)                from public.get_partner_reviews(p_partner_id) v)
  where pa.id = p_partner_id;
$$;

revoke all on function public.recalc_partner_rating(uuid) from public;

-- 5. Route the existing triggers to the right subject -------------------------
-- Re-created from 0057 with a branch. Without it a partner review would call
-- recalc_tutor_rating(NULL), which is a silent no-op — the review would appear
-- on the page while the "Based on N reviews" summary never moved.
create or replace function public.reviews_recalc_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.tutor_id   is not null then perform public.recalc_tutor_rating(old.tutor_id);     end if;
    if old.partner_id is not null then perform public.recalc_partner_rating(old.partner_id); end if;
    return old;
  end if;

  if new.tutor_id   is not null then perform public.recalc_tutor_rating(new.tutor_id);     end if;
  if new.partner_id is not null then perform public.recalc_partner_rating(new.partner_id); end if;

  -- A review should never move between subjects, but if it ever did, the old
  -- subject's average has to be recomputed too.
  if tg_op = 'UPDATE' then
    if old.tutor_id is not null and old.tutor_id is distinct from new.tutor_id then
      perform public.recalc_tutor_rating(old.tutor_id);
    end if;
    if old.partner_id is not null and old.partner_id is distinct from new.partner_id then
      perform public.recalc_partner_rating(old.partner_id);
    end if;
  end if;

  return new;
end;
$$;

-- Same for the status cascade from 0058: because both aggregates depend on the
-- AUTHOR's profiles.status, disabling a reviewer has to refresh every subject
-- they reviewed, centres included.
create or replace function public.profiles_status_recalc_ratings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select distinct tutor_id from public.reviews
     where student_id = new.id and tutor_id is not null
  loop
    perform public.recalc_tutor_rating(r.tutor_id);
  end loop;

  for r in
    select distinct partner_id from public.reviews
     where student_id = new.id and partner_id is not null
  loop
    perform public.recalc_partner_rating(r.partner_id);
  end loop;

  return null; -- AFTER trigger; return value is ignored
end;
$$;

-- 6. A centre cannot award itself a rating ------------------------------------
-- Same trick and same reasoning as tutor_profiles_guard_derived (0057): a
-- column-level REVOKE cannot do this, because a table-level grant wins over a
-- column-level revoke in Postgres, and revoking UPDATE outright would break the
-- partner's own editor. Pins rather than raises, so a client echoing a whole row
-- back doesn't start erroring.
create or replace function public.partners_guard_derived()
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

drop trigger if exists partners_guard_derived on public.partners;
create trigger partners_guard_derived
  before update on public.partners
  for each row execute function public.partners_guard_derived();

-- 7. Reconcile every centre once ----------------------------------------------
do $$
declare
  r record;
begin
  for r in select id from public.partners loop
    perform public.recalc_partner_rating(r.id);
  end loop;
end;
$$;
