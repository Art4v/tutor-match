-- ============================================================================
-- 0075 — drop the company-inviter capability (part 2 of 0074)
-- ----------------------------------------------------------------------------
-- Company invites are an admin power since 0074 (_is_company_inviter() already
-- delegates to is_admin()). Run only after the app that no longer reads
-- profiles.can_invite_companies is live, or /companies/invite's old guard
-- would error on the missing column.
--
-- _is_company_inviter() is KEPT: the three 0068/0074 invite RPCs call it, and
-- it is now a one-line alias for is_admin().
-- ============================================================================

create or replace function public.profiles_guard_capabilities()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.can_author_articles := old.can_author_articles;

    if new.is_admin is distinct from old.is_admin then
      raise exception 'protected_column:is_admin' using errcode = '42501';
    end if;
    if new.role is distinct from old.role then
      raise exception 'protected_column:role' using errcode = '42501';
    end if;
    if new.status is distinct from old.status then
      raise exception 'protected_column:status' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

alter table public.profiles drop column if exists can_invite_companies;
