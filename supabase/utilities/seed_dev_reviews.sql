-- ============================================================================
-- tutormatch — SEED 5 DUMMY REVIEWS FOR ONE TUTOR (DEV ONLY)
-- ----------------------------------------------------------------------------
-- *** DO NOT RUN THIS AGAINST PRODUCTION. ***
-- It CREATES FIVE FAKE USER ACCOUNTS in auth.users so the reviews have real
-- authors (reviews.student_id is a FK to student_profiles, so authorless reviews
-- are impossible by design). The teardown at the bottom removes them again.
--
-- HOW TO APPLY:
--   1. Apply supabase/migrations/0057_reviews.sql first.
--   2. Check the tutor name on the ">>> EDIT THIS LINE" row below.
--   3. Supabase Studio -> SQL Editor -> paste this whole file -> Run.
--
-- WHAT IT CREATES:
--   * 5 auth.users rows, emails dev+review1..5@matchtutor.test, password
--     "DevReview123!" (they are confirmed, so you can log in as one to test the
--     author-only edit/delete controls in a later slice).
--   * Their profiles (role 'student') + student_profiles rows.
--   * 5 APPROVED reviews for the target tutor: ratings 5, 5, 4, 5, 3 (average
--     4.4, deliberately not a whole number so the fractional-star rendering gets
--     exercised) with a mix of with-text and text-free reviews.
--
-- Note the reviews are inserted with status 'approved' directly, which the RLS
-- insert policy would refuse (it requires 'pending'). That is fine: the SQL
-- Editor runs as a superuser and bypasses RLS. It is also the point — this seeds
-- the END state so the public UI has something to render without walking the
-- whole moderation flow by hand.
--
-- rating / review_count on tutor_profiles are NOT set here. The 0057 trigger
-- owns them and recomputes on insert, so they populate on their own.
--
-- IDEMPOTENT: fixed uuids + ON CONFLICT DO NOTHING, so re-running changes
-- nothing. Everything is inside one transaction.
-- ============================================================================

begin;

-- The seed set, in one place. Temp table (not a CTE) because several statements
-- below need it; `on commit drop` cleans it up when this transaction ends.
create temp table _seed_reviewers (
  id         uuid primary key,
  email      text not null,
  full_name  text not null,
  rating     int  not null,
  body       text,
  age_days   int  not null   -- how long ago the review was left
) on commit drop;

insert into _seed_reviewers (id, email, full_name, rating, body, age_days) values
  ('de000000-0000-4000-8000-000000000001', 'dev+review1@matchtutor.test', 'Mia Chen',
   5, 'Explained three years of calculus in a way that finally clicked. My marks went up a full band before trials and I actually stopped dreading the subject.', 4),
  ('de000000-0000-4000-8000-000000000002', 'dev+review2@matchtutor.test', 'Jayden Patel',
   5, null, 11),
  ('de000000-0000-4000-8000-000000000003', 'dev+review3@matchtutor.test', 'Sophie Nguyen',
   4, 'Really patient and always came prepared with past papers. Only reason this is not a 5 is that the sessions sometimes ran a little over time.', 23),
  ('de000000-0000-4000-8000-000000000004', 'dev+review4@matchtutor.test', 'Liam Turner',
   5, 'Genuinely the reason I got the mark I did. Replies quickly between sessions and never made me feel stupid for asking the same thing twice.', 40),
  ('de000000-0000-4000-8000-000000000005', 'dev+review5@matchtutor.test', 'Isabella Rossi',
   3, null, 62);

-- >>> EDIT THIS LINE — the tutor these reviews are attached to <<<
select set_config('seed.tutor_name', 'Aarav Bhatt', false);

-- Fail loudly rather than silently seeding nothing. Note: aborting here poisons
-- the surrounding transaction, so the SQL Editor will report an error for every
-- statement after this one too ("current transaction is aborted"). Only the
-- FIRST error is meaningful, and nothing is written.
do $$
declare
  v_count int;
begin
  select count(*) into v_count
    from public.profiles p
    join public.tutor_profiles t on t.id = p.id
   where lower(btrim(p.full_name)) = lower(btrim(current_setting('seed.tutor_name')))
     and p.role = 'tutor';

  if v_count = 0 then
    raise exception
      'No tutor named "%" found. Check the name (select full_name from public.profiles where role = ''tutor'';) and edit the set_config line.',
      current_setting('seed.tutor_name');
  end if;

  if v_count > 1 then
    raise notice
      'WARNING: % tutors are named "%". Seeding the oldest one only.',
      v_count, current_setting('seed.tutor_name');
  end if;
end $$;

-- 1. The fake accounts -------------------------------------------------------
-- The on_auth_user_created trigger (0001, rewritten in 0041) fires on this
-- insert and creates each profiles row with role NULL — step 2 promotes them.
--
-- The empty strings are deliberate: GoTrue panics on NULL in these varchar
-- columns ("converting NULL to string is unsupported"), which would make the
-- accounts unusable for login.
--
-- If extensions.crypt errors, pgcrypto is not in the extensions schema on your
-- project — replace the whole crypt(...) call with any literal bcrypt hash
-- string (the accounts then exist but cannot be logged into, which is fine for
-- rendering reviews).
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, reauthentication_token
)
select
  '00000000-0000-0000-0000-000000000000',
  s.id,
  'authenticated',
  'authenticated',
  s.email,
  extensions.crypt('DevReview123!', extensions.gen_salt('bf')),
  now() - make_interval(days => s.age_days),
  now() - make_interval(days => s.age_days),
  now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  jsonb_build_object('full_name', s.full_name),
  '', '', '', '', '', ''
from _seed_reviewers s
on conflict (id) do nothing;

-- 2. Promote them to students ------------------------------------------------
-- The trigger created these rows with role NULL (a real user would pick at
-- /choose-role). terms_agreed_at is already stamped by the trigger.
update public.profiles p set
  role      = 'student',
  full_name = s.full_name
from _seed_reviewers s
where p.id = s.id;

insert into public.student_profiles (id)
select s.id from _seed_reviewers s
on conflict (id) do nothing;

-- 3. The reviews -------------------------------------------------------------
insert into public.reviews (tutor_id, student_id, rating, body, status, created_at, updated_at, approved_at)
select
  tutor.id,
  s.id,
  s.rating,
  s.body,
  'approved',
  now() - make_interval(days => s.age_days),
  now() - make_interval(days => s.age_days),
  now() - make_interval(days => s.age_days)
  from _seed_reviewers s
 cross join (
   select t.id
     from public.profiles p
     join public.tutor_profiles t on t.id = p.id
    where lower(btrim(p.full_name)) = lower(btrim(current_setting('seed.tutor_name')))
      and p.role = 'tutor'
    order by p.created_at
    limit 1
 ) tutor
on conflict (tutor_id, student_id) do nothing;

commit;

-- Sanity check — expect 5 reviews, and rating 4.4 / review_count 5 on the tutor
-- (populated by the 0057 trigger, not by this script).
select p.full_name as tutor, t.rating, t.review_count,
       (select count(*) from public.reviews r where r.tutor_id = t.id) as review_rows
  from public.profiles p
  join public.tutor_profiles t on t.id = p.id
 where lower(btrim(p.full_name)) = lower(btrim(current_setting('seed.tutor_name')))
   and p.role = 'tutor';

-- The seeded rows themselves. The temp table is gone after the commit, so this
-- keys off the auth email pattern instead.
select a.full_name as author, r.rating, r.status,
       coalesce(left(r.body, 48), '(no text)') as body, r.created_at::date as left_on
  from public.reviews r
  join public.profiles a on a.id = r.student_id
  join auth.users u      on u.id = r.student_id
 where u.email like 'dev+review%@matchtutor.test'
 order by r.created_at desc;

-- ============================================================================
-- TEARDOWN — uncomment and run to remove everything this script created.
-- Deleting the auth.users rows cascades to profiles -> student_profiles ->
-- reviews, and the 0057 trigger recalculates the tutor's aggregate back to
-- NULL / 0 as the review rows go.
-- ============================================================================
-- delete from auth.users where email like 'dev+review%@matchtutor.test';
--
-- -- Verify: expect 0, and rating NULL / review_count 0 on the tutor.
-- select count(*) as leftover_accounts from auth.users
--  where email like 'dev+review%@matchtutor.test';
