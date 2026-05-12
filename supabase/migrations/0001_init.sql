-- ============================================================================
-- tutormatch — initial schema (slice 1: user authentication only)
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   1. Create a Supabase project at https://supabase.com (free tier is fine).
--   2. In the project, open: SQL Editor → New query.
--   3. Paste the entire contents of THIS file and click Run.
--   4. Confirm the tables exist under: Table Editor → public schema.
--
-- WHAT THIS DOES:
--   - Creates an enum `user_role` with values 'tutor' / 'student'.
--   - Creates a shared `profiles` table (1:1 with auth.users via uuid).
--   - Creates two role-specific extension tables: `tutor_profiles` and
--     `student_profiles`. Each is keyed by the same uuid as `profiles`.
--   - Adds a trigger so that signing up via Supabase auth automatically
--     creates the matching rows in `profiles` + the role-specific table.
--     The role + full_name come from auth.users.raw_user_meta_data, which
--     the signup form populates via signUp({ options: { data: { ... } } }).
--   - Enables RLS and adds self-only read/write policies. (Public-read on
--     tutor_profiles will be added in a later slice when /browse is wired up.)
-- ============================================================================

create type public.user_role as enum ('tutor', 'student');

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        public.user_role not null,
  full_name   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.tutor_profiles (
  id          uuid primary key references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table public.student_profiles (
  id          uuid primary key references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- Trigger function: fires after a new auth.users row is inserted (i.e. signup).
-- It reads `role` and `full_name` out of raw_user_meta_data and creates the
-- matching rows in profiles + the role-specific extension table atomically.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role := (new.raw_user_meta_data ->> 'role')::public.user_role;
begin
  insert into public.profiles (id, role, full_name)
  values (new.id, v_role, new.raw_user_meta_data ->> 'full_name');

  if v_role = 'tutor' then
    insert into public.tutor_profiles (id) values (new.id);
  else
    insert into public.student_profiles (id) values (new.id);
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row-level security
alter table public.profiles         enable row level security;
alter table public.tutor_profiles   enable row level security;
alter table public.student_profiles enable row level security;

create policy "profile self read"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profile self update"
  on public.profiles for update
  using (auth.uid() = id);

create policy "tutor self rw"
  on public.tutor_profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "student self rw"
  on public.student_profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);
