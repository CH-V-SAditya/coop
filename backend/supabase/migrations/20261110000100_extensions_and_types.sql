-- =============================================================================
-- Coop · Migration 1 · Extensions and enumerated types
-- =============================================================================

create extension if not exists citext with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- Organisation-level role
create type public.org_role as enum ('owner', 'admin', 'member');

-- Group-level role (group admin = manager of the group)
create type public.group_role as enum ('admin', 'member');

-- Where a member's functional role ("Frontend", "Database", ...) came from
create type public.role_source as enum ('admin', 'ai', 'self');

-- Task lifecycle (state machine). "Waiting" is NOT a state: it is derived from
-- unmet dependencies (see task_board view).
create type public.task_status as enum (
  'draft',        -- requirements and ownership being established
  'ready',        -- prerequisites satisfied, can be started
  'in_progress',  -- owner is working on it
  'blocked',      -- a confirmed blocker prevents progress
  'in_review',    -- submitted for verification
  'completed',    -- reviewer accepted the outcome
  'cancelled'     -- authorised cancellation
);

create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');

-- How the task object was created
create type public.task_source as enum ('manual', 'ai_breakdown', 'discussion', 'agent');

-- Dependency types. MVP only allows finish_to_start (see check constraint).
create type public.dependency_type as enum (
  'finish_to_start',   -- B starts after A finishes
  'start_to_start',    -- B starts after A starts
  'finish_to_finish',  -- B finishes after A finishes
  'start_to_finish'    -- B finishes after A starts
);

create type public.blocker_category as enum (
  'approval', 'information', 'dependency', 'resource', 'technical', 'external', 'other'
);

-- potential = inferred by AI, not confirmed by a human
-- reported  = reported by a person through the structured flow
-- confirmed = validated by owner / group admin (blocks the task)
create type public.blocker_status as enum ('potential', 'reported', 'confirmed', 'resolved', 'dismissed');

create type public.blocker_source as enum ('manual', 'ai_inferred');

create type public.invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');

create type public.risk_level as enum ('low', 'medium', 'high', 'critical');

create type public.evidence_kind as enum ('link', 'file', 'note');

create type public.actor_kind as enum ('user', 'system', 'ai', 'agent');

create type public.ai_suggestion_kind as enum (
  'create_task',
  'subtask_breakdown',
  'assign_owner',
  'assign_role',
  'update_status',
  'update_progress',
  'report_blocker',
  'add_dependency',
  'risk_assessment',
  'progress_summary',
  'starting_advice',
  'recommendation'
);

create type public.ai_suggestion_status as enum ('pending', 'accepted', 'rejected', 'applied', 'expired');

create type public.ai_source_type as enum (
  'group_message', 'task_comment', 'context_document', 'task', 'group_goal', 'schedule'
);

create type public.agent_scope as enum ('personal', 'group', 'organisation');
