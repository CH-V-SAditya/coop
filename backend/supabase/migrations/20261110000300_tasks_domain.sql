-- =============================================================================
-- Coop · Migration 3 · Task domain
--   A task is a persistent, stateful object made of:
--   identity · ownership · lifecycle · dependencies · blockers · timeline ·
--   evidence · history · intelligence
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TASKS (current-state record)
-- -----------------------------------------------------------------------------
create table public.tasks (
  -- Identity
  id                   uuid primary key default gen_random_uuid(),
  organisation_id      uuid not null,
  group_id             uuid not null,
  task_number          integer not null,                 -- human key: <prefix>-<task_number>
  parent_task_id       uuid references public.tasks (id) on delete cascade,
  title                text not null check (char_length(title) between 1 and 200),
  description          text,
  acceptance_criteria  text,

  -- Ownership (assigned to organisation members, per ER diagram)
  created_by           uuid references public.profiles (id) on delete set null,
  owner_id             uuid,
  reviewer_id          uuid,

  -- Lifecycle (status is ONLY changed by the task engine)
  status               public.task_status not null default 'draft',
  status_changed_at    timestamptz not null default now(),
  progress             smallint not null default 0 check (progress between 0 and 100),
  priority             public.task_priority not null default 'medium',

  -- Timeline
  start_date           date,
  due_date             date,
  estimate_hours       numeric(6, 1) check (estimate_hours is null or estimate_hours >= 0),
  started_at           timestamptz,
  submitted_at         timestamptz,
  completed_at         timestamptz,
  cancelled_at         timestamptz,

  -- Intelligence (only written from accepted AI suggestions)
  risk_level           public.risk_level,
  ai_summary           text,
  ai_assessed_at       timestamptz,

  -- Provenance
  source               public.task_source not null default 'manual',
  source_ref           uuid,                              -- e.g. ai_suggestions.id / group_messages.id

  version              integer not null default 1,        -- optimistic concurrency
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  unique (organisation_id, task_number),
  unique (organisation_id, id),
  foreign key (organisation_id, group_id)
    references public.groups (organisation_id, id) on delete cascade,
  foreign key (organisation_id, owner_id)
    references public.organisation_members (organisation_id, id) on delete set null (owner_id),
  foreign key (organisation_id, reviewer_id)
    references public.organisation_members (organisation_id, id) on delete set null (reviewer_id),
  check (parent_task_id is null or parent_task_id <> id),
  check (start_date is null or due_date is null or start_date <= due_date)
);

create index tasks_group_status_idx on public.tasks (group_id, status);
create index tasks_owner_idx on public.tasks (owner_id) where owner_id is not null;
create index tasks_parent_idx on public.tasks (parent_task_id) where parent_task_id is not null;
create index tasks_due_idx on public.tasks (due_date) where status not in ('completed', 'cancelled');

-- -----------------------------------------------------------------------------
-- STATE MACHINE AS DATA
--   allowed_actors: owner | reviewer | creator | group_admin
-- -----------------------------------------------------------------------------
create table public.task_status_transitions (
  from_status      public.task_status not null,
  to_status        public.task_status not null,
  label            text not null,
  condition        text not null,
  allowed_actors   text[] not null,
  requires_reason  boolean not null default false,
  primary key (from_status, to_status),
  check (from_status <> to_status)
);

insert into public.task_status_transitions
  (from_status, to_status, label, condition, allowed_actors, requires_reason)
values
  ('draft',       'ready',       'Mark ready',       'Requirements and owner established; all dependencies satisfied', array['group_admin','creator'], false),
  ('ready',       'in_progress', 'Start work',       'Owner starts work; all dependencies satisfied',                  array['owner','group_admin'], false),
  ('in_progress', 'blocked',     'Mark blocked',     'A blocker has been reported and confirmed',                      array['owner','group_admin'], false),
  ('blocked',     'in_progress', 'Unblock',          'All confirmed blockers are resolved',                            array['owner','group_admin'], false),
  ('in_progress', 'in_review',   'Submit for review','Work submitted for verification',                                array['owner','group_admin'], false),
  ('in_review',   'completed',   'Accept',           'Reviewer accepts the outcome',                                   array['reviewer','group_admin'], false),
  ('in_review',   'in_progress', 'Request changes',  'Reviewer or manager requests changes',                           array['reviewer','group_admin'], true),
  ('completed',   'in_progress', 'Reopen',           'Explicit reopening with a reason',                               array['reviewer','group_admin'], true),
  ('draft',       'cancelled',   'Cancel',           'Authorised cancellation',                                        array['group_admin'], true),
  ('ready',       'cancelled',   'Cancel',           'Authorised cancellation',                                        array['group_admin'], true),
  ('in_progress', 'cancelled',   'Cancel',           'Authorised cancellation',                                        array['group_admin'], true),
  ('blocked',     'cancelled',   'Cancel',           'Authorised cancellation',                                        array['group_admin'], true),
  ('in_review',   'cancelled',   'Cancel',           'Authorised cancellation',                                        array['group_admin'], true);

-- -----------------------------------------------------------------------------
-- TASK_DEPENDENCIES (directed edges predecessor -> successor; must stay acyclic)
-- -----------------------------------------------------------------------------
create table public.task_dependencies (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations (id) on delete cascade,
  predecessor_id   uuid not null,
  successor_id     uuid not null,
  dependency_type  public.dependency_type not null default 'finish_to_start',
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  unique (predecessor_id, successor_id),
  check (predecessor_id <> successor_id),
  -- MVP: only finish-to-start. Drop this constraint to enable SS / FF / SF.
  constraint task_dependencies_mvp_fs_only check (dependency_type = 'finish_to_start'),
  foreign key (organisation_id, predecessor_id)
    references public.tasks (organisation_id, id) on delete cascade,
  foreign key (organisation_id, successor_id)
    references public.tasks (organisation_id, id) on delete cascade
);

create index task_dependencies_successor_idx on public.task_dependencies (successor_id);

-- -----------------------------------------------------------------------------
-- TASK_BLOCKERS (first-class impediments, separate from dependencies)
-- -----------------------------------------------------------------------------
create table public.task_blockers (
  id                    uuid primary key default gen_random_uuid(),
  organisation_id       uuid not null,
  task_id               uuid not null,
  title                 text not null check (char_length(title) between 1 and 200),
  description           text,
  category              public.blocker_category not null default 'other',
  status                public.blocker_status not null default 'reported',
  source                public.blocker_source not null default 'manual',
  blocking_task_id      uuid,                 -- optional: the task causing the impediment
  resolution_owner_id   uuid,                 -- who can resolve it
  suggested_resolution  text,
  downstream_impact     text,
  ai_suggestion_id      uuid,                 -- set when created from an AI suggestion
  reported_by           uuid references public.profiles (id) on delete set null,
  confirmed_by          uuid references public.profiles (id) on delete set null,
  confirmed_at          timestamptz,
  resolved_by           uuid references public.profiles (id) on delete set null,
  resolved_at           timestamptz,
  resolution_note       text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  foreign key (organisation_id, task_id)
    references public.tasks (organisation_id, id) on delete cascade,
  foreign key (organisation_id, blocking_task_id)
    references public.tasks (organisation_id, id) on delete set null (blocking_task_id),
  foreign key (organisation_id, resolution_owner_id)
    references public.organisation_members (organisation_id, id) on delete set null (resolution_owner_id)
);

create index task_blockers_task_idx on public.task_blockers (task_id, status);

create trigger task_blockers_set_updated_at
  before update on public.task_blockers
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- TASK_EVENTS (immutable, append-only history)
-- -----------------------------------------------------------------------------
create table public.task_events (
  id               bigint generated always as identity primary key,
  organisation_id  uuid not null,
  task_id          uuid not null,
  event_type       text not null,
  actor_id         uuid references public.profiles (id) on delete set null,
  actor_kind       public.actor_kind not null default 'user',
  from_status      public.task_status,
  to_status        public.task_status,
  reason           text,
  payload          jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  foreign key (organisation_id, task_id)
    references public.tasks (organisation_id, id) on delete cascade
);

create index task_events_task_idx on public.task_events (task_id, created_at desc);

-- Events can never be edited. (Deletion only happens via task cascade.)
create or replace function public.prevent_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'task_events are immutable' using errcode = 'P0001';
end;
$$;

create trigger task_events_immutable
  before update on public.task_events
  for each row execute function public.prevent_event_mutation();

-- -----------------------------------------------------------------------------
-- TASK_COMMENTS (task-specific discussion)
-- -----------------------------------------------------------------------------
create table public.task_comments (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null,
  task_id          uuid not null,
  author_id        uuid references public.profiles (id) on delete set null,
  body             text not null check (char_length(body) between 1 and 5000),
  created_at       timestamptz not null default now(),
  edited_at        timestamptz,
  foreign key (organisation_id, task_id)
    references public.tasks (organisation_id, id) on delete cascade
);

create index task_comments_task_idx on public.task_comments (task_id, created_at);

-- -----------------------------------------------------------------------------
-- TASK_EVIDENCE (links / files / notes that prove the work)
-- -----------------------------------------------------------------------------
create table public.task_evidence (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null,
  task_id          uuid not null,
  kind             public.evidence_kind not null,
  url              text,
  storage_path     text,
  note             text,
  submitted_by     uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  foreign key (organisation_id, task_id)
    references public.tasks (organisation_id, id) on delete cascade,
  check (
    (kind = 'link' and url is not null) or
    (kind = 'file' and storage_path is not null) or
    (kind = 'note' and note is not null)
  )
);

create index task_evidence_task_idx on public.task_evidence (task_id);
