-- ============================================================================
-- tutormatch — slice 59: reporting a review
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0001..0058 (in order). Extends the reports table from 0053 and
--   references reviews (0057).
--
-- WHY:
--   Approved reviews are public content written by one user about another, so
--   they need the same escalation path conversations already have. Rather than a
--   second reports table, a report now points at EITHER a conversation or a
--   review, and the existing admin flow grows a third resolution.
--
--   Unlike a conversation report, filing one does NOT block anybody: you can be
--   reporting a stranger's review of a third party, and a tutor auto-blocking a
--   critic would read as retaliation.
--
-- WHAT THIS DOES:
--   1. reports.review_id — nullable FK, ON DELETE SET NULL (see the note below).
--   2. Widens the category CHECK with 'inappropriate_review'.
--   3. Widens the resolution CHECK with 'removed_review'.
--   4. Splits the "one open report per pair" partial unique index in two, so a
--      pending conversation report can't silently swallow a report about the
--      same person's review.
--
-- TWO COUPLINGS THAT NEED NO CODE — do not break these:
--   * Resolving with `disable_reported` disables the reviewer. get_tutor_reviews()
--     (0057) filters on the author being enabled, so their reviews vanish from
--     every profile, AND 0058's profiles_status_recalc_ratings trigger
--     recalculates every tutor they reviewed. No extra writes.
--   * Setting a review to 'removed' drops it from the aggregate automatically,
--     because recalc_tutor_rating() aggregates over get_tutor_reviews(), which is
--     approved-only. The 0057 RLS update policy's `status <> 'removed'` USING
--     clause stops the author editing it back into circulation, and the approve
--     route treats 'removed' as terminal.
-- ============================================================================

-- 1. What is being reported --------------------------------------------------
-- ON DELETE SET NULL, deliberately NOT CASCADE: if the author deletes a review
-- that has already been reported, the report must survive. Cascading would let
-- someone post an abusive review, wait for a report, delete it before the admin
-- looks, and leave no record — repeatable indefinitely. With SET NULL the report
-- keeps reporter, reported, category and details, so the account can still be
-- actioned; the admin page renders the missing review as "deleted by its author".
alter table public.reports
  add column if not exists review_id uuid references public.reviews(id) on delete set null;

create index if not exists reports_review_idx
  on public.reports (review_id);

-- 2. New category ------------------------------------------------------------
-- Keep in sync with CATEGORIES in app/api/reports/route.js, REPORT_CATEGORIES in
-- components/ReportModal.jsx, REPORT_CATEGORY_LABELS in lib/email/send.js and
-- CATEGORY_LABELS in app/admin/report/page.js.
alter table public.reports drop constraint if exists reports_category_check;
alter table public.reports add constraint reports_category_check
  check (category in ('harassment', 'spam', 'inappropriate', 'scam', 'other', 'inappropriate_review'));

-- 3. New resolution ----------------------------------------------------------
alter table public.reports drop constraint if exists reports_resolution_check;
alter table public.reports add constraint reports_resolution_check
  check (resolution in ('disabled_reported', 'disabled_reporter', 'dismissed', 'removed_review'));

-- 4. One open report per pair, PER KIND ---------------------------------------
-- 0053's index was on (reporter_id, reported_id) where status = 'pending', which
-- allowed exactly one open report per direction regardless of subject. Now that a
-- report can be about a review, that would mean a pending conversation report
-- silently no-ops a later report about the same person's review (and vice
-- versa) — the insert would hit 23505 and be treated as an idempotent re-file.
-- Split it so the two kinds are counted separately, and so a reporter can flag
-- two different reviews by the same author.
drop index if exists reports_one_open_per_pair;

create unique index if not exists reports_one_open_per_pair
  on public.reports (reporter_id, reported_id)
  where status = 'pending' and review_id is null;

create unique index if not exists reports_one_open_per_review
  on public.reports (reporter_id, review_id)
  where status = 'pending' and review_id is not null;
