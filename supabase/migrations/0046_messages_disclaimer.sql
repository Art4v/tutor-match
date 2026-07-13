-- ============================================================================
-- tutormatch — slice 46: messages disclaimer gate (first-open, versioned)
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0001..0045 (in order).
--
-- WHY:
--   /messages shows an "About these messages" disclaimer (liability + off-
--   platform + Terms/Privacy). We want it to appear as a BLOCKING gate the
--   first time a user opens the Messages tab, acknowledged once per ACCOUNT
--   (survives device switches / storage clears) and re-promptable when the copy
--   is rewritten later (versioned via lib/messagesDisclaimer.js).
--
-- WHAT THIS DOES:
--   1. Adds profiles.messages_disclaimer_ack_at (nullable, no default, no
--      backfill) — so every existing AND new user starts un-acknowledged and
--      sees the gate once. Deliberately NOT stamped by handle_new_user() (unlike
--      terms_agreed_at): new signups should also see the disclaimer.
--   2. acknowledge_messages_disclaimer(): server-set now() stamp, scoped to
--      auth.uid() (a user can only acknowledge on their own behalf).
--
-- EXPOSURE NOTE: `profiles` tutor rows are public-read (0004), so this timestamp
--   is publicly readable for tutors — the same exposure terms_agreed_at has.
--   Acceptable (it is just an acknowledgment timestamp).
-- ============================================================================

alter table public.profiles
  add column messages_disclaimer_ack_at timestamptz;

-- ----------------------------------------------------------------------------
-- acknowledge_messages_disclaimer(): stamp the caller's acknowledgment.
-- SECURITY DEFINER + now() means the timestamp is server-set and can't be
-- backdated; scoped to auth.uid() so a user only acknowledges for themselves.
-- ----------------------------------------------------------------------------
create or replace function public.acknowledge_messages_disclaimer()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  update public.profiles
     set messages_disclaimer_ack_at = now()
   where id = auth.uid();
end;
$$;

grant execute on function public.acknowledge_messages_disclaimer() to authenticated;
