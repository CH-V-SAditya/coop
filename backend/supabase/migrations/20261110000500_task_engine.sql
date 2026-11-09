-- =============================================================================
-- Coop · Migration 5 · Task engine
--   Postgres is authoritative. Every mutation that matters goes through these
--   functions, runs atomically, and writes an immutable task_event.
--   Internal helpers live in the non-exposed "engine" schema.
-- =============================================================================

create schema if not exists engine;
revoke all on schema engine from public;

-- =============================================================================
-- 1. Authorisation helpers (SECURITY DEFINER to avoid RLS recursion)
-- =============================================================================

create or replace function public.current_member_id(p_org uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select id from public.organisation_members
  where organisation_id = p_org and user_id = auth.uid();
$$;

create or replace function public.is_org_member(p_org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.organisation_members
    where organisation_id = p_org and user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(p_org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.organisation_members
    where organisation_id = p_org and user_id = auth.uid() and role in ('owner', 'admin')
  );
$$;

create or replace function public.shares_org_with(p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.organisation_members a
    join public.organisation_members b on b.organisation_id = a.organisation_id
    where a.user_id = auth.uid() and b.user_id = p_user
  );
$$;

create or replace function public.is_group_member(p_group uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members gm
    join public.organisation_members om on om.id = gm.organisation_member_id
    where gm.group_id = p_group and om.user_id = auth.uid()
  );
$$;

-- Group admin, or an owner/admin of the group's organisation.
create or replace function public.is_group_admin(p_group uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members gm
    join public.organisation_members om on om.id = gm.organisation_member_id
    where gm.group_id = p_group and om.user_id = auth.uid() and gm.role = 'admin'
  ) or exists (
    select 1
    from public.groups g
    join public.organisation_members om on om.organisation_id = g.organisation_id
    where g.id = p_group and om.user_id = auth.uid() and om.role in ('owner', 'admin')
  );
$$;

-- Groups are visible to their members and to organisation owners/admins.
create or replace function public.can_view_group(p_group uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_group_member(p_group) or public.is_group_admin(p_group);
$$;

-- p_permission: can_create_tasks | can_schedule_tasks | can_assign_tasks | can_upload_context
create or replace function public.has_group_permission(p_group uuid, p_permission text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_group_admin(p_group) or exists (
    select 1
    from public.group_members gm
    join public.organisation_members om on om.id = gm.organisation_member_id
    where gm.group_id = p_group
      and om.user_id = auth.uid()
      and case p_permission
            when 'can_create_tasks'   then gm.can_create_tasks
            when 'can_schedule_tasks' then gm.can_schedule_tasks
            when 'can_assign_tasks'   then gm.can_assign_tasks
            when 'can_upload_context' then gm.can_upload_context
              or exists (select 1 from public.groups g where g.id = p_group and g.members_can_upload_context)
            else false
          end
  );
$$;

create or replace function public.can_view_task(p_task uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.tasks t where t.id = p_task and public.can_view_group(t.group_id)
  );
$$;

-- Owner, creator, group admin, or a member allowed to schedule tasks.
create or replace function public.can_edit_task(p_task uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = p_task
      and (
        public.is_group_admin(t.group_id)
        or t.created_by = auth.uid()
        or t.owner_id = public.current_member_id(t.organisation_id)
        or public.has_group_permission(t.group_id, 'can_schedule_tasks')
      )
  );
$$;

-- =============================================================================
-- 2. Derived task facts
-- =============================================================================

-- Number of finish-to-start predecessors that are not completed.
-- > 0 means the task is "waiting" and cannot become ready / start.
create or replace function public.unmet_dependency_count(p_task uuid)
returns integer
language sql stable security definer set search_path = ''
as $$
  select count(*)::int
  from public.task_dependencies d
  join public.tasks p on p.id = d.predecessor_id
  where d.successor_id = p_task
    and d.dependency_type = 'finish_to_start'
    and p.status <> 'completed';
$$;

create or replace function public.confirmed_blocker_count(p_task uuid)
returns integer
language sql stable security definer set search_path = ''
as $$
  select count(*)::int from public.task_blockers
  where task_id = p_task and status = 'confirmed';
$$;

-- Would adding predecessor -> successor create a cycle?
-- True if predecessor is already reachable from successor by following edges.
create or replace function engine.would_create_cycle(p_predecessor uuid, p_successor uuid)
returns boolean
language sql stable set search_path = ''
as $$
  with recursive reachable (task_id) as (
    select d.successor_id from public.task_dependencies d where d.predecessor_id = p_successor
    union
    select d.successor_id
    from public.task_dependencies d
    join reachable r on d.predecessor_id = r.task_id
  )
  select p_predecessor = p_successor
      or exists (select 1 from reachable where task_id = p_predecessor);
$$;

-- =============================================================================
-- 3. Event recording
-- =============================================================================

create or replace function engine.record_event(
  p_task        public.tasks,
  p_event_type  text,
  p_actor_kind  public.actor_kind default 'user',
  p_from        public.task_status default null,
  p_to          public.task_status default null,
  p_reason      text default null,
  p_payload     jsonb default '{}'::jsonb
)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_id bigint;
begin
  insert into public.task_events
    (organisation_id, task_id, event_type, actor_id, actor_kind, from_status, to_status, reason, payload)
  values
    (p_task.organisation_id, p_task.id, p_event_type,
     case when p_actor_kind = 'user' then auth.uid() else null end,
     p_actor_kind, p_from, p_to, nullif(trim(p_reason), ''), coalesce(p_payload, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

-- =============================================================================
-- 4. Task triggers (integrity + automatic history)
-- =============================================================================

create or replace function engine.assert_group_member(p_group uuid, p_member uuid, p_label text)
returns void
language plpgsql stable set search_path = ''
as $$
begin
  if p_member is not null and not exists (
    select 1 from public.group_members
    where group_id = p_group and organisation_member_id = p_member
  ) then
    raise exception 'The % must be a member of this group', p_label using errcode = '23514';
  end if;
end;
$$;

create or replace function engine.tasks_before_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  -- Human-readable, per-organisation task number
  update public.organisations
     set next_task_number = next_task_number + 1
   where id = new.organisation_id
  returning next_task_number - 1 into new.task_number;

  -- Every task is born a draft; lifecycle fields belong to the engine
  new.status            := 'draft';
  new.status_changed_at := now();
  new.started_at        := null;
  new.submitted_at      := null;
  new.completed_at      := null;
  new.cancelled_at      := null;
  new.version           := 1;
  new.created_by        := coalesce(auth.uid(), new.created_by);

  if new.parent_task_id is not null and not exists (
    select 1 from public.tasks p where p.id = new.parent_task_id and p.group_id = new.group_id
  ) then
    raise exception 'A subtask must belong to the same group as its parent' using errcode = '23514';
  end if;

  perform engine.assert_group_member(new.group_id, new.owner_id, 'owner');
  perform engine.assert_group_member(new.group_id, new.reviewer_id, 'reviewer');
  return new;
end;
$$;

create trigger tasks_before_insert
  before insert on public.tasks
  for each row execute function engine.tasks_before_insert();

create or replace function engine.tasks_before_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and coalesce(current_setting('coop.engine', true), '') <> 'on' then
    raise exception 'Task status can only be changed through transition_task()' using errcode = '42501';
  end if;

  if new.group_id <> old.group_id or new.organisation_id <> old.organisation_id
     or new.task_number <> old.task_number or new.created_by is distinct from old.created_by then
    raise exception 'Task identity fields are immutable' using errcode = '42501';
  end if;

  if new.progress <> old.progress and old.status in ('completed', 'cancelled')
     and new.status = old.status then
    raise exception 'Progress cannot change on a % task', old.status using errcode = '23514';
  end if;

  if new.parent_task_id is distinct from old.parent_task_id and new.parent_task_id is not null then
    if not exists (select 1 from public.tasks p where p.id = new.parent_task_id and p.group_id = new.group_id) then
      raise exception 'A subtask must belong to the same group as its parent' using errcode = '23514';
    end if;
  end if;

  if new.owner_id is distinct from old.owner_id then
    perform engine.assert_group_member(new.group_id, new.owner_id, 'owner');
  end if;
  if new.reviewer_id is distinct from old.reviewer_id then
    perform engine.assert_group_member(new.group_id, new.reviewer_id, 'reviewer');
  end if;

  new.version    := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;

create trigger tasks_before_update
  before update on public.tasks
  for each row execute function engine.tasks_before_update();

create or replace function engine.tasks_after_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform engine.record_event(
    new, 'created', case when auth.uid() is null then 'system' else 'user' end::public.actor_kind,
    null, new.status, null,
    jsonb_build_object('title', new.title, 'owner_id', new.owner_id, 'source', new.source)
  );
  return null;
end;
$$;

create trigger tasks_after_insert
  after insert on public.tasks
  for each row execute function engine.tasks_after_insert();

-- Logs non-status changes (status changes are logged by the engine with a reason).
create or replace function engine.tasks_after_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_changed text[] := '{}';
begin
  if new.status is distinct from old.status then
    return null;
  end if;

  if new.owner_id is distinct from old.owner_id then
    perform engine.record_event(new, 'owner_changed', 'user', null, null, null,
      jsonb_build_object('from', old.owner_id, 'to', new.owner_id));
  end if;

  if new.reviewer_id is distinct from old.reviewer_id then
    perform engine.record_event(new, 'reviewer_changed', 'user', null, null, null,
      jsonb_build_object('from', old.reviewer_id, 'to', new.reviewer_id));
  end if;

  if new.progress <> old.progress then
    perform engine.record_event(new, 'progress_updated', 'user', null, null, null,
      jsonb_build_object('from', old.progress, 'to', new.progress));
  end if;

  if new.title is distinct from old.title then v_changed := v_changed || 'title'; end if;
  if new.description is distinct from old.description then v_changed := v_changed || 'description'; end if;
  if new.acceptance_criteria is distinct from old.acceptance_criteria then v_changed := v_changed || 'acceptance_criteria'; end if;
  if new.priority is distinct from old.priority then v_changed := v_changed || 'priority'; end if;
  if new.start_date is distinct from old.start_date then v_changed := v_changed || 'start_date'; end if;
  if new.due_date is distinct from old.due_date then v_changed := v_changed || 'due_date'; end if;
  if new.estimate_hours is distinct from old.estimate_hours then v_changed := v_changed || 'estimate_hours'; end if;
  if new.parent_task_id is distinct from old.parent_task_id then v_changed := v_changed || 'parent_task_id'; end if;

  if cardinality(v_changed) > 0 then
    perform engine.record_event(new, 'details_updated', 'user', null, null, null,
      jsonb_build_object('fields', to_jsonb(v_changed)));
  end if;

  return null;
end;
$$;

create trigger tasks_after_update
  after update on public.tasks
  for each row execute function engine.tasks_after_update();

-- =============================================================================
-- 5. State machine
-- =============================================================================

-- Applies a transition whose permission has already been checked.
create or replace function engine.apply_transition(
  p_task        public.tasks,
  p_to          public.task_status,
  p_reason      text,
  p_actor_kind  public.actor_kind default 'user'
)
returns public.tasks
language plpgsql security definer set search_path = ''
as $$
declare
  v_new     public.tasks;
  v_unmet   integer;
  v_succ    public.tasks;
begin
  if not exists (
    select 1 from public.task_status_transitions
    where from_status = p_task.status and to_status = p_to
  ) then
    raise exception 'Transition % -> % is not allowed', p_task.status, p_to using errcode = '23514';
  end if;

  -- Conditions
  if p_to = 'ready' or (p_task.status = 'ready' and p_to = 'in_progress') then
    if p_task.owner_id is null then
      raise exception 'Assign an owner before the task can become ready' using errcode = '23514';
    end if;
    v_unmet := public.unmet_dependency_count(p_task.id);
    if v_unmet > 0 then
      raise exception 'Task is waiting on % unfinished dependenc%', v_unmet,
        case when v_unmet = 1 then 'y' else 'ies' end using errcode = '23514';
    end if;
  end if;

  if p_to = 'blocked' and public.confirmed_blocker_count(p_task.id) = 0 then
    raise exception 'Report and confirm a blocker before marking the task blocked' using errcode = '23514';
  end if;

  if p_task.status = 'blocked' and p_to = 'in_progress' and public.confirmed_blocker_count(p_task.id) > 0 then
    raise exception 'Resolve all confirmed blockers before unblocking' using errcode = '23514';
  end if;

  perform set_config('coop.engine', 'on', true);

  update public.tasks t set
    status            = p_to,
    status_changed_at = now(),
    started_at        = case when p_to = 'in_progress' and t.started_at is null then now() else t.started_at end,
    submitted_at      = case when p_to = 'in_review' then now() else t.submitted_at end,
    completed_at      = case when p_to = 'completed' then now()
                             when p_task.status = 'completed' then null
                             else t.completed_at end,
    cancelled_at      = case when p_to = 'cancelled' then now() else t.cancelled_at end,
    progress          = case when p_to = 'completed' then 100 else t.progress end
  where t.id = p_task.id
  returning t.* into v_new;

  perform set_config('coop.engine', 'off', true);

  perform engine.record_event(
    v_new,
    case when p_task.status = 'completed' then 'reopened' else 'status_changed' end,
    p_actor_kind, p_task.status, p_to, p_reason,
    jsonb_build_object('progress', v_new.progress)
  );

  -- Dependency propagation: notify successors.
  if p_to = 'completed' then
    for v_succ in
      select s.* from public.task_dependencies d
      join public.tasks s on s.id = d.successor_id
      where d.predecessor_id = v_new.id and s.status in ('draft', 'ready')
    loop
      if public.unmet_dependency_count(v_succ.id) = 0 then
        perform engine.record_event(v_succ, 'dependency_satisfied', 'system', null, null,
          'All prerequisites are completed; task is eligible to be ready',
          jsonb_build_object('predecessor_id', v_new.id, 'predecessor_title', v_new.title));
      end if;
    end loop;
  elsif p_task.status = 'completed' then
    for v_succ in
      select s.* from public.task_dependencies d
      join public.tasks s on s.id = d.successor_id
      where d.predecessor_id = v_new.id and s.status not in ('completed', 'cancelled')
    loop
      perform engine.record_event(v_succ, 'dependency_reopened', 'system', null, null, p_reason,
        jsonb_build_object('predecessor_id', v_new.id, 'predecessor_title', v_new.title));
    end loop;
  end if;

  return v_new;
end;
$$;

-- Public entry point for every status change.
create or replace function public.transition_task(
  p_task_id           uuid,
  p_to_status         public.task_status,
  p_reason            text default null,
  p_expected_version  integer default null
)
returns public.tasks
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_task    public.tasks;
  v_rule    public.task_status_transitions;
  v_member  uuid;
  v_allowed boolean;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into v_task from public.tasks where id = p_task_id for update;
  if not found or not public.can_view_group(v_task.group_id) then
    raise exception 'Task not found' using errcode = 'P0002';
  end if;

  if p_expected_version is not null and v_task.version <> p_expected_version then
    raise exception 'This task was changed by someone else. Refresh and try again.' using errcode = '40001';
  end if;

  select * into v_rule from public.task_status_transitions
  where from_status = v_task.status and to_status = p_to_status;
  if not found then
    raise exception 'Transition % -> % is not allowed', v_task.status, p_to_status using errcode = '23514';
  end if;

  v_member := public.current_member_id(v_task.organisation_id);
  v_allowed :=
       ('group_admin' = any (v_rule.allowed_actors) and public.is_group_admin(v_task.group_id))
    or ('owner'       = any (v_rule.allowed_actors) and v_task.owner_id = v_member)
    or ('reviewer'    = any (v_rule.allowed_actors) and v_task.reviewer_id = v_member)
    or ('creator'     = any (v_rule.allowed_actors) and v_task.created_by = v_uid);

  if not coalesce(v_allowed, false) then
    raise exception 'You are not allowed to "%" this task', v_rule.label using errcode = '42501';
  end if;

  if v_rule.requires_reason and coalesce(trim(p_reason), '') = '' then
    raise exception 'A reason is required to "%"', v_rule.label using errcode = '23514';
  end if;

  return engine.apply_transition(v_task, p_to_status, p_reason, 'user');
end;
$$;

-- =============================================================================
-- 6. Dependencies (directed acyclic graph)
-- =============================================================================

-- Backstop: no insert path can ever create a cycle.
create or replace function engine.task_dependencies_before_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  -- Serialise graph edits per organisation so concurrent inserts can't form a cycle.
  perform pg_advisory_xact_lock(hashtextextended(new.organisation_id::text, 0));
  if engine.would_create_cycle(new.predecessor_id, new.successor_id) then
    raise exception 'This dependency would create a cycle' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger task_dependencies_before_insert
  before insert on public.task_dependencies
  for each row execute function engine.task_dependencies_before_insert();

create or replace function public.add_task_dependency(
  p_predecessor_id  uuid,
  p_successor_id    uuid,
  p_type            public.dependency_type default 'finish_to_start'
)
returns public.task_dependencies
language plpgsql security definer set search_path = ''
as $$
declare
  v_pred  public.tasks;
  v_succ  public.tasks;
  v_dep   public.task_dependencies;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_type <> 'finish_to_start' then
    raise exception 'Only finish-to-start dependencies are supported in this version' using errcode = '0A000';
  end if;

  select * into v_pred from public.tasks where id = p_predecessor_id;
  select * into v_succ from public.tasks where id = p_successor_id for update;

  if v_pred.id is null or not public.can_view_group(v_pred.group_id) then
    raise exception 'Prerequisite task not found' using errcode = 'P0002';
  end if;
  if v_succ.id is null or not public.can_view_group(v_succ.group_id) then
    raise exception 'Task not found' using errcode = 'P0002';
  end if;
  if v_pred.organisation_id <> v_succ.organisation_id then
    raise exception 'Tasks must belong to the same organisation' using errcode = '23514';
  end if;
  if not public.can_edit_task(v_succ.id) then
    raise exception 'You are not allowed to change this task''s dependencies' using errcode = '42501';
  end if;
  if v_succ.status = 'cancelled' then
    raise exception 'Cannot add dependencies to a cancelled task' using errcode = '23514';
  end if;
  if v_succ.status in ('in_progress', 'blocked', 'in_review', 'completed') and v_pred.status <> 'completed' then
    raise exception 'Cannot add an unfinished prerequisite to a task that has already started' using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_succ.organisation_id::text, 0));
  if engine.would_create_cycle(v_pred.id, v_succ.id) then
    raise exception 'This dependency would create a cycle' using errcode = '23514';
  end if;

  insert into public.task_dependencies (organisation_id, predecessor_id, successor_id, dependency_type, created_by)
  values (v_succ.organisation_id, v_pred.id, v_succ.id, p_type, auth.uid())
  returning * into v_dep;

  perform engine.record_event(v_succ, 'dependency_added', 'user', null, null, null,
    jsonb_build_object('dependency_id', v_dep.id, 'predecessor_id', v_pred.id,
                       'predecessor_title', v_pred.title, 'type', p_type,
                       'unmet_count', public.unmet_dependency_count(v_succ.id)));
  return v_dep;
end;
$$;

create or replace function public.remove_task_dependency(p_dependency_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_dep   public.task_dependencies;
  v_succ  public.tasks;
  v_pred  public.tasks;
begin
  select * into v_dep from public.task_dependencies where id = p_dependency_id;
  if not found then
    raise exception 'Dependency not found' using errcode = 'P0002';
  end if;
  select * into v_succ from public.tasks where id = v_dep.successor_id;
  select * into v_pred from public.tasks where id = v_dep.predecessor_id;

  if not public.can_edit_task(v_succ.id) then
    raise exception 'You are not allowed to change this task''s dependencies' using errcode = '42501';
  end if;

  delete from public.task_dependencies where id = p_dependency_id;

  perform engine.record_event(v_succ, 'dependency_removed', 'user', null, null, null,
    jsonb_build_object('predecessor_id', v_pred.id, 'predecessor_title', v_pred.title));
end;
$$;

-- =============================================================================
-- 7. Blockers (first-class objects with their own lifecycle)
-- =============================================================================

create or replace function public.report_blocker(
  p_task_id               uuid,
  p_title                 text,
  p_category              public.blocker_category default 'other',
  p_description           text default null,
  p_blocking_task_id      uuid default null,
  p_resolution_owner_id   uuid default null,
  p_suggested_resolution  text default null,
  p_downstream_impact     text default null
)
returns public.task_blockers
language plpgsql security definer set search_path = ''
as $$
declare
  v_task     public.tasks;
  v_blocker  public.task_blockers;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into v_task from public.tasks where id = p_task_id;
  if not found or not public.can_view_group(v_task.group_id) then
    raise exception 'Task not found' using errcode = 'P0002';
  end if;
  if v_task.status in ('completed', 'cancelled') then
    raise exception 'Cannot report a blocker on a % task', v_task.status using errcode = '23514';
  end if;
  if coalesce(trim(p_title), '') = '' then
    raise exception 'A blocker needs a title' using errcode = '23514';
  end if;

  insert into public.task_blockers (
    organisation_id, task_id, title, description, category, status, source,
    blocking_task_id, resolution_owner_id, suggested_resolution, downstream_impact, reported_by
  ) values (
    v_task.organisation_id, v_task.id, trim(p_title), p_description, p_category, 'reported', 'manual',
    p_blocking_task_id, p_resolution_owner_id, p_suggested_resolution, p_downstream_impact, auth.uid()
  ) returning * into v_blocker;

  perform engine.record_event(v_task, 'blocker_reported', 'user', null, null, null,
    jsonb_build_object('blocker_id', v_blocker.id, 'title', v_blocker.title, 'category', v_blocker.category));
  return v_blocker;
end;
$$;

create or replace function engine.can_manage_blocker(p_task public.tasks)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_group_admin(p_task.group_id)
      or p_task.owner_id = public.current_member_id(p_task.organisation_id);
$$;

-- Validate a reported / AI-inferred blocker. Blocks an in-progress task.
create or replace function public.confirm_blocker(p_blocker_id uuid)
returns public.task_blockers
language plpgsql security definer set search_path = ''
as $$
declare
  v_blocker  public.task_blockers;
  v_task     public.tasks;
begin
  select * into v_blocker from public.task_blockers where id = p_blocker_id for update;
  if not found then
    raise exception 'Blocker not found' using errcode = 'P0002';
  end if;
  select * into v_task from public.tasks where id = v_blocker.task_id for update;
  if not public.can_view_group(v_task.group_id) then
    raise exception 'Blocker not found' using errcode = 'P0002';
  end if;
  if not engine.can_manage_blocker(v_task) then
    raise exception 'Only the task owner or a group admin can confirm blockers' using errcode = '42501';
  end if;
  if v_blocker.status not in ('reported', 'potential') then
    raise exception 'Only reported or potential blockers can be confirmed' using errcode = '23514';
  end if;

  update public.task_blockers
     set status = 'confirmed', confirmed_by = auth.uid(), confirmed_at = now()
   where id = p_blocker_id
  returning * into v_blocker;

  perform engine.record_event(v_task, 'blocker_confirmed', 'user', null, null, null,
    jsonb_build_object('blocker_id', v_blocker.id, 'title', v_blocker.title));

  if v_task.status = 'in_progress' then
    perform engine.apply_transition(v_task, 'blocked', 'Blocker confirmed: ' || v_blocker.title, 'user');
  end if;

  return v_blocker;
end;
$$;

-- Resolve a blocker. When the last confirmed blocker is resolved the task resumes.
create or replace function public.resolve_blocker(p_blocker_id uuid, p_note text default null)
returns public.task_blockers
language plpgsql security definer set search_path = ''
as $$
declare
  v_blocker  public.task_blockers;
  v_task     public.tasks;
begin
  select * into v_blocker from public.task_blockers where id = p_blocker_id for update;
  if not found then
    raise exception 'Blocker not found' using errcode = 'P0002';
  end if;
  select * into v_task from public.tasks where id = v_blocker.task_id for update;
  if not public.can_view_group(v_task.group_id) then
    raise exception 'Blocker not found' using errcode = 'P0002';
  end if;
  if not (
    engine.can_manage_blocker(v_task)
    or v_blocker.reported_by = auth.uid()
    or v_blocker.resolution_owner_id = public.current_member_id(v_task.organisation_id)
  ) then
    raise exception 'You are not allowed to resolve this blocker' using errcode = '42501';
  end if;
  if v_blocker.status not in ('reported', 'potential', 'confirmed') then
    raise exception 'This blocker is already %', v_blocker.status using errcode = '23514';
  end if;

  update public.task_blockers
     set status = 'resolved', resolved_by = auth.uid(), resolved_at = now(),
         resolution_note = nullif(trim(p_note), '')
   where id = p_blocker_id
  returning * into v_blocker;

  perform engine.record_event(v_task, 'blocker_resolved', 'user', null, null, p_note,
    jsonb_build_object('blocker_id', v_blocker.id, 'title', v_blocker.title));

  if v_task.status = 'blocked' and public.confirmed_blocker_count(v_task.id) = 0 then
    perform engine.apply_transition(v_task, 'in_progress', 'All blockers resolved', 'user');
  end if;

  return v_blocker;
end;
$$;

create or replace function public.dismiss_blocker(p_blocker_id uuid, p_note text default null)
returns public.task_blockers
language plpgsql security definer set search_path = ''
as $$
declare
  v_blocker  public.task_blockers;
  v_task     public.tasks;
begin
  select * into v_blocker from public.task_blockers where id = p_blocker_id for update;
  if not found then
    raise exception 'Blocker not found' using errcode = 'P0002';
  end if;
  select * into v_task from public.tasks where id = v_blocker.task_id for update;
  if not public.can_view_group(v_task.group_id) then
    raise exception 'Blocker not found' using errcode = 'P0002';
  end if;
  if not engine.can_manage_blocker(v_task) then
    raise exception 'Only the task owner or a group admin can dismiss blockers' using errcode = '42501';
  end if;
  if v_blocker.status not in ('reported', 'potential', 'confirmed') then
    raise exception 'This blocker is already %', v_blocker.status using errcode = '23514';
  end if;

  update public.task_blockers
     set status = 'dismissed', resolved_by = auth.uid(), resolved_at = now(),
         resolution_note = nullif(trim(p_note), '')
   where id = p_blocker_id
  returning * into v_blocker;

  perform engine.record_event(v_task, 'blocker_dismissed', 'user', null, null, p_note,
    jsonb_build_object('blocker_id', v_blocker.id, 'title', v_blocker.title));

  if v_task.status = 'blocked' and public.confirmed_blocker_count(v_task.id) = 0 then
    perform engine.apply_transition(v_task, 'in_progress', 'All blockers cleared', 'user');
  end if;

  return v_blocker;
end;
$$;

-- =============================================================================
-- 8. Organisations, groups, invitations
-- =============================================================================

create or replace function public.create_organisation(p_name text)
returns public.organisations
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_org    public.organisations;
  v_base   text;
  v_prefix text;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if char_length(coalesce(trim(p_name), '')) < 2 then
    raise exception 'Organisation name must be at least 2 characters' using errcode = '23514';
  end if;

  v_base := trim(both '-' from regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g'));
  if char_length(v_base) < 2 or v_base !~ '^[a-z0-9]' then
    v_base := 'org';
  end if;
  v_base := left(v_base, 48);

  v_prefix := left(upper(regexp_replace(p_name, '[^A-Za-z0-9]', '', 'g')), 4);
  if v_prefix !~ '^[A-Z][A-Z0-9]{1,9}$' then
    v_prefix := 'COOP';
  end if;

  insert into public.organisations (name, slug, task_key_prefix, created_by)
  values (
    trim(p_name),
    v_base || '-' || substr(encode(extensions.gen_random_bytes(3), 'hex'), 1, 6),
    v_prefix,
    v_uid
  )
  returning * into v_org;

  insert into public.organisation_members (organisation_id, user_id, role)
  values (v_org.id, v_uid, 'owner');

  return v_org;
end;
$$;

-- Any organisation member can create a group and becomes its admin (manager).
create or replace function public.create_group(
  p_organisation_id  uuid,
  p_name             text,
  p_goal             text default null,
  p_description      text default null,
  p_functional_role  text default null
)
returns public.groups
language plpgsql security definer set search_path = ''
as $$
declare
  v_member  uuid;
  v_group   public.groups;
begin
  v_member := public.current_member_id(p_organisation_id);
  if v_member is null then
    raise exception 'You are not a member of this organisation' using errcode = '42501';
  end if;

  insert into public.groups (organisation_id, name, goal, description, created_by)
  values (p_organisation_id, trim(p_name), nullif(trim(p_goal), ''), nullif(trim(p_description), ''), auth.uid())
  returning * into v_group;

  insert into public.group_members (
    organisation_id, group_id, organisation_member_id, role, functional_role, role_source,
    can_create_tasks, can_schedule_tasks, can_assign_tasks, can_upload_context
  ) values (
    p_organisation_id, v_group.id, v_member, 'admin',
    nullif(trim(p_functional_role), ''),
    case when nullif(trim(p_functional_role), '') is null then null else 'self'::public.role_source end,
    true, true, true, true
  );

  return v_group;
end;
$$;

-- Group admin adds an existing organisation member, optionally with a functional role.
create or replace function public.add_group_member(
  p_group_id                uuid,
  p_organisation_member_id  uuid,
  p_role                    public.group_role default 'member',
  p_functional_role         text default null,
  p_can_create_tasks        boolean default false,
  p_can_schedule_tasks      boolean default false,
  p_can_assign_tasks        boolean default false,
  p_can_upload_context      boolean default false
)
returns public.group_members
language plpgsql security definer set search_path = ''
as $$
declare
  v_group   public.groups;
  v_row     public.group_members;
  v_role    text := nullif(trim(p_functional_role), '');
begin
  select * into v_group from public.groups where id = p_group_id;
  if not found or not public.is_group_admin(p_group_id) then
    raise exception 'Only a group admin can add members' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.organisation_members
    where id = p_organisation_member_id and organisation_id = v_group.organisation_id
  ) then
    raise exception 'That person is not a member of this organisation' using errcode = '23514';
  end if;

  insert into public.group_members (
    organisation_id, group_id, organisation_member_id, role, functional_role, role_source,
    can_create_tasks, can_schedule_tasks, can_assign_tasks, can_upload_context
  ) values (
    v_group.organisation_id, p_group_id, p_organisation_member_id, p_role, v_role,
    case when v_role is null then null else 'admin'::public.role_source end,
    p_can_create_tasks or p_role = 'admin', p_can_schedule_tasks or p_role = 'admin',
    p_can_assign_tasks or p_role = 'admin', p_can_upload_context or p_role = 'admin'
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.create_invitation(
  p_organisation_id  uuid,
  p_email            text,
  p_group_id         uuid default null,
  p_org_role         public.org_role default 'member',
  p_group_role       public.group_role default 'member',
  p_functional_role  text default null
)
returns public.invitations
language plpgsql security definer set search_path = ''
as $$
declare
  v_inv  public.invitations;
begin
  if p_group_id is not null then
    if not exists (select 1 from public.groups where id = p_group_id and organisation_id = p_organisation_id)
       or not public.is_group_admin(p_group_id) then
      raise exception 'Only a group admin can invite people to this group' using errcode = '42501';
    end if;
  elsif not public.is_org_admin(p_organisation_id) then
    raise exception 'Only organisation admins can invite people to the organisation' using errcode = '42501';
  end if;

  if p_org_role <> 'member' and not public.is_org_admin(p_organisation_id) then
    raise exception 'Only organisation admins can grant an organisation role' using errcode = '42501';
  end if;
  if p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Invalid email address' using errcode = '23514';
  end if;

  -- Replace any older pending invitation for the same target
  update public.invitations set status = 'revoked'
   where organisation_id = p_organisation_id
     and coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid)
         = coalesce(p_group_id, '00000000-0000-0000-0000-000000000000'::uuid)
     and lower(email::text) = lower(trim(p_email))
     and status = 'pending';

  insert into public.invitations (
    organisation_id, group_id, email, org_role, group_role, functional_role, invited_by
  ) values (
    p_organisation_id, p_group_id, lower(trim(p_email)), p_org_role, p_group_role,
    nullif(trim(p_functional_role), ''), auth.uid()
  )
  returning * into v_inv;

  return v_inv;
end;
$$;

-- What an invitee sees before accepting (they are not a member yet).
create or replace function public.get_invitation(p_token text)
returns table (
  organisation_name  text,
  group_name         text,
  email              text,
  functional_role    text,
  invited_by_name    text,
  status             public.invitation_status,
  expires_at         timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select o.name, g.name, i.email::text, i.functional_role,
         coalesce(p.full_name, p.email::text),
         case when i.status = 'pending' and i.expires_at < now() then 'expired'::public.invitation_status else i.status end,
         i.expires_at
  from public.invitations i
  join public.organisations o on o.id = i.organisation_id
  left join public.groups g on g.id = i.group_id
  left join public.profiles p on p.id = i.invited_by
  where i.token = p_token;
$$;

create or replace function public.accept_invitation(p_token text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_email   text;
  v_inv     public.invitations;
  v_member  uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into v_inv from public.invitations where token = p_token for update;
  if not found then
    raise exception 'Invitation not found' using errcode = 'P0002';
  end if;
  if v_inv.status <> 'pending' then
    raise exception 'This invitation is %', v_inv.status using errcode = '23514';
  end if;
  if v_inv.expires_at < now() then
    update public.invitations set status = 'expired' where id = v_inv.id;
    raise exception 'This invitation has expired' using errcode = '23514';
  end if;

  select email::text into v_email from public.profiles where id = v_uid;
  if lower(v_email) <> lower(v_inv.email::text) then
    raise exception 'This invitation was sent to a different email address' using errcode = '42501';
  end if;

  insert into public.organisation_members (organisation_id, user_id, role)
  values (v_inv.organisation_id, v_uid, v_inv.org_role)
  on conflict (organisation_id, user_id) do nothing;

  select id into v_member from public.organisation_members
  where organisation_id = v_inv.organisation_id and user_id = v_uid;

  if v_inv.group_id is not null then
    insert into public.group_members (
      organisation_id, group_id, organisation_member_id, role, functional_role, role_source,
      can_create_tasks, can_schedule_tasks, can_assign_tasks, can_upload_context
    ) values (
      v_inv.organisation_id, v_inv.group_id, v_member, v_inv.group_role, v_inv.functional_role,
      case when v_inv.functional_role is null then null else 'admin'::public.role_source end,
      v_inv.group_role = 'admin', v_inv.group_role = 'admin', v_inv.group_role = 'admin', v_inv.group_role = 'admin'
    )
    on conflict (group_id, organisation_member_id) do nothing;
  end if;

  update public.invitations
     set status = 'accepted', accepted_by = v_uid, accepted_at = now()
   where id = v_inv.id;

  return jsonb_build_object('organisation_id', v_inv.organisation_id, 'group_id', v_inv.group_id);
end;
$$;

-- =============================================================================
-- 9. Read models (views run with the caller's RLS)
-- =============================================================================

create or replace view public.group_member_directory
with (security_invoker = true) as
select
  gm.id,
  gm.organisation_id,
  gm.group_id,
  gm.organisation_member_id,
  om.user_id,
  gm.role,
  gm.functional_role,
  gm.role_source,
  gm.can_create_tasks,
  gm.can_schedule_tasks,
  gm.can_assign_tasks,
  gm.can_upload_context,
  gm.joined_at,
  p.full_name,
  p.email::text as email,
  p.avatar_url,
  p.job_title
from public.group_members gm
join public.organisation_members om on om.id = gm.organisation_member_id
join public.profiles p on p.id = om.user_id;

create or replace view public.task_board
with (security_invoker = true) as
select
  t.*,
  o.task_key_prefix || '-' || t.task_number as task_key,
  op.full_name  as owner_name,
  op.avatar_url as owner_avatar_url,
  oom.user_id   as owner_user_id,
  rp.full_name  as reviewer_name,
  public.unmet_dependency_count(t.id) as unmet_dependency_count,
  (select count(*)::int from public.task_blockers b
    where b.task_id = t.id and b.status in ('potential', 'reported', 'confirmed')) as open_blocker_count,
  (select count(*)::int from public.tasks c where c.parent_task_id = t.id) as subtask_count
from public.tasks t
join public.organisations o on o.id = t.organisation_id
left join public.organisation_members oom on oom.id = t.owner_id
left join public.profiles op on op.id = oom.user_id
left join public.organisation_members rom on rom.id = t.reviewer_id
left join public.profiles rp on rp.id = rom.user_id;
