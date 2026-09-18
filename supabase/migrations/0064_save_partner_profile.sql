-- ============================================================================
-- tutormatch — 0064: save_partner_profile()
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0063 (partners, partner_packages).
--
-- WHAT IT DOES:
--   One transaction that updates the caller's `partners` scalars and
--   replace-alls `partner_packages`, so a mid-save failure can't leave a centre
--   with half a rate card. Directly modelled on save_tutor_profile (0029/0037).
--
-- WHAT IT DELIBERATELY DOES NOT WRITE, and why:
--   * `owner_id` — with no verification column in this design, ownership IS the
--     security-relevant field. save_tutor_profile omits `verification_status`
--     for exactly the same reason: the safest way to stop a column being
--     self-written is for the only write path not to mention it.
--   * `id` — the primary key, obviously, but worth stating since the payload is
--     free-form jsonb and a future editor could otherwise pass one through.
--   * `slug` — renames go through assign_partner_slug() (0063), which is
--     race-safe. Writing the slug here would reintroduce the collision bug that
--     0013 exists to fix.
--
--   The caller is resolved from auth.uid() via owner_id, so a partner can only
--   ever write its own row, and an unclaimed partner (owner_id null) matches
--   nobody. That is correct: an unclaimed page is ours to edit, not the
--   public's.
-- ============================================================================

create or replace function public.save_partner_profile(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_id      uuid;
  v_profile jsonb := coalesce(p_payload -> 'profile', '{}'::jsonb);
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select id into v_id from public.partners where owner_id = v_uid;
  if v_id is null then
    raise exception 'no partner for current user';
  end if;

  -- 1. Scalars. Note the absence of owner_id / id / slug, per the header.
  update public.partners set
    name        = coalesce(nullif(btrim(v_profile ->> 'name'), ''), name),
    website_url = nullif(btrim(coalesce(v_profile ->> 'website_url', '')), ''),
    bio         = nullif(v_profile ->> 'bio', ''),
    bio_long    = nullif(v_profile ->> 'bio_long', ''),
    suburb      = nullif(v_profile ->> 'suburb', ''),
    city        = nullif(v_profile ->> 'city', ''),
    service_lat = nullif(v_profile ->> 'service_lat', '')::double precision,
    service_lng = nullif(v_profile ->> 'service_lng', '')::double precision,
    logo_url    = nullif(v_profile ->> 'logo_url', ''),
    banner_url  = nullif(v_profile ->> 'banner_url', ''),
    avatar_bg   = nullif(v_profile ->> 'avatar_bg', ''),
    banner_bg   = nullif(v_profile ->> 'banner_bg', ''),
    initials    = nullif(v_profile ->> 'initials', ''),
    visibility  = coalesce(nullif(v_profile ->> 'visibility', ''), 'public'),
    updated_at  = now()
  where id = v_id;

  -- `name` is coalesced back to the existing value rather than nulled, because
  -- the NOT NULL + non-blank CHECK on it would abort the whole save. The editor
  -- blocks a blank name too; this is the backstop.

  -- 2. Rate card: replace-all, position from array order (same as the tutor
  --    child tables in 0029).
  delete from public.partner_packages where partner_id = v_id;
  insert into public.partner_packages (partner_id, label, price, position)
  select v_id,
         e ->> 'label',
         (e ->> 'price')::int,
         (ord - 1)
    from jsonb_array_elements(coalesce(p_payload -> 'packages', '[]'::jsonb))
         with ordinality as t(e, ord)
   where coalesce(btrim(e ->> 'label'), '') <> ''
     and coalesce(e ->> 'price', '') <> '';

  return jsonb_build_object('ok', true);
end;
$$;

revoke all     on function public.save_partner_profile(jsonb) from public;
grant  execute on function public.save_partner_profile(jsonb) to authenticated;
