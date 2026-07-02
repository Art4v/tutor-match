-- 0032_melbourne_schools.sql
-- matchtutor — slice 32: add the top 50 Melbourne schools to the schools
-- catalog, after the NSW 50 seeded in 0026.
--
-- Ranking basis: 2025 VCE results (median study score / % of 40+ scores),
-- Melbourne metro only (which is why e.g. Ballarat Clarendon College — often
-- Victoria's #1 — is absent). Like the 0026 seed this is point-in-time;
-- re-seed with a later additive migration if the rankings change.
--
-- position continues the global order: NSW = 1–50, Melbourne = 51–100.
-- Idempotent: safe to re-run.

insert into public.schools (name, slug, position) values
  ('Mac.Robertson Girls'' High School','mac-robertson-girls-high-school',51),
  ('Melbourne High School','melbourne-high-school',52),
  ('Bialik College','bialik-college',53),
  ('Huntingtower School','huntingtower-school',54),
  ('Nossal High School','nossal-high-school',55),
  ('Presbyterian Ladies'' College Melbourne','presbyterian-ladies-college-melbourne',56),
  ('Suzanne Cory High School','suzanne-cory-high-school',57),
  ('Scotch College','scotch-college',58),
  ('Korowa Anglican Girls'' School','korowa-anglican-girls-school',59),
  ('Fintona Girls'' School','fintona-girls-school',60),
  ('Camberwell Grammar School','camberwell-grammar-school',61),
  ('Ruyton Girls'' School','ruyton-girls-school',62),
  ('Melbourne Grammar School','melbourne-grammar-school',63),
  ('St Kevin''s College','st-kevins-college',64),
  ('Lauriston Girls'' School','lauriston-girls-school',65),
  ('Mount Scopus Memorial College','mount-scopus-memorial-college',66),
  ('Trinity Grammar School Kew','trinity-grammar-school-kew',67),
  ('Haileybury College','haileybury-college',68),
  ('Camberwell Girls Grammar School','camberwell-girls-grammar-school',69),
  ('Methodist Ladies'' College','methodist-ladies-college',70),
  ('Penleigh and Essendon Grammar School','penleigh-and-essendon-grammar-school',71),
  ('Shelford Girls'' Grammar','shelford-girls-grammar',72),
  ('Leibler Yavneh College','leibler-yavneh-college',73),
  ('St Michael''s Grammar School','st-michaels-grammar-school',74),
  ('Sacré Cœur Glen Iris','sacre-coeur-glen-iris',75),
  ('Loreto Mandeville Hall Toorak','loreto-mandeville-hall-toorak',76),
  ('Genazzano FCJ College','genazzano-fcj-college',77),
  ('Strathcona Girls Grammar','strathcona-girls-grammar',78),
  ('Ivanhoe Girls'' Grammar School','ivanhoe-girls-grammar-school',79),
  ('Brighton Grammar School','brighton-grammar-school',80),
  ('Firbank Grammar School','firbank-grammar-school',81),
  ('St Catherine''s School Toorak','st-catherines-school-toorak',82),
  ('Carey Baptist Grammar School','carey-baptist-grammar-school',83),
  ('Wesley College','wesley-college',84),
  ('Caulfield Grammar School','caulfield-grammar-school',85),
  ('Xavier College','xavier-college',86),
  ('St Leonard''s College','st-leonards-college',87),
  ('Kilvington Grammar School','kilvington-grammar-school',88),
  ('Mentone Grammar','mentone-grammar',89),
  ('Ivanhoe Grammar School','ivanhoe-grammar-school',90),
  ('Westbourne Grammar School','westbourne-grammar-school',91),
  ('Waverley Christian College','waverley-christian-college',92),
  ('McKinnon Secondary College','mckinnon-secondary-college',93),
  ('Balwyn High School','balwyn-high-school',94),
  ('Glen Waverley Secondary College','glen-waverley-secondary-college',95),
  ('John Monash Science School','john-monash-science-school',96),
  ('Box Hill High School','box-hill-high-school',97),
  ('University High School','university-high-school',98),
  ('East Doncaster Secondary College','east-doncaster-secondary-college',99),
  ('Mount Waverley Secondary College','mount-waverley-secondary-college',100)
on conflict (slug) do nothing;

-- Same best-effort backfill as 0026: link existing free-text high-school
-- entries to the newly listed schools (case-insensitive, trimmed exact match).
-- Only touches rows with no school_id yet, so it is safe to re-run.
update public.tutor_education te
set school_id = s.id
from public.schools s
where te.school_id is null
  and te.level = 'high_school'
  and lower(btrim(te.school)) = lower(s.name);
