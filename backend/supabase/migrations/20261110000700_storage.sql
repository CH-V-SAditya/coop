-- =============================================================================
-- Coop · Migration 7 · Storage for context documents
--   Object path convention: <group_id>/<uuid>-<filename>
-- =============================================================================

create or replace function public.try_uuid(p_value text)
returns uuid
language plpgsql immutable set search_path = ''
as $$
begin
  return p_value::uuid;
exception when others then
  return null;
end;
$$;

grant execute on function public.try_uuid(text) to authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit)
values ('context-documents', 'context-documents', false, 20971520)   -- 20 MB
on conflict (id) do nothing;

create policy context_docs_storage_select on storage.objects for select to authenticated
  using (
    bucket_id = 'context-documents'
    and public.can_view_group(public.try_uuid((storage.foldername(name))[1]))
  );

create policy context_docs_storage_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'context-documents'
    and public.has_group_permission(public.try_uuid((storage.foldername(name))[1]), 'can_upload_context')
  );

create policy context_docs_storage_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'context-documents'
    and (owner = auth.uid() or public.is_group_admin(public.try_uuid((storage.foldername(name))[1])))
  );
