-- ============================================================================
-- tutormatch — slice 20: AI generation usage limits
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0001..0019 (in order). Relies on the auth.users table and the
--   SECURITY DEFINER / auth.uid() pattern established in 0015_delete_own_account.
--
-- WHY:
--   /settings -> About lets a tutor AI-generate their tagline and long bio via
--   Groq (see app/api/ai/generate-bio). To prevent abuse we cap each tutor at a
--   fixed number of generations per UTC day. The counter must survive across
--   Vercel serverless instances / cold starts, so it lives in the DB rather than
--   an in-process Map.
--
-- WHAT THIS DOES:
--   * ai_usage — one row per (user, day) holding the running count.
--   * consume_ai_credit() — the atomic gate. Increments today's count only if
--     it is below the hardcoded daily limit and reports whether the caller is
--     allowed. The limit is NOT a parameter: a client calling this RPC directly
--     must not be able to raise their own cap.
--   * refund_ai_credit() — decrements today's count (floored at 0). The route
--     calls this only when the Groq request itself fails, so a provider outage
--     doesn't burn the tutor's credit.
-- ============================================================================

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null,
  count   int  not null default 0,
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;

-- Self-only read (lets the editor optionally show remaining credits). All
-- writes happen through the SECURITY DEFINER RPCs below — there is deliberately
-- no INSERT/UPDATE policy, so the API roles can't tamper with counts directly.
drop policy if exists "ai_usage self read" on public.ai_usage;
create policy "ai_usage self read"
  on public.ai_usage for select
  using (user_id = auth.uid());

-- Atomic check-and-increment. Returns allowed + the resulting (or current)
-- count + the day's limit so the route can surface remaining credits.
create or replace function public.consume_ai_credit()
returns table(allowed boolean, used int, day_limit int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    uuid := auth.uid();
  v_day   date := (now() at time zone 'utc')::date;
  v_limit constant int := 10; -- hardcoded: clients must not be able to raise it
  v_used  int;
begin
  if v_id is null then
    raise exception 'not authenticated';
  end if;

  -- Make sure today's row exists, then increment only while under the cap.
  insert into ai_usage(user_id, day, count)
    values (v_id, v_day, 0)
    on conflict (user_id, day) do nothing;

  update ai_usage
     set count = count + 1
   where user_id = v_id and day = v_day and count < v_limit
   returning count into v_used;

  if found then
    allowed   := true;
    used      := v_used;
  else
    select count into v_used from ai_usage where user_id = v_id and day = v_day;
    allowed   := false;
    used      := v_used;
  end if;

  day_limit := v_limit;
  return next;
end;
$$;

-- Best-effort refund when generation fails after a credit was consumed.
create or replace function public.refund_ai_credit()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id  uuid := auth.uid();
  v_day date := (now() at time zone 'utc')::date;
begin
  if v_id is null then
    raise exception 'not authenticated';
  end if;
  update ai_usage
     set count = greatest(count - 1, 0)
   where user_id = v_id and day = v_day;
end;
$$;

-- Only authenticated callers (acting on their own auth.uid()) may invoke these.
revoke all on function public.consume_ai_credit() from public;
grant execute on function public.consume_ai_credit() to authenticated;
revoke all on function public.refund_ai_credit() from public;
grant execute on function public.refund_ai_credit() to authenticated;
