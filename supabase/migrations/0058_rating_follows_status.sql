-- ============================================================================
-- tutormatch — slice 58: make rating / review_count exactly match what's shown
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0001..0057 (in order). Recreates recalc_tutor_rating() from 0057
--   and references get_tutor_reviews() (0057) + profiles.status (0052).
--
-- WHY:
--   0057 left two different definitions of "a review that counts":
--
--     * get_tutor_reviews()  — approved AND the author's account is enabled
--     * recalc_tutor_rating() — approved, full stop
--
--   So a tutor with a disabled reviewer would show "Based on 5 reviews" above a
--   list of 4, with an average that included the hidden one. The profile card
--   worked around it by averaging the list itself, which left the product with
--   two ways to compute the same number and no single canonical answer.
--
--   Rather than duplicate the predicate correctly in both places (the drift that
--   caused this), recalc_tutor_rating() now aggregates over get_tutor_reviews()
--   itself. There is exactly ONE definition of a visible review, and the stored
--   average is by construction the average of precisely the rows the profile
--   renders. The card can read the column again.
--
-- WHAT THIS DOES:
--   1. Recreates recalc_tutor_rating() to aggregate over get_tutor_reviews().
--   2. Adds a trigger on profiles.status, because the aggregate now depends on
--      it: disabling or re-enabling a reviewer has to refresh every tutor they
--      reviewed. Without this the columns would silently go stale the moment an
--      account was disabled — the review trigger only fires on review writes.
--   3. Reconciles every tutor once, since the definition changed.
-- ============================================================================

-- 1. One definition of a visible review -------------------------------------
-- Aggregating over the RPC (rather than repeating its WHERE clause) is what
-- guarantees the column and the rendered list can never disagree. get_tutor_reviews
-- is STABLE and indexed on (tutor_id, status, created_at), so the two calls are
-- cheap; the author name/avatar columns it also returns are simply ignored here.
create or replace function public.recalc_tutor_rating(p_tutor_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.tutor_profiles t set
    -- NULL over zero visible reviews, which is the existing "no rating"
    -- sentinel every reader already handles.
    rating       = (select round(avg(v.rating), 1) from public.get_tutor_reviews(p_tutor_id) v),
    review_count = (select count(*)                from public.get_tutor_reviews(p_tutor_id) v)
  where t.id = p_tutor_id;
$$;

revoke all on function public.recalc_tutor_rating(uuid) from public, anon, authenticated;

-- 2. The aggregate now depends on profiles.status ----------------------------
-- Disabling a reviewer must recompute every tutor they reviewed, or the columns
-- go stale (0057's trigger only fires on writes to `reviews`). Re-enabling them
-- restores the reviews the same way.
--
-- Only ever does work for a review AUTHOR: reviews.student_id references
-- student_profiles, so a tutor account matches no rows and the loop is a no-op.
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
    select distinct tutor_id from public.reviews where student_id = new.id
  loop
    perform public.recalc_tutor_rating(r.tutor_id);
  end loop;
  return null; -- AFTER trigger; return value is ignored
end;
$$;

drop trigger if exists profiles_status_recalc_ratings on public.profiles;
create trigger profiles_status_recalc_ratings
  after update of status on public.profiles
  for each row
  when (old.status is distinct from new.status)
  execute function public.profiles_status_recalc_ratings();

-- 3. Reconcile ---------------------------------------------------------------
-- The definition of the aggregate changed, so recompute every tutor. Safe to
-- re-run at any time.
select public.recalc_tutor_rating(t.id) from public.tutor_profiles t;
