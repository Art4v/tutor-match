-- ============================================================================
-- tutormatch — slice 60: key the pair index on the report's kind, not on
--                        "review_id is null"
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0001..0059 (in order). Fixes the 0059 split of
--   reports_one_open_per_pair.
--
-- WHY:
--   0059 keyed the conversation-pair index on `review_id IS NULL`. But 0059 also
--   made reports.review_id ON DELETE SET NULL, so when an author deletes a
--   reported review, the pending report MIGRATES INTO the conversation-pair
--   index's domain. Two failures follow:
--
--   1. If the reporter also has a pending conversation report about the same
--      person, the FK's SET NULL update collides with the index (23505) and
--      ABORTS THE REVIEW DELETE — the author gets a 500 from their own delete
--      button until an admin resolves one of the reports.
--   2. Without a collision, the orphaned review report now occupies the
--      conversation-pair slot: a later, genuine conversation report about the
--      same pair hits 23505 on insert, which /api/reports treats as an
--      idempotent re-file — no row, no admin email. The escalation silently
--      vanishes (only the participant block lands).
--
--   Fix: key the index on `conversation_id IS NOT NULL`, which is what "this is
--   a conversation report" actually means (/api/reports nulls conversation_id
--   on the review path). A report whose review was deleted has conversation_id
--   NULL, so it never enters this index — the delete can't collide, and the
--   slot stays free for real conversation reports.
--
--   reports_one_open_per_review (0059) is unchanged: SET NULL simply drops the
--   row out of it, which is correct — a deleted review can't be re-reported.
--
-- SAFE TO RE-RUN, and safe whether or not 0059 was already applied: the create
-- in 0059 used IF NOT EXISTS, so this file drops and recreates unconditionally.
-- No existing row can violate the new predicate (review reports always carry a
-- NULL conversation_id, so the rows the new index covers are a subset of the
-- conversation reports the old one already proved unique).
-- ============================================================================

drop index if exists reports_one_open_per_pair;

create unique index reports_one_open_per_pair
  on public.reports (reporter_id, reported_id)
  where status = 'pending' and conversation_id is not null;
