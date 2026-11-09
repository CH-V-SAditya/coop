-- =============================================================================
-- Coop · Migration 4 · Discussions, context documents, AI suggestions, BYO agents
--   The AI is NEVER the source of truth: it only writes ai_suggestions, which a
--   human accepts and the task engine applies (recording a task_event).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- GROUP_MESSAGES (natural interaction: group discussions)
-- -----------------------------------------------------------------------------
create table public.group_messages (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null,
  group_id         uuid not null,
  author_id        uuid references public.profiles (id) on delete set null,
  body             text not null check (char_length(body) between 1 and 5000),
  task_id          uuid,                 -- optional: message is about a task
  reply_to_id      uuid references public.group_messages (id) on delete set null,
  created_at       timestamptz not null default now(),
  edited_at        timestamptz,
  foreign key (organisation_id, group_id)
    references public.groups (organisation_id, id) on delete cascade,
  foreign key (organisation_id, task_id)
    references public.tasks (organisation_id, id) on delete set null (task_id)
);

create index group_messages_group_idx on public.group_messages (group_id, created_at desc);

-- -----------------------------------------------------------------------------
-- CONTEXT_DOCUMENTS (goal / task context; group admin only by default)
-- -----------------------------------------------------------------------------
create table public.context_documents (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null,
  group_id         uuid not null,
  task_id          uuid,
  title            text not null check (char_length(title) between 1 and 200),
  description      text,
  storage_path     text,                 -- object in the 'context-documents' bucket
  mime_type        text,
  size_bytes       bigint check (size_bytes is null or size_bytes >= 0),
  content_text     text,                 -- pasted text or extracted text (for the AI)
  uploaded_by      uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  foreign key (organisation_id, group_id)
    references public.groups (organisation_id, id) on delete cascade,
  foreign key (organisation_id, task_id)
    references public.tasks (organisation_id, id) on delete cascade,
  check (storage_path is not null or content_text is not null)
);

create index context_documents_group_idx on public.context_documents (group_id);

-- -----------------------------------------------------------------------------
-- AI_AGENTS (bring-your-own AI agents; no workflow yet, relationships only)
--   Secrets are never stored here: secret_id references a Supabase Vault secret.
-- -----------------------------------------------------------------------------
create table public.ai_agents (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations (id) on delete cascade,
  group_id         uuid,
  owner_id         uuid references public.profiles (id) on delete cascade,
  scope            public.agent_scope not null default 'personal',
  name             text not null check (char_length(name) between 1 and 80),
  description      text,
  provider         text not null,        -- 'anthropic' | 'openai' | 'custom_http' | 'mcp' ...
  model            text,
  endpoint_url     text,
  secret_id        uuid,                 -- vault.secrets.id
  capabilities     text[] not null default '{}',
  enabled          boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  foreign key (organisation_id, group_id)
    references public.groups (organisation_id, id) on delete cascade,
  check (scope <> 'group' or group_id is not null)
);

create trigger ai_agents_set_updated_at
  before update on public.ai_agents
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- AI_SUGGESTIONS (owned by organisation, optionally related to a task)
-- -----------------------------------------------------------------------------
create table public.ai_suggestions (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations (id) on delete cascade,
  group_id         uuid,
  task_id          uuid,
  kind             public.ai_suggestion_kind not null,
  status           public.ai_suggestion_status not null default 'pending',
  source_type      public.ai_source_type,
  source_id        uuid,
  payload          jsonb not null default '{}'::jsonb,   -- the proposed change
  rationale        text,                                  -- why the AI suggests it
  confidence       numeric(3, 2) check (confidence is null or confidence between 0 and 1),
  model            text,
  agent_id         uuid references public.ai_agents (id) on delete set null,
  reviewed_by      uuid references public.profiles (id) on delete set null,
  reviewed_at      timestamptz,
  applied_event_id bigint references public.task_events (id) on delete set null,
  expires_at       timestamptz,
  created_at       timestamptz not null default now(),
  foreign key (organisation_id, group_id)
    references public.groups (organisation_id, id) on delete cascade,
  foreign key (organisation_id, task_id)
    references public.tasks (organisation_id, id) on delete cascade
);

create index ai_suggestions_pending_idx on public.ai_suggestions (group_id, status) where status = 'pending';
create index ai_suggestions_task_idx on public.ai_suggestions (task_id) where task_id is not null;

alter table public.task_blockers
  add constraint task_blockers_ai_suggestion_fk
  foreign key (ai_suggestion_id) references public.ai_suggestions (id) on delete set null;
