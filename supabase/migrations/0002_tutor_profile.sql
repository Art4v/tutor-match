-- ============================================================================
-- tutormatch — slice 2: tutor profile schema
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON:
--   0001_init.sql must already be applied (it created the `profiles` and the
--   skeleton `tutor_profiles` tables, plus the handle_new_user() trigger).
--
-- WHAT THIS DOES:
--   1. Expands `tutor_profiles` with every column the tutor profile page
--      needs (bio, atar, rate, availability JSONB, rating, etc.).
--   2. Creates a `subjects` reference table seeded with the 17 subjects the
--      app currently supports (HSC + UCAT + LSAT).
--   3. Creates `tutor_subjects` as a join table linking tutors to subjects.
--   4. Creates `tutor_packages`, `tutor_experience`, `tutor_education` as
--      ordered child tables (one row per item, with a `position` column).
--   5. Adds RLS so tutors can self-write their own rows and everyone can
--      publicly read tutor data (the directory is public).
-- ============================================================================

-- 1. Expand tutor_profiles ----------------------------------------------------

alter table public.tutor_profiles
  add column bio              text,
  add column bio_long         text,
  add column location_display text,                                -- "Lower North Shore + Online"
  add column suburb           text,
  add column city             text,
  add column avatar_bg        text,                                -- CSS oklch() color
  add column initials         text,                                -- 2-char monogram
  add column atar             numeric(4,2),                        -- e.g. 99.85
  add column atar_rank        text,                                -- "State Rank in Mathematics Extension 2"
  add column rate             int,                                 -- AUD per hour
  add column online           bool not null default false,
  add column responsive       text,                                -- "Very responsive" / "Responsive" / "Usually responds within 1 hour"
  add column years_tutoring   int,
  add column school           text,
  add column school_year      text,                                -- "Class of 2023"
  add column university       text,
  add column degree           text,
  add column degree_year      text,                                -- "Expected 2027"
  add column credentials      text[] default '{}',                 -- short tag strings
  add column languages        text[] default '{}',
  add column rating           numeric(2,1),                        -- 4.9
  add column review_count     int not null default 0,
  add column availability     jsonb,                               -- { hours: [], days: [], grid: [][] }
  add column updated_at       timestamptz not null default now();

-- 2. subjects reference table -------------------------------------------------

create table public.subjects (
  id       uuid primary key default gen_random_uuid(),
  name     text not null unique,
  slug     text not null unique,
  position int  not null default 0
);

insert into public.subjects (name, slug, position) values
  ('Mathematics Advanced',  'mathematics-advanced',   1),
  ('Mathematics Ext 1',     'mathematics-ext-1',      2),
  ('Mathematics Ext 2',     'mathematics-ext-2',      3),
  ('Mathematics Standard',  'mathematics-standard',   4),
  ('Physics',               'physics',                5),
  ('Chemistry',             'chemistry',              6),
  ('Biology',               'biology',                7),
  ('English Advanced',      'english-advanced',       8),
  ('English Extension 1',   'english-extension-1',    9),
  ('English Extension 2',   'english-extension-2',   10),
  ('Modern History',        'modern-history',        11),
  ('Society & Culture',     'society-and-culture',   12),
  ('Economics',             'economics',             13),
  ('Business Studies',      'business-studies',      14),
  ('Legal Studies',         'legal-studies',         15),
  ('UCAT',                  'ucat',                  16),
  ('LSAT',                  'lsat',                  17);

-- 3. tutor_subjects join table ------------------------------------------------

create table public.tutor_subjects (
  tutor_id   uuid not null references public.tutor_profiles(id) on delete cascade,
  subject_id uuid not null references public.subjects(id)       on delete cascade,
  primary key (tutor_id, subject_id)
);

-- 4. Ordered child tables -----------------------------------------------------

create table public.tutor_packages (
  id        uuid primary key default gen_random_uuid(),
  tutor_id  uuid not null references public.tutor_profiles(id) on delete cascade,
  label     text not null,                                       -- "Single lesson" / "5-lesson pack"
  duration  text,                                                -- "60 min" / "5 × 60 min"
  price     int  not null,                                       -- AUD
  save_text text,                                                -- "save $25" (nullable)
  position  int  not null default 0
);

create table public.tutor_experience (
  id        uuid primary key default gen_random_uuid(),
  tutor_id  uuid not null references public.tutor_profiles(id) on delete cascade,
  role      text,
  org       text,
  period    text,                                                -- "2024 — present"
  note      text,
  position  int  not null default 0
);

create table public.tutor_education (
  id        uuid primary key default gen_random_uuid(),
  tutor_id  uuid not null references public.tutor_profiles(id) on delete cascade,
  school    text,
  detail    text,
  position  int  not null default 0
);

-- 5. Indexes ------------------------------------------------------------------
-- Postgres does not auto-create indexes on FK columns. These are needed for
-- the cascading deletes + future /browse subject filtering queries.

create index on public.tutor_subjects   (tutor_id);
create index on public.tutor_subjects   (subject_id);
create index on public.tutor_packages   (tutor_id, position);
create index on public.tutor_experience (tutor_id, position);
create index on public.tutor_education  (tutor_id, position);

-- 6. RLS ----------------------------------------------------------------------

-- subjects: public read; never written from client
alter table public.subjects enable row level security;
create policy "subjects public read"
  on public.subjects for select using (true);

-- tutor_profiles: add public read (slice 1 was self-only)
create policy "tutor_profiles public read"
  on public.tutor_profiles for select using (true);

-- tutor_subjects: public read, tutor self-write
alter table public.tutor_subjects enable row level security;
create policy "tutor_subjects public read"
  on public.tutor_subjects for select using (true);
create policy "tutor_subjects self write"
  on public.tutor_subjects for all
  using  (auth.uid() = tutor_id)
  with check (auth.uid() = tutor_id);

-- tutor_packages
alter table public.tutor_packages enable row level security;
create policy "tutor_packages public read"
  on public.tutor_packages for select using (true);
create policy "tutor_packages self write"
  on public.tutor_packages for all
  using  (auth.uid() = tutor_id)
  with check (auth.uid() = tutor_id);

-- tutor_experience
alter table public.tutor_experience enable row level security;
create policy "tutor_experience public read"
  on public.tutor_experience for select using (true);
create policy "tutor_experience self write"
  on public.tutor_experience for all
  using  (auth.uid() = tutor_id)
  with check (auth.uid() = tutor_id);

-- tutor_education
alter table public.tutor_education enable row level security;
create policy "tutor_education public read"
  on public.tutor_education for select using (true);
create policy "tutor_education self write"
  on public.tutor_education for all
  using  (auth.uid() = tutor_id)
  with check (auth.uid() = tutor_id);
