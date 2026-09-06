-- ============================================================================
-- tutormatch — GRANT / REVOKE BLOG AUTHORING (admin action)
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   1. Put the target user's uuid in the set_config(...) line below (one spot).
--   2. Supabase Studio -> SQL Editor -> paste this whole file -> Run.
--
-- Don't know the id? Look it up by email first (run this on its own):
--   select id, email from auth.users where email = 'someone@example.com';
--
-- WHAT IT DOES:
--   Sets profiles.can_author_articles = true (0061), which is what lets someone
--   create, edit and publish blog articles at /author. Everything else about
--   the account is untouched: an author is an ordinary tutor with this one
--   extra capability, which is exactly why it is a flag rather than a role.
--
-- THIS IS THE ONLY WAY TO GRANT IT, and that is deliberate. profiles carries a
--   `profiles_guard_capabilities` BEFORE UPDATE trigger (0061) that pins this
--   column whenever current_user is 'authenticated' or 'anon', so a signed-in
--   user cannot grant it to themselves from the browser — the update reports
--   success and changes nothing. The SQL editor runs as a superuser role, so it
--   passes the guard. Any future admin UI must go through the service-role
--   client for the same reason.
--
--   The target must be a TUTOR. articles.author_id references tutor_profiles,
--   so flagging a student or a role-less account grants a capability they can
--   never use: /author will let them in and every insert will fail the FK. The
--   sanity check at the bottom shows the role so you can see this before it
--   confuses someone.
--
--   Requires migration 0061.
--
-- To REVOKE, uncomment the block below. Revoking freezes that author's existing
-- articles rather than unpublishing them: published articles stay live (public
-- SELECT only looks at status), but every write policy fails from then on, so
-- they can no longer edit or delete their own work. To take an article DOWN,
-- set its status instead:
--   update public.articles set status = 'removed' where slug = '...';
-- ============================================================================

begin;

-- >>> EDIT THIS LINE — paste the profiles.id (uuid) to grant authoring to <<<
select set_config('util.user_id', '00000000-0000-0000-0000-000000000000', false);

update public.profiles
   set can_author_articles = true
 where id = current_setting('util.user_id')::uuid;

-- Revoke (uncomment to use instead of the update above):
-- update public.profiles
--    set can_author_articles = false
--  where id = current_setting('util.user_id')::uuid;

commit;

-- Sanity check — confirm the capability, and that the account is actually a
-- tutor (see the note above about the articles.author_id FK).
select p.id,
       p.full_name,
       p.role,
       p.status,
       p.can_author_articles,
       t.slug as tutor_slug,
       (select count(*) from public.articles a where a.author_id = p.id) as articles
from public.profiles p
left join public.tutor_profiles t on t.id = p.id
where p.id = current_setting('util.user_id')::uuid;
