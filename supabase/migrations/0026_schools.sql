-- 0026_schools.sql
-- Structured schools: a seeded reference table (top 50 NSW schools, 2025 HSC
-- ranking) plus a nullable school_id FK on tutor_education. Mirrors the
-- subjects/tutor_subjects pattern, but reuses the existing education rows rather
-- than a separate join table.
--
-- The school_id is set only when a tutor's high-school entry matches a listed
-- school; the existing `school` text column stays as the always-present display
-- name (and is the only value for unlisted / custom schools and universities).
--
-- The seed list is point-in-time (2025 HSC). Re-seed with a later additive
-- migration if the rankings change.

-- Reference table (mirrors public.subjects shape).
create table if not exists public.schools (
  id       uuid primary key default gen_random_uuid(),
  name     text not null unique,
  slug     text not null unique,
  position int  not null default 0   -- preserves the HSC rank order
);

alter table public.schools enable row level security;

-- Public read; never written from the client (seeded only, like subjects).
drop policy if exists "schools public read" on public.schools;
create policy "schools public read" on public.schools for select using (true);

-- Seed: top 50 NSW schools, 2025 HSC ranking (position = rank).
insert into public.schools (name, slug, position) values
  ('North Sydney Boys High School','north-sydney-boys-high-school',1),
  ('James Ruse Agricultural High School','james-ruse-agricultural-high-school',2),
  ('Sydney Grammar School','sydney-grammar-school',3),
  ('North Sydney Girls High School','north-sydney-girls-high-school',4),
  ('Normanhurst Boys High School','normanhurst-boys-high-school',5),
  ('Sydney Boys High School','sydney-boys-high-school',6),
  ('Baulkham Hills High School','baulkham-hills-high-school',7),
  ('Hornsby Girls High School','hornsby-girls-high-school',8),
  ('St Aloysius'' College','st-aloysius-college',9),
  ('Reddam House','reddam-house',10),
  ('Abbotsleigh','abbotsleigh',11),
  ('Ascham School','ascham-school',12),
  ('Sydney Girls High School','sydney-girls-high-school',13),
  ('Ravenswood School for Girls','ravenswood-school-for-girls',14),
  ('Conservatorium High School','conservatorium-high-school',15),
  ('Presbyterian Ladies'' College Sydney','presbyterian-ladies-college-sydney',16),
  ('Penrith Selective High School','penrith-selective-high-school',17),
  ('Pymble Ladies'' College','pymble-ladies-college',18),
  ('Roseville College','roseville-college',19),
  ('Fort Street High School','fort-street-high-school',20),
  ('SCEGGS Darlinghurst','sceggs-darlinghurst',21),
  ('Merewether High School','merewether-high-school',22),
  ('Al-Faisal College','al-faisal-college',23),
  ('Meriden School','meriden-school',24),
  ('Northern Beaches Secondary College Manly Campus','northern-beaches-secondary-college-manly-campus',25),
  ('Girraween High School','girraween-high-school',26),
  ('Sydney Church of England Grammar School (Shore)','sydney-church-of-england-grammar-school-shore',27),
  ('Alpha Omega Senior College','alpha-omega-senior-college',28),
  ('Knox Grammar School','knox-grammar-school',29),
  ('Loreto Kirribilli','loreto-kirribilli',30),
  ('Caringbah High School','caringbah-high-school',31),
  ('Queenwood','queenwood',32),
  ('Gosford High School','gosford-high-school',33),
  ('Kincoppal-Rose Bay School of the Sacred Heart','kincoppal-rose-bay-school-of-the-sacred-heart',34),
  ('Wenona School','wenona-school',35),
  ('Kambala','kambala',36),
  ('Northholm Grammar School','northholm-grammar-school',37),
  ('St Catherine''s School Waverley','st-catherines-school-waverley',38),
  ('Tara Anglican School for Girls','tara-anglican-school-for-girls',39),
  ('Loreto Normanhurst','loreto-normanhurst',40),
  ('Al Noori Muslim School','al-noori-muslim-school',41),
  ('The King''s School','the-kings-school',42),
  ('Hurlstone Agricultural High School','hurlstone-agricultural-high-school',43),
  ('Parramatta Marist High School','parramatta-marist-high-school',44),
  ('St George Girls High School','st-george-girls-high-school',45),
  ('Sydney Technical High School','sydney-technical-high-school',46),
  ('Cranbrook School','cranbrook-school',47),
  ('Brigidine College St Ives','brigidine-college-st-ives',48),
  ('Monte Sant'' Angelo Mercy College','monte-sant-angelo-mercy-college',49),
  ('Barker College','barker-college',50)
on conflict (slug) do nothing;

-- Structured link on existing education rows. ON DELETE SET NULL so removing a
-- school from the catalog degrades to free text (the `school` name is retained).
alter table public.tutor_education
  add column if not exists school_id uuid references public.schools(id) on delete set null;

create index if not exists tutor_education_school_id_idx
  on public.tutor_education (school_id);

-- Best-effort migration of existing free-text high-school names → school_id
-- (case-insensitive, trimmed exact match). Unmatched rows keep their free text.
update public.tutor_education te
set school_id = s.id
from public.schools s
where te.school_id is null
  and te.level = 'high_school'
  and lower(btrim(te.school)) = lower(s.name);
