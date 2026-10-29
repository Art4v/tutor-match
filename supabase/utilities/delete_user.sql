-- ============================================================================
-- tutormatch — DELETE ONE USER BY ID (dev only)
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   1. Put the target user's uuid in the set_config(...) line below (one spot).
--   2. Supabase Studio -> SQL Editor -> paste this whole file -> Run.
--
-- Don't know the id? Look it up by email first (run this on its own):
--   select id, email from auth.users where email = 'someone@example.com';
--
-- Deleting a COMPANY? Use delete_company.sql (or Manage -> Delete on
-- /admin/companies) instead. This file deletes one account, and a company's
-- page and its tutors' shadow accounts would survive it.
--
-- WARNING — this is destructive for that ONE account. Deleting the
-- `auth.users` row cascades (via `on delete cascade`) to:
--   * public.profiles  ->  public.tutor_profiles  ->  its child tables
--     (tutor_subjects, tutor_packages, tutor_experience, tutor_education,
--      tutor_documents, tutor_profile_revisions (0072),
--      tutor_invite_materials (0076))
--   * public.student_profiles  ->  saved_tutors, reviews they wrote
--   * conversations either side, messages they sent, message_reactions,
--     blocked_users either side, reports either side, reviews of them
--   * public.notifications, public.ai_usage (keyed straight off auth.users.id)
-- Ratings stay right: deleting a review fires recalc_tutor_rating (0057/0058).
--
-- SET NULL instead of deleted (the row outlives the account, by design):
--   * articles.author_id      -> their published articles stay up, no byline
--   * partners.owner_id       -> a company they owned reverts to unclaimed
--   * partners.created_by, admin_actions.admin_id, tutor_invite_key.rotated_by
--     (History keeps its admin_name snapshot)
-- The first query below lists any of these so nothing surprises you.
--
-- DOES NOT delete the user's uploaded files: Supabase blocks direct DELETEs on
-- storage tables (a `storage.protect_delete()` trigger), so those must go
-- through the Storage API. The last query LISTS them; delete the `<uid>/`
-- folder in Studio -> Storage in every bucket it names. Every bucket is keyed
-- `<uid>/...`: profile-images, tutor-docs (PUBLIC, fetchable by raw URL until
-- removed), blog-images (PUBLIC, and still referenced by any article that
-- survives above), profile-staging and tutor-invite-materials (both private,
-- but the invite materials are personal documents, so do remove them).
--
-- WHAT IT PRESERVES:
--   * Every other user and all their data.
--   * The schema, RLS policies, functions/triggers, the seeded `subjects` /
--     `schools` tables, and the storage buckets themselves.
-- ============================================================================

-- >>> EDIT THIS LINE — paste the auth.users.id (uuid) to delete <<<
-- Stored as a session setting so the id only appears once below. `false` keeps
-- it set past the commit so the queries at the bottom can reuse it.
select set_config('reset.user_id', '00000000-0000-0000-0000-000000000000', false);

-- What survives the delete with a NULLed link (review before running the rest).
select 'article (byline cleared)' as kind, slug as item from public.articles
 where author_id = current_setting('reset.user_id')::uuid
union all
select 'company (becomes unclaimed)', slug from public.partners
 where owner_id = current_setting('reset.user_id')::uuid;

begin;

-- The account itself. The FK cascade drains every dependent public.* row.
delete from auth.users
where id = current_setting('reset.user_id')::uuid;

commit;

-- Sanity check — every count below should be 0 for the deleted id.
select 'auth.users'             as table, count(*) from auth.users             where id = current_setting('reset.user_id')::uuid
union all select 'profiles',             count(*) from public.profiles                where id = current_setting('reset.user_id')::uuid
union all select 'tutor_profiles',       count(*) from public.tutor_profiles          where id = current_setting('reset.user_id')::uuid
union all select 'student_profiles',     count(*) from public.student_profiles        where id = current_setting('reset.user_id')::uuid
union all select 'tutor_subjects',       count(*) from public.tutor_subjects          where tutor_id = current_setting('reset.user_id')::uuid
union all select 'tutor_packages',       count(*) from public.tutor_packages          where tutor_id = current_setting('reset.user_id')::uuid
union all select 'tutor_experience',     count(*) from public.tutor_experience        where tutor_id = current_setting('reset.user_id')::uuid
union all select 'tutor_education',      count(*) from public.tutor_education         where tutor_id = current_setting('reset.user_id')::uuid
union all select 'tutor_documents',      count(*) from public.tutor_documents         where tutor_id = current_setting('reset.user_id')::uuid
union all select 'tutor_profile_revisions', count(*) from public.tutor_profile_revisions where tutor_id = current_setting('reset.user_id')::uuid
union all select 'tutor_invite_materials',  count(*) from public.tutor_invite_materials  where tutor_id = current_setting('reset.user_id')::uuid
union all select 'saved_tutors',         count(*) from public.saved_tutors            where current_setting('reset.user_id')::uuid in (student_id, tutor_id)
union all select 'reviews',              count(*) from public.reviews                 where current_setting('reset.user_id')::uuid in (student_id, tutor_id)
union all select 'conversations',        count(*) from public.conversations           where current_setting('reset.user_id')::uuid in (student_id, tutor_id)
union all select 'messages',             count(*) from public.messages                where sender_id = current_setting('reset.user_id')::uuid
union all select 'blocked_users',        count(*) from public.blocked_users           where current_setting('reset.user_id')::uuid in (blocker_id, blocked_id)
union all select 'reports',              count(*) from public.reports                 where current_setting('reset.user_id')::uuid in (reporter_id, reported_id)
union all select 'notifications',        count(*) from public.notifications           where user_id  = current_setting('reset.user_id')::uuid
union all select 'ai_usage',             count(*) from public.ai_usage                where user_id  = current_setting('reset.user_id')::uuid;

-- Storage cleanup TODO — the user's leftover files, per bucket (DELETE is
-- blocked in SQL; remove them via Studio -> Storage).
select bucket_id, name, id
from storage.objects
where bucket_id in ('profile-images', 'tutor-docs', 'blog-images', 'profile-staging', 'tutor-invite-materials')
  and (storage.foldername(name))[1] = current_setting('reset.user_id');
