-- =============================================================================
-- Local stand-ins for the parts of a Supabase database that Coop's migrations
-- rely on. Used ONLY by the local test stack (scripts/local-stack.mjs); never
-- applied to a real Supabase project, which already has all of this.
--
-- Mirrors Supabase's definitions where behaviour matters (roles, auth.uid(),
-- auth.jwt(), the authenticator role PostgREST logs in as).
-- =============================================================================

-- Roles (cluster-wide, so they survive a database rebuild: create only if missing) ---
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator login noinherit; end if;
end
$$;
grant anon, authenticated, service_role to authenticator;

-- Schemas and extensions --------------------------------------------------------
create schema auth;
create schema extensions;
create schema storage;
grant usage on schema public, auth, extensions, storage to anon, authenticated, service_role;

-- auth --------------------------------------------------------------------------
create table auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text,
  raw_user_meta_data  jsonb default '{}'::jsonb,
  email_confirmed_at  timestamptz,
  banned_until        timestamptz,
  created_at          timestamptz not null default now()
);

-- Same definitions as Supabase: PostgREST puts the JWT claims in request.jwt.claims.
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
create function auth.role() returns text language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$$;
grant execute on function auth.uid(), auth.role(), auth.jwt() to anon, authenticated, service_role;

-- storage -------------------------------------------------------------------------
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint);
create table storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets (id),
  name       text,
  owner      uuid,
  created_at timestamptz not null default now()
);
alter table storage.objects enable row level security;
grant all on storage.objects, storage.buckets to authenticated, service_role;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;

-- Realtime publication (Supabase creates it; migrations add tables to it).
create publication supabase_realtime;

-- Default privileges, as on Supabase --------------------------------------------
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
