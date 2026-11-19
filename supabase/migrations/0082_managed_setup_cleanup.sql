-- ============================================================================
-- tutormatch — 0082: drop what the managed setup flow (0081) retired
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0001..0081 (in order).
--
-- DEPLOY ORDER: 0081 -> app -> 0082. Run this only after the app that uses the
--   0081 RPCs is live: it removes the functions the previous app called.
--
-- WHAT GOES:
--   * admin_set_tutor_verification, admin_set_managed_tutor_visibility: a
--     managed tutor is verified and published only by admin_verify_managed_tutor,
--     after the tutor approved. Dropping these is what makes that approval a
--     hard requirement rather than a convention of the UI.
--   * admin_mark_managed_setup_done and tutor_profiles.managed_setup_done_at:
--     replaced by tutor_managed_setup.stage.
--   * the two-argument submit_invite_materials wrapper.
--   The admin_actions CHECK keeps verification_set, managed_visibility_set and
--   managed_setup_done for the History rows that already have them.
--
-- WHAT IS ADDED:
--   * tutor_profiles_managed_is_hidden_unverified: while managed_at is set, a
--     tutor is hidden and neither verified nor pending. This is the hard
--     requirement as a table constraint, so it holds for EVERY writer, not
--     only the dropped toggles: request_tutor_verification (0021) and
--     admin_decide_verification (0074) know nothing about managed tutors, and
--     without this a managed tutor could ask for verification from the browser
--     console and be approved in the ordinary queue, skipping their own
--     approval. admin_verify_managed_tutor clears managed_at in the same
--     UPDATE that verifies and publishes, so it satisfies the constraint.
--     It could not go in 0081: the previous app's toggles would have failed
--     against it during the deploy window.
-- ============================================================================

begin;

drop function if exists public.admin_set_tutor_verification(uuid, boolean, text);
drop function if exists public.admin_set_managed_tutor_visibility(uuid, text);
drop function if exists public.admin_mark_managed_setup_done(uuid, text);
drop function if exists public.submit_invite_materials(jsonb, jsonb);

-- 0076's guard without managed_setup_done_at. Re-created before the column is
-- dropped: the body is resolved when the trigger fires, and it fires on every
-- client update of tutor_profiles.
create or replace function public.tutor_profiles_guard_derived()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.rating       := old.rating;
    new.review_count := old.review_count;

    if new.verification_status is distinct from old.verification_status then
      raise exception 'protected_column:verification_status' using errcode = '42501';
    end if;
    if new.verification_requested_at is distinct from old.verification_requested_at then
      raise exception 'protected_column:verification_requested_at' using errcode = '42501';
    end if;
    if new.partner_id is distinct from old.partner_id then
      raise exception 'protected_column:partner_id' using errcode = '42501';
    end if;
    if new.slug is distinct from old.slug then
      raise exception 'protected_column:slug' using errcode = '42501';
    end if;
    if new.email_confirmed_at is distinct from old.email_confirmed_at then
      raise exception 'protected_column:email_confirmed_at' using errcode = '42501';
    end if;
    if new.onboarded is distinct from old.onboarded then
      raise exception 'protected_column:onboarded' using errcode = '42501';
    end if;
    if new.managed_at is distinct from old.managed_at then
      raise exception 'protected_column:managed_at' using errcode = '42501';
    end if;
    if new.invite_materials_submitted_at is distinct from old.invite_materials_submitted_at then
      raise exception 'protected_column:invite_materials_submitted_at' using errcode = '42501';
    end if;
    if new.admin_edited_at is distinct from old.admin_edited_at then
      raise exception 'protected_column:admin_edited_at' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- The window between 0081 and this file: the previous app could still verify
-- or publish a managed tutor directly. Undo that before the constraint, so the
-- tutor's approval is what gets them there.
update public.tutor_profiles
   set visibility = 'hidden',
       verification_status = case when verification_status in ('verified', 'pending') then 'none' else verification_status end,
       verification_requested_at = null
 where managed_at is not null
   and (visibility <> 'hidden' or verification_status in ('verified', 'pending'));

alter table public.tutor_profiles drop constraint if exists tutor_profiles_managed_is_hidden_unverified;
alter table public.tutor_profiles add constraint tutor_profiles_managed_is_hidden_unverified check (
  managed_at is null
  or (visibility = 'hidden' and verification_status in ('none', 'rejected'))
);

-- _tutor_snapshot (0076) still subtracts 'managed_setup_done_at' from the row
-- by name; removing a key that is not there is a no-op, so it needs no change.
alter table public.tutor_profiles drop column if exists managed_setup_done_at;

commit;
