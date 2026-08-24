-- ============================================================================
-- tutormatch — BACKFILL tutor_profiles.city (the tutor's STATE) FROM SUBJECTS
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   1. Supabase Studio -> SQL Editor.
--   2. Run STEP 1 ON ITS OWN first. It writes nothing and shows you exactly
--      which tutors would change and why. Check the counts before going on.
--   3. Only then run STEP 2 (the write), followed by STEP 3 (sanity check).
--
-- WHAT IT DOES:
--   tutor_profiles.city holds the tutor's STATE CODE ('NSW', 'VIC', ...), not a
--   city. It is normally written by the suburb picker in the settings editor
--   (components/profile-edit/sections.js -> onPick), which sets suburb, city and
--   the service_lat/lng coordinates together. A tutor who never picked a base
--   suburb therefore has a blank city, and is invisible to the /browse State
--   filter (?state=, see lib/supabase/tutors.js -> getTutorsForBrowse).
--
--   This fills a BLANK city by inferring the state from the exam system a
--   tutor's subjects belong to: someone teaching HSC subjects is taken to be
--   in NSW, VCE in VIC, and so on.
--
--   It fires ONLY when the tutor's subjects imply exactly ONE state. Teaching
--   both HSC and VCE resolves to nothing (reported as AMBIGUOUS) rather than
--   picking a side.
--
--   It NEVER overwrites a city a tutor set themselves — the guard is
--   `city is null or btrim(city) = ''` in both the preview and the update, so
--   the two cannot disagree. Re-running is a no-op: the rows it filled are no
--   longer blank. Safe to run as many times as you like.
--
-- WHY NOT FROM service_lat/service_lng:
--   Because it would match zero rows. Every tutor with a blank city also has no
--   coordinates — the picker writes both in the same action, so "no state" and
--   "no coords" are the same event. Subjects are the only signal available.
--
-- ACCURACY — THIS IS A HEURISTIC, NOT A FACT:
--   An online tutor living in VIC can perfectly well teach HSC. The inference
--   was checked against every tutor whose state IS known (see the commented
--   block at the bottom of STEP 1): 48 agreed, 0 disagreed, 0 were ambiguous.
--   Re-run that check before writing. A single disagreement means the heuristic
--   no longer holds for this data and the mapping needs revisiting.
--
-- USER-VISIBLE SIDE EFFECT:
--   city is public. A backfilled tutor's card, which currently shows no
--   location, starts showing the bare state (components/TutorCard.js joins
--   [suburb, city], so a blank suburb renders "NSW" on its own). That is the
--   point — it makes them findable — but it is a change to a profile the tutor
--   did not edit. Their own suburb pick overwrites it at any time.
--
--   Requires the subject catalog from 0009/0010 (exams + subjects.exam_code).
-- ============================================================================


-- ============================================================================
-- STEP 1 — DRY RUN. Writes nothing. Run this alone and read the `source`
--          column: 'subjects' rows are the ones STEP 2 will change.
-- ============================================================================

with exam_state (exam_code, state_code) as (
  -- Keyed on exams.code (a stable primary key) rather than the prose in
  -- exams.jurisdiction ('New South Wales'), which says the same thing but would
  -- break silently if anyone reworded it. The two agree today.
  values ('HSC',  'NSW'),
         ('VCE',  'VIC'),
         ('QCE',  'QLD'),
         ('WACE', 'WA'),
         ('TCE',  'TAS'),
         ('ACT',  'ACT'),
         -- The Northern Territory sits under SACE too (the NTCET is SACE-based),
         -- so this one is a population call rather than a certainty.
         ('SACE', 'SA')
         -- IB, GENERAL and TEST are deliberately absent: they are taught in
         -- every state and imply nothing about where the tutor lives.
),
target as (
  select t.id
    from public.tutor_profiles t
   where t.city is null or btrim(t.city) = ''
),
inferred as (
  select tg.id,
         array_agg(distinct s.exam_code  order by s.exam_code)  filter (where s.exam_code  is not null) as exam_codes,
         array_agg(distinct es.state_code order by es.state_code) filter (where es.state_code is not null) as states
    from target tg
    left join public.tutor_subjects ts on ts.tutor_id  = tg.id
    left join public.subjects       s  on s.id         = ts.subject_id
    left join exam_state            es on es.exam_code = s.exam_code
   group by tg.id
),
resolved as (
  select i.id,
         i.exam_codes,
         case when coalesce(array_length(i.states, 1), 0) = 1 then i.states[1] end as proposed_city,
         case
           when coalesce(array_length(i.states, 1), 0) = 1 then 'subjects'
           when coalesce(array_length(i.states, 1), 0) > 1 then 'AMBIGUOUS'
           when coalesce(array_length(i.exam_codes, 1), 0) > 0 then 'NO_SIGNAL'
           else 'NO_SUBJECTS'
         end as source
    from inferred i
)
select r.source,
       r.proposed_city,
       p.full_name,
       r.exam_codes,
       r.id
  from resolved r
  join public.profiles p on p.id = r.id
 order by (r.source <> 'subjects'),  -- the rows that will actually change, first
          r.source,
          p.full_name;

-- Expected on the data this was written against (2026-08-24):
--   13 x source='subjects'   (all proposed_city='NSW')
--    1 x source='NO_SIGNAL'  (teaches only GENERAL / TEST / IB)
--   19 x source='NO_SUBJECTS'
--    0 x source='AMBIGUOUS'
-- If the shape has moved a lot since, re-run the accuracy check below first.

-- ---------------------------------------------------------------------------
-- ACCURACY CHECK (optional but recommended before STEP 2). Uncomment and run.
-- Applies the same rule to tutors whose state we ALREADY know and scores it.
-- Expect agree=48, disagree=0. Any disagreement means: do not run STEP 2.
-- ---------------------------------------------------------------------------
-- with exam_state (exam_code, state_code) as (
--   values ('HSC','NSW'), ('VCE','VIC'), ('QCE','QLD'), ('WACE','WA'),
--          ('TCE','TAS'), ('ACT','ACT'), ('SACE','SA')
-- ),
-- known as (
--   select t.id, btrim(t.city) as city
--     from public.tutor_profiles t
--    where coalesce(btrim(t.city), '') <> ''
-- ),
-- scored as (
--   select k.id, k.city,
--          array_agg(distinct es.state_code order by es.state_code)
--            filter (where es.state_code is not null) as states
--     from known k
--     left join public.tutor_subjects ts on ts.tutor_id  = k.id
--     left join public.subjects       s  on s.id         = ts.subject_id
--     left join exam_state            es on es.exam_code = s.exam_code
--    group by k.id, k.city
-- )
-- select count(*) filter (where array_length(states,1) = 1 and states[1] =  city) as agree,
--        count(*) filter (where array_length(states,1) = 1 and states[1] <> city) as disagree,
--        count(*) filter (where array_length(states,1) > 1)                       as ambiguous,
--        count(*) filter (where states is null)                                   as no_signal
--   from scored;


-- ============================================================================
-- STEP 2 — THE WRITE. Same CTE as STEP 1, so what you previewed is what runs.
-- ============================================================================

begin;

with exam_state (exam_code, state_code) as (
  values ('HSC',  'NSW'),
         ('VCE',  'VIC'),
         ('QCE',  'QLD'),
         ('WACE', 'WA'),
         ('TCE',  'TAS'),
         ('ACT',  'ACT'),
         ('SACE', 'SA')
),
target as (
  select t.id
    from public.tutor_profiles t
   where t.city is null or btrim(t.city) = ''
),
inferred as (
  select tg.id,
         array_agg(distinct es.state_code order by es.state_code) filter (where es.state_code is not null) as states
    from target tg
    left join public.tutor_subjects ts on ts.tutor_id  = tg.id
    left join public.subjects       s  on s.id         = ts.subject_id
    left join exam_state            es on es.exam_code = s.exam_code
   group by tg.id
),
resolved as (
  select i.id, i.states[1] as proposed_city
    from inferred i
   where coalesce(array_length(i.states, 1), 0) = 1   -- exactly one state, or nothing
)
update public.tutor_profiles t
   set city = r.proposed_city
  from resolved r
 where t.id = r.id
   -- Belt and braces: `target` already restricted this, but state the invariant
   -- where the write happens so it can never be lost in a future edit.
   and (t.city is null or btrim(t.city) = '');

commit;


-- ============================================================================
-- STEP 3 — SANITY CHECK. The state spread across every tutor, after the write.
-- ============================================================================

select coalesce(nullif(btrim(t.city), ''), '(blank)') as state,
       count(*) as tutors
  from public.tutor_profiles t
 group by 1
 order by tutors desc, state;

-- Expected move on the data this was written against (all 88 tutor_profiles
-- rows, not just the public ones):
--   before  (blank) 33 | NSW 45 | VIC 9 | ACT 1
--   after   (blank) 20 | NSW 58 | VIC 9 | ACT 1


-- ============================================================================
-- STEP 4 (optional) — WHAT IS LEFT. Tutors with no location AND no subjects:
--   nothing can infer these. This is the list to email a "set your base suburb"
--   nudge to. Uncomment to run.
-- ============================================================================

-- select p.full_name, u.email, t.id
--   from public.tutor_profiles t
--   join public.profiles p on p.id = t.id
--   join auth.users     u on u.id = t.id
--  where (t.city is null or btrim(t.city) = '')
--    and not exists (select 1 from public.tutor_subjects ts where ts.tutor_id = t.id)
--  order by p.full_name;
