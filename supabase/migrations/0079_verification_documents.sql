-- ============================================================================
-- 0079_verification_documents: private supporting documents on a verification
-- request (additive; deploy 0079, then the app).
-- ----------------------------------------------------------------------------
-- A tutor may attach files only admins can read. The files live while the tutor
-- is unverified: a rejected or withdrawn request keeps them for the next one,
-- and they are locked while a request is under review. Reaching `verified` by
-- ANY path flags them for deletion.
--
-- Storage files cannot be deleted from SQL (storage.protect_delete), so deletion
-- is two steps. The trigger below flags the rows in the same transaction as the
-- status change; the route then removes the files and deletes the rows
-- (lib/admin/verificationDocs.js). A flagged row that outlives the route is what
-- the admin's "Files still stored" Retry works from.
--
-- These files are deliberately NOT part of _tutor_snapshot: they cannot change
-- while a request is pending, so they can never trigger the 0072 withdrawal.
-- ============================================================================

-- 1. Bucket -------------------------------------------------------------------
-- An explicit type list, not image/*: an SVG can carry script and admins open
-- these files. Mirrored by INVITE_DOC_TYPES in lib/supabase/storage.js.
-- NO client policies: uploads use signed URLs from /api/verification/documents
-- and every read is a signed URL made with the service role.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('verification-documents', 'verification-documents', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = false,
      file_size_limit = 10485760,
      allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- 2. Table --------------------------------------------------------------------
create table if not exists public.tutor_verification_documents (
  id                 uuid primary key default gen_random_uuid(),
  tutor_id           uuid not null references public.tutor_profiles (id) on delete cascade,
  storage_path       text not null unique,
  file_name          text not null,
  uploaded_at        timestamptz not null default now(),
  purge_requested_at timestamptz,
  constraint tutor_verification_documents_own_folder
    check (split_part(storage_path, '/', 1) = tutor_id::text)
);

create index if not exists tutor_verification_documents_tutor_idx
  on public.tutor_verification_documents (tutor_id, uploaded_at);

alter table public.tutor_verification_documents enable row level security;

-- RLS is on with NO policies: every read and write is one of the RPCs below.

-- 3. Tutor RPCs ---------------------------------------------------------------
-- The shared gate. Takes the tutor row lock, so an add or remove cannot
-- interleave with a request or a decision on the same tutor.
create or replace function public._lock_verification_docs_editable(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status  text;
  v_managed timestamptz;
  v_partner uuid;
  v_account text;
begin
  if p_id is null then
    raise exception 'Not authenticated.' using errcode = '42501';
  end if;

  select t.verification_status, t.managed_at, t.partner_id, p.status
    into v_status, v_managed, v_partner, v_account
    from public.tutor_profiles t join public.profiles p on p.id = t.id
   where t.id = p_id
   for update of t;

  if not found then
    raise exception 'No tutor profile.' using errcode = '22023';
  end if;
  if v_account <> 'enabled' then
    raise exception 'Your account is disabled.' using errcode = '22023';
  end if;
  if v_managed is not null or v_partner is not null then
    raise exception 'This profile is managed, so documents can''t be changed here.' using errcode = '22023';
  end if;
  if v_status = 'pending' then
    raise exception 'Your documents are locked while your request is under review.' using errcode = '22023';
  end if;
  if v_status <> 'none' and v_status <> 'rejected' then
    raise exception 'You are already verified.' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public._lock_verification_docs_editable(uuid) from public, anon, authenticated;

-- Register a file already uploaded through a signed URL.
create or replace function public.add_verification_document(p_path text, p_file_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id   uuid := auth.uid();
  v_name text;
  v_doc  uuid;
begin
  perform public._lock_verification_docs_editable(v_id);

  if p_path is null or p_path !~ ('^' || v_id::text || '/[^/]+$')
     or not exists (select 1 from storage.objects
                     where bucket_id = 'verification-documents' and name = p_path) then
    raise exception 'That file has not finished uploading.' using errcode = '22023';
  end if;

  if (select count(*) from public.tutor_verification_documents where tutor_id = v_id) >= 10 then
    raise exception 'You can attach up to 10 documents.' using errcode = '22023';
  end if;

  v_name := left(btrim(regexp_replace(coalesce(p_file_name, ''), '[[:cntrl:]]', '', 'g')), 200);
  if v_name = '' then
    v_name := 'Document';
  end if;

  insert into public.tutor_verification_documents (tutor_id, storage_path, file_name)
  values (v_id, p_path, v_name)
  returning id into v_doc;

  return v_doc;
end;
$$;

-- Delete a row and return its path, so the route removes exactly that file.
create or replace function public.remove_verification_document(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id   uuid := auth.uid();
  v_path text;
begin
  perform public._lock_verification_docs_editable(v_id);

  delete from public.tutor_verification_documents
   where id = p_id and tutor_id = v_id
  returning storage_path into v_path;

  if v_path is null then
    raise exception 'Document not found.' using errcode = 'P0002';
  end if;
  return v_path;
end;
$$;

-- The caller's own files. A flagged row is on its way out, so it is not listed.
create or replace function public.list_my_verification_documents()
returns table (id uuid, storage_path text, file_name text, uploaded_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select d.id, d.storage_path, d.file_name, d.uploaded_at
    from public.tutor_verification_documents d
   where d.tutor_id = auth.uid() and d.purge_requested_at is null
   order by d.uploaded_at, d.id;
$$;

revoke all     on function public.add_verification_document(text, text) from public, anon;
revoke all     on function public.remove_verification_document(uuid)    from public, anon;
revoke all     on function public.list_my_verification_documents()      from public, anon;
grant  execute on function public.add_verification_document(text, text) to authenticated;
grant  execute on function public.remove_verification_document(uuid)    to authenticated;
grant  execute on function public.list_my_verification_documents()      to authenticated;

-- 4. Service-role RPCs --------------------------------------------------------
-- Every row of a tutor, flagged ones included, for the admin pages and the purge.
create or replace function public.list_tutor_verification_documents(p_tutor_id uuid)
returns table (id uuid, storage_path text, file_name text, uploaded_at timestamptz, purge_requested_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select d.id, d.storage_path, d.file_name, d.uploaded_at, d.purge_requested_at
    from public.tutor_verification_documents d
   where d.tutor_id = p_tutor_id
   order by d.uploaded_at, d.id;
$$;

-- Called once the files are confirmed gone. The flag check means this can never
-- delete the row of a file still attached to a request.
create or replace function public.delete_flagged_verification_documents(p_tutor_id uuid, p_ids uuid[])
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.tutor_verification_documents d
   where d.tutor_id = p_tutor_id
     and d.id = any (p_ids)
     and d.purge_requested_at is not null;
$$;

revoke all     on function public.list_tutor_verification_documents(uuid)             from public, anon, authenticated;
revoke all     on function public.delete_flagged_verification_documents(uuid, uuid[]) from public, anon, authenticated;
grant  execute on function public.list_tutor_verification_documents(uuid)             to service_role;
grant  execute on function public.delete_flagged_verification_documents(uuid, uuid[]) to service_role;

-- 5. Reaching verified flags the files ----------------------------------------
-- A trigger rather than a line in each RPC: admin_decide_verification,
-- admin_set_tutor_verification and the SQL utilities all set this column, and
-- "verified always removes the private files" must hold for each of them.
create or replace function public.tutor_profiles_flag_verification_docs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tutor_verification_documents
     set purge_requested_at = now()
   where tutor_id = new.id and purge_requested_at is null;
  return null;
end;
$$;

revoke all on function public.tutor_profiles_flag_verification_docs() from public, anon, authenticated;

drop trigger if exists tutor_profiles_flag_verification_docs on public.tutor_profiles;
create trigger tutor_profiles_flag_verification_docs
  after update of verification_status on public.tutor_profiles
  for each row
  when (new.verification_status = 'verified' and old.verification_status is distinct from 'verified')
  execute function public.tutor_profiles_flag_verification_docs();
