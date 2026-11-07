-- ============================================================================
-- tutormatch — 0077: Quick join (the managed-tutor signup opens to everyone)
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0001..0076 (in order).
--
-- DEPLOY ORDER: 0077 -> app -> 0078. This file is additive: the 0076 key
--   objects and redeem_tutor_invite(uuid, text) stay, so the previous app keeps
--   working until the new one is live. 0078 then drops them.
--
-- THE MODEL:
--   0076's page was reachable only through a secret link (/join?k=<key>) that
--   admins copied and rotated. It is now a normal public page, /quick-join,
--   linked from the nav. With no key there is nothing secret to hold, so:
--   * redeem_tutor_invite(p_user_id) takes no key. Everything else it refuses
--     (a disabled account, an admin, a student, a company tutor) is unchanged.
--   * Every tutor who becomes managed starts HIDDEN, including an existing
--     public tutor who opts in. Visibility is admin-only for a managed tutor
--     (set_tutor_visibility raises managed_by_admin), so an admin decides when
--     each profile goes live. New accounts were already inserted hidden.
--   * Bot flooding is held back by a DURABLE per-IP counter
--     (consume_quick_join_attempt), not lib/rateLimit.js, whose in-memory
--     counters reset per serverless instance. 5 attempts per IP per hour, no
--     global cap (by decision). The route hashes the IP before it gets here,
--     so no raw address is stored. Attempts are counted BEFORE an account is
--     created, so a blocked bot creates nothing.
-- ============================================================================

-- ── 1. The attempt counter ──────────────────────────────────────────────────
create table if not exists public.quick_join_attempts (
  ip_hash      text        not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  attempted_at timestamptz not null default now()
);

create index if not exists quick_join_attempts_ip_time
  on public.quick_join_attempts (ip_hash, attempted_at);

-- No policies: only the service role (the /api/join routes) reads or writes.
alter table public.quick_join_attempts enable row level security;

-- Record an attempt for this (hashed) IP and say whether it is allowed.
-- Allowed while fewer than 5 attempts landed in the last hour; a refused
-- attempt is NOT recorded, so a blocked client frees up once its oldest
-- attempt ages out. The advisory lock serialises concurrent attempts from the
-- same IP so two parallel requests cannot both slip in at 4.
create or replace function public.consume_quick_join_attempt(p_ip_hash text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent int;
begin
  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'bad ip hash' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('quick_join:' || p_ip_hash));

  -- Housekeeping: nothing older than a day is ever needed.
  delete from public.quick_join_attempts where attempted_at < now() - interval '1 day';

  select count(*) into v_recent
    from public.quick_join_attempts
   where ip_hash = p_ip_hash
     and attempted_at > now() - interval '1 hour';

  if v_recent >= 5 then
    return false;
  end if;

  insert into public.quick_join_attempts (ip_hash) values (p_ip_hash);
  return true;
end;
$$;

revoke all     on function public.consume_quick_join_attempt(text) from public, anon, authenticated;
grant  execute on function public.consume_quick_join_attempt(text) to service_role;

-- ── 2. Redeem without a key ─────────────────────────────────────────────────
-- The 0076 body minus the key check, and the final UPDATE also hides the
-- profile. Refuses, with the same hints as 0076:
--   a disabled account -> disabled
--   an admin           -> admin_account
--   a student/company  -> wrong_role (also a company tutor)
-- Idempotent for an account that is already managed (its visibility is left
-- alone, since an admin may already have published it).
create or replace function public.redeem_tutor_invite(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role         public.user_role;
  v_name         text;
  v_status       text;
  v_is_admin     boolean;
  v_partner      uuid;
  v_managed      timestamptz;
  v_confirmed_at timestamptz;
  v_created      boolean := false;
begin
  if p_user_id is null then
    raise exception 'no account' using errcode = '22023';
  end if;

  select role, full_name, status, is_admin into v_role, v_name, v_status, v_is_admin
    from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'no profile for that account' using errcode = 'P0002';
  end if;
  if v_status <> 'enabled' then
    raise exception 'This account is disabled.' using errcode = '42501', hint = 'disabled';
  end if;
  if v_is_admin then
    raise exception 'Admin accounts cannot be managed.' using errcode = '22023', hint = 'admin_account';
  end if;

  if v_role is null then
    update public.profiles set role = 'tutor' where id = p_user_id;
    select email_confirmed_at into v_confirmed_at from auth.users where id = p_user_id;
    insert into public.tutor_profiles (id, slug, email_confirmed_at, visibility, onboarded)
    values (p_user_id, p_user_id::text, v_confirmed_at, 'hidden', true);
    perform public._assign_tutor_slug(p_user_id, v_name);
    v_created := true;
  elsif v_role <> 'tutor' then
    raise exception 'Only tutor accounts can be managed.' using errcode = '22023', hint = 'wrong_role';
  end if;

  select partner_id, managed_at into v_partner, v_managed
    from public.tutor_profiles where id = p_user_id for update;
  if v_partner is not null then
    raise exception 'Only tutor accounts can be managed.' using errcode = '22023', hint = 'wrong_role';
  end if;
  if v_managed is not null then
    return jsonb_build_object('created', false, 'already', true, 'name', v_name);
  end if;

  update public.tutor_profiles
     set managed_at = now(),
         managed_setup_done_at = null,
         invite_materials_submitted_at = null,
         onboarded = true,
         visibility = 'hidden'
   where id = p_user_id;

  return jsonb_build_object('created', v_created, 'already', false, 'name', v_name);
end;
$$;

revoke all     on function public.redeem_tutor_invite(uuid) from public, anon, authenticated;
grant  execute on function public.redeem_tutor_invite(uuid) to service_role;
