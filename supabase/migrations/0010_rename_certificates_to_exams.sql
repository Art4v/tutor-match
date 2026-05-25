-- 0010_rename_certificates_to_exams.sql
-- Renames the `certificates` concept introduced in 0009 to `exams` (the same
-- rows: HSC, VCE, IB, QCE, SACE, WACE, TCE, ACT + the TEST group). Pure rename —
-- no data is touched. The FK constraint and the (certificate_code, position)
-- index follow the renames automatically; their auto-generated names keep the
-- old "certificate" spelling, which is cosmetic and safe to leave.

alter table public.certificates rename to exams;
alter table public.subjects rename column certificate_code to exam_code;

-- Keep the RLS policy name in step with the table.
alter policy "certificates public read" on public.exams rename to "exams public read";
