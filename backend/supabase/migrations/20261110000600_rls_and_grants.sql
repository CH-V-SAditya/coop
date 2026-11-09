-- =============================================================================
-- Coop · Migration 6 · Row Level Security, column privileges, activity triggers,
--                       realtime
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Activity triggers for comments / evidence -> task history
-- -----------------------------------------------------------------------------
create or replace function engine.task_comments_after_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_task public.tasks;
begin
  select * into v_task from public.tasks where id = new.task_id;
  perform engine.record_event(v_task, 'comment_added', 'user', null, null, null,
    jsonb_build_object('comment_id', new.id));
  return null;
end;
$$;

create trigger task_comments_after_insert
  after insert on public.task_comments
  for each row execute function engine.task_comments_after_insert();

create or replace function engine.task_evidence_after_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_task public.tasks;
begin
  select * into v_task from public.tasks where id = new.task_id;
  perform engine.record_event(v_task, 'evidence_added', 'user', null, null, null,
    jsonb_build_object('evidence_id', new.id, 'kind', new.kind, 'url', new.url));
  return null;
end;
$$;

create trigger task_evidence_after_insert
  after insert on public.task_evidence
  for each row execute function engine.task_evidence_after_insert();

-- -----------------------------------------------------------------------------
-- Enable RLS everywhere
-- -----------------------------------------------------------------------------
alter table public.profiles                 enable row level security;
alter table public.organisations            enable row level security;
alter table public.organisation_members     enable row level security;
alter table public.groups                   enable row level security;
alter table public.group_members            enable row level security;
alter table public.invitations              enable row level security;
alter table public.tasks                    enable row level security;
alter table public.task_status_transitions  enable row level security;
alter table public.task_dependencies        enable row level security;
alter table public.task_blockers            enable row level security;
alter table public.task_events              enable row level security;
alter table public.task_comments            enable row level security;
alter table public.task_evidence            enable row level security;
alter table public.group_messages           enable row level security;
alter table public.context_documents        enable row level security;
alter table public.ai_agents                enable row level security;
alter table public.ai_suggestions           enable row level security;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_org_with(id));

create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

revoke update on public.profiles from authenticated, anon;
grant update (full_name, avatar_url, job_title, bio, timezone) on public.profiles to authenticated;

-- -----------------------------------------------------------------------------
-- organisations (insert only via create_organisation())
-- -----------------------------------------------------------------------------
create policy organisations_select on public.organisations for select to authenticated
  using (public.is_org_member(id));

create policy organisations_update on public.organisations for update to authenticated
  using (public.is_org_admin(id)) with check (public.is_org_admin(id));

revoke update on public.organisations from authenticated, anon;
grant update (name, task_key_prefix) on public.organisations to authenticated;

-- -----------------------------------------------------------------------------
-- organisation_members (insert only via create_organisation() / accept_invitation())
-- -----------------------------------------------------------------------------
create policy org_members_select on public.organisation_members for select to authenticated
  using (public.is_org_member(organisation_id));

create policy org_members_update on public.organisation_members for update to authenticated
  using (public.is_org_admin(organisation_id)) with check (public.is_org_admin(organisation_id));

create policy org_members_delete on public.organisation_members for delete to authenticated
  using (public.is_org_admin(organisation_id) or user_id = auth.uid());

revoke update on public.organisation_members from authenticated, anon;
grant update (role, title) on public.organisation_members to authenticated;

-- -----------------------------------------------------------------------------
-- groups (insert only via create_group())
-- -----------------------------------------------------------------------------
create policy groups_select on public.groups for select to authenticated
  using (public.can_view_group(id));

create policy groups_update on public.groups for update to authenticated
  using (public.is_group_admin(id)) with check (public.is_group_admin(id));

create policy groups_delete on public.groups for delete to authenticated
  using (public.is_group_admin(id));

revoke update on public.groups from authenticated, anon;
grant update (name, description, goal, members_can_upload_context, archived_at) on public.groups to authenticated;

-- -----------------------------------------------------------------------------
-- group_members (insert only via create_group() / add_group_member() / accept_invitation())
-- -----------------------------------------------------------------------------
create policy group_members_select on public.group_members for select to authenticated
  using (public.can_view_group(group_id));

create policy group_members_update on public.group_members for update to authenticated
  using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));

create policy group_members_delete on public.group_members for delete to authenticated
  using (
    public.is_group_admin(group_id)
    or organisation_member_id = public.current_member_id(organisation_id)
  );

revoke update on public.group_members from authenticated, anon;
grant update (role, functional_role, role_source, can_create_tasks, can_schedule_tasks,
              can_assign_tasks, can_upload_context)
  on public.group_members to authenticated;

-- -----------------------------------------------------------------------------
-- invitations (insert only via create_invitation(); accept via accept_invitation())
-- -----------------------------------------------------------------------------
create policy invitations_select on public.invitations for select to authenticated
  using (
    public.is_org_admin(organisation_id)
    or (group_id is not null and public.is_group_admin(group_id))
    or invited_by = auth.uid()
  );

create policy invitations_update on public.invitations for update to authenticated
  using (
    public.is_org_admin(organisation_id)
    or (group_id is not null and public.is_group_admin(group_id))
    or invited_by = auth.uid()
  )
  with check (status in ('pending', 'revoked'));

revoke update on public.invitations from authenticated, anon;
grant update (status) on public.invitations to authenticated;

-- -----------------------------------------------------------------------------
-- tasks
--   Lifecycle columns (status, timestamps, version, intelligence) are NOT
--   writable by clients: status changes go through transition_task().
-- -----------------------------------------------------------------------------
create policy tasks_select on public.tasks for select to authenticated
  using (public.can_view_group(group_id));

create policy tasks_insert on public.tasks for insert to authenticated
  with check (
    public.has_group_permission(group_id, 'can_create_tasks')
    and (
      owner_id is null
      or owner_id = public.current_member_id(organisation_id)
      or public.has_group_permission(group_id, 'can_assign_tasks')
    )
  );

create policy tasks_update on public.tasks for update to authenticated
  using (public.can_edit_task(id))
  with check (public.can_view_group(group_id));

create policy tasks_delete on public.tasks for delete to authenticated
  using (public.is_group_admin(group_id) and status in ('draft', 'cancelled'));

revoke insert, update on public.tasks from authenticated, anon;
grant insert (organisation_id, group_id, parent_task_id, title, description, acceptance_criteria,
              owner_id, reviewer_id, priority, start_date, due_date, estimate_hours)
  on public.tasks to authenticated;
grant update (title, description, acceptance_criteria, owner_id, reviewer_id, progress, priority,
              start_date, due_date, estimate_hours, parent_task_id)
  on public.tasks to authenticated;

-- -----------------------------------------------------------------------------
-- task_status_transitions (read-only reference data)
-- -----------------------------------------------------------------------------
create policy transitions_select on public.task_status_transitions for select to authenticated
  using (true);
revoke insert, update, delete on public.task_status_transitions from authenticated, anon;

-- -----------------------------------------------------------------------------
-- task_dependencies / task_blockers / task_events: read-only for clients;
-- written exclusively by engine functions.
-- -----------------------------------------------------------------------------
create policy task_dependencies_select on public.task_dependencies for select to authenticated
  using (public.can_view_task(successor_id));

create policy task_blockers_select on public.task_blockers for select to authenticated
  using (public.can_view_task(task_id));

create policy task_events_select on public.task_events for select to authenticated
  using (public.can_view_task(task_id));

revoke insert, update, delete on public.task_dependencies from authenticated, anon;
revoke insert, update, delete on public.task_blockers     from authenticated, anon;
revoke insert, update, delete on public.task_events       from authenticated, anon;

-- -----------------------------------------------------------------------------
-- task_comments
-- -----------------------------------------------------------------------------
create policy task_comments_select on public.task_comments for select to authenticated
  using (public.can_view_task(task_id));

create policy task_comments_insert on public.task_comments for insert to authenticated
  with check (author_id = auth.uid() and public.can_view_task(task_id));

create policy task_comments_update on public.task_comments for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());

create policy task_comments_delete on public.task_comments for delete to authenticated
  using (author_id = auth.uid());

revoke update on public.task_comments from authenticated, anon;
grant update (body, edited_at) on public.task_comments to authenticated;

-- -----------------------------------------------------------------------------
-- task_evidence
-- -----------------------------------------------------------------------------
create policy task_evidence_select on public.task_evidence for select to authenticated
  using (public.can_view_task(task_id));

create policy task_evidence_insert on public.task_evidence for insert to authenticated
  with check (submitted_by = auth.uid() and public.can_edit_task(task_id));

create policy task_evidence_delete on public.task_evidence for delete to authenticated
  using (submitted_by = auth.uid());

revoke update on public.task_evidence from authenticated, anon;

-- -----------------------------------------------------------------------------
-- group_messages
-- -----------------------------------------------------------------------------
create policy group_messages_select on public.group_messages for select to authenticated
  using (public.can_view_group(group_id));

create policy group_messages_insert on public.group_messages for insert to authenticated
  with check (author_id = auth.uid() and public.can_view_group(group_id));

create policy group_messages_update on public.group_messages for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());

create policy group_messages_delete on public.group_messages for delete to authenticated
  using (author_id = auth.uid() or public.is_group_admin(group_id));

revoke update on public.group_messages from authenticated, anon;
grant update (body, edited_at) on public.group_messages to authenticated;

-- -----------------------------------------------------------------------------
-- context_documents (group admin only unless permission granted)
-- -----------------------------------------------------------------------------
create policy context_documents_select on public.context_documents for select to authenticated
  using (public.can_view_group(group_id));

create policy context_documents_insert on public.context_documents for insert to authenticated
  with check (uploaded_by = auth.uid() and public.has_group_permission(group_id, 'can_upload_context'));

create policy context_documents_delete on public.context_documents for delete to authenticated
  using (uploaded_by = auth.uid() or public.is_group_admin(group_id));

revoke update on public.context_documents from authenticated, anon;
grant update (title, description) on public.context_documents to authenticated;

create policy context_documents_update on public.context_documents for update to authenticated
  using (uploaded_by = auth.uid() or public.is_group_admin(group_id))
  with check (uploaded_by = auth.uid() or public.is_group_admin(group_id));

-- -----------------------------------------------------------------------------
-- ai_agents (bring your own agent)
-- -----------------------------------------------------------------------------
create policy ai_agents_select on public.ai_agents for select to authenticated
  using (
    owner_id = auth.uid()
    or (scope = 'group' and public.can_view_group(group_id))
    or (scope = 'organisation' and public.is_org_member(organisation_id))
  );

create policy ai_agents_insert on public.ai_agents for insert to authenticated
  with check (
    owner_id = auth.uid()
    and public.is_org_member(organisation_id)
    and (
      scope = 'personal'
      or (scope = 'group' and public.is_group_admin(group_id))
      or (scope = 'organisation' and public.is_org_admin(organisation_id))
    )
  );

create policy ai_agents_update on public.ai_agents for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy ai_agents_delete on public.ai_agents for delete to authenticated
  using (owner_id = auth.uid());

-- -----------------------------------------------------------------------------
-- ai_suggestions (written by the server-side AI layer with the service role;
-- humans review them)
-- -----------------------------------------------------------------------------
create policy ai_suggestions_select on public.ai_suggestions for select to authenticated
  using (
    (group_id is not null and public.can_view_group(group_id))
    or (group_id is null and public.is_org_admin(organisation_id))
  );

create policy ai_suggestions_update on public.ai_suggestions for update to authenticated
  using (
    (group_id is not null and public.is_group_admin(group_id))
    or public.is_org_admin(organisation_id)
  )
  with check (status in ('accepted', 'rejected'));

revoke insert, delete, update on public.ai_suggestions from authenticated, anon;
grant update (status, reviewed_by, reviewed_at) on public.ai_suggestions to authenticated;

-- -----------------------------------------------------------------------------
-- Function privileges: nothing is callable anonymously.
-- -----------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on all functions in schema engine from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Realtime (live board, history, blockers, discussions)
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.tasks, public.task_events, public.task_blockers,
      public.task_comments, public.group_messages;
  end if;
end;
$$;
