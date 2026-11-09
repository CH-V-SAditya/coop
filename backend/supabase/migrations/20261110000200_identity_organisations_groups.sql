-- =============================================================================
-- Coop · Migration 2 · Profiles, organisations, groups, membership, invitations
-- =============================================================================

-- Shared trigger: keep updated_at fresh -----------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- PROFILES (1:1 with auth.users)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       extensions.citext not null,
  full_name   text,
  avatar_url  text,
  job_title   text,
  bio         text,
  timezone    text default 'UTC',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile automatically for every new auth user (email or Google).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- ORGANISATIONS
-- -----------------------------------------------------------------------------
create table public.organisations (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (char_length(name) between 2 and 120),
  slug             text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  task_key_prefix  text not null default 'COOP' check (task_key_prefix ~ '^[A-Z][A-Z0-9]{1,9}$'),
  next_task_number integer not null default 1,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger organisations_set_updated_at
  before update on public.organisations
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- ORGANISATION_MEMBERS
-- -----------------------------------------------------------------------------
create table public.organisation_members (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  role             public.org_role not null default 'member',
  title            text,                     -- job title inside this organisation
  joined_at        timestamptz not null default now(),
  unique (organisation_id, user_id),
  unique (organisation_id, id)              -- target for composite FKs
);

create index organisation_members_user_idx on public.organisation_members (user_id);

-- -----------------------------------------------------------------------------
-- GROUPS (management, engineering, operations, finance, a project team ...)
-- -----------------------------------------------------------------------------
create table public.groups (
  id                          uuid primary key default gen_random_uuid(),
  organisation_id             uuid not null references public.organisations (id) on delete cascade,
  name                        text not null check (char_length(name) between 2 and 120),
  description                 text,
  goal                        text,          -- the common task / goal of the group
  members_can_upload_context  boolean not null default false,
  created_by                  uuid references public.profiles (id) on delete set null,
  archived_at                 timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (organisation_id, name),
  unique (organisation_id, id)
);

create index groups_org_idx on public.groups (organisation_id);

create trigger groups_set_updated_at
  before update on public.groups
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- GROUP_MEMBERS
--   functional_role: "Frontend", "Backend", "Database" ... used by the AI to
--   break down and assign work. Null = AI may infer one (as a suggestion).
-- -----------------------------------------------------------------------------
create table public.group_members (
  id                      uuid primary key default gen_random_uuid(),
  organisation_id         uuid not null,
  group_id                uuid not null,
  organisation_member_id  uuid not null,
  role                    public.group_role not null default 'member',
  functional_role         text check (functional_role is null or char_length(functional_role) between 1 and 80),
  role_source             public.role_source,
  can_create_tasks        boolean not null default false,
  can_schedule_tasks      boolean not null default false,
  can_assign_tasks        boolean not null default false,
  can_upload_context      boolean not null default false,
  joined_at               timestamptz not null default now(),
  unique (group_id, organisation_member_id),
  -- composite FKs guarantee group and member belong to the same organisation
  foreign key (organisation_id, group_id)
    references public.groups (organisation_id, id) on delete cascade,
  foreign key (organisation_id, organisation_member_id)
    references public.organisation_members (organisation_id, id) on delete cascade,
  check ((functional_role is null) = (role_source is null))
);

create index group_members_member_idx on public.group_members (organisation_member_id);

-- -----------------------------------------------------------------------------
-- INVITATIONS (organisation-wide, optionally straight into a group with a role)
-- -----------------------------------------------------------------------------
create table public.invitations (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations (id) on delete cascade,
  group_id         uuid,
  email            extensions.citext not null,
  org_role         public.org_role not null default 'member' check (org_role <> 'owner'),
  group_role       public.group_role not null default 'member',
  functional_role  text,
  token            text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  status           public.invitation_status not null default 'pending',
  invited_by       uuid references public.profiles (id) on delete set null,
  expires_at       timestamptz not null default now() + interval '14 days',
  accepted_by      uuid references public.profiles (id) on delete set null,
  accepted_at      timestamptz,
  created_at       timestamptz not null default now(),
  foreign key (organisation_id, group_id)
    references public.groups (organisation_id, id) on delete cascade
);

create index invitations_email_idx on public.invitations (email) where status = 'pending';
create unique index invitations_one_pending_per_target
  on public.invitations (organisation_id, (coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid)), email)
  where status = 'pending';
