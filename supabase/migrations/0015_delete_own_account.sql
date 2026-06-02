-- ============================================================================
-- tutormatch — slice 15: self-service account deletion
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0001..0014 (in order). In particular it relies on the
--   on-delete-cascade chain established in 0001_init.sql.
--
-- WHY:
--   The /account page lets a logged-in user permanently delete their own
--   account. The anon/authenticated API roles can't touch the auth schema, so
--   deletion goes through a SECURITY DEFINER RPC scoped to auth.uid() (modelled
--   on assign_tutor_slug in 0013) — a caller can only ever delete THEMSELVES.
--
-- WHAT THIS DOES:
--   delete_own_account(): derives the id from auth.uid() and deletes the
--   matching auth.users row. That cascades through public.profiles
--   (references auth.users on delete cascade) and on to tutor_profiles /
--   student_profiles and their child rows (subjects/packages/experience/
--   education), so every trace of the account is removed.
--
-- KNOWN GAP (acceptable for v1):
--   Files in the `profile-images` Storage bucket (0006) are not FK-linked to
--   auth.users, so they are NOT cascade-deleted and become orphaned. If this
--   matters later, delete them client-side before calling this RPC, or add a
--   storage cleanup here.
-- ============================================================================

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := auth.uid();
begin
  if v_id is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = v_id;
end;
$$;

-- Lock it down: only authenticated callers (acting on their own auth.uid())
-- may invoke it. The owner's auth-schema delete rights are what make the
-- cascade possible; the wrapper guarantees the target is always the caller.
revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
