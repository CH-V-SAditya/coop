-- ============================================================================
-- Coop: prototype mode WITHOUT sign-in
--
-- Sign-in is switched off while features are built. Instead of a logged-in
-- user, the backend says which person it is "acting as" on every request, and
-- this migration makes Postgres treat that person exactly like a signed-in
-- user. auth.uid() returns them, so every engine function and permission check
-- written for real sign-in keeps working unchanged.
--
-- Trust boundary: the acting person is honoured ONLY for requests made with
-- the server-side secret key (role service_role), which lives in the backend's
-- environment and never in the browser. The public (publishable/anon) key
-- cannot use it.
--
-- Turning sign-in back on later: unset pgrst.db_pre_request, re-add the
-- profiles -> auth.users foreign key, and have the backend forward user JWTs
-- again (see PLAN.md, "Prototype mode without sign-in").
-- ============================================================================

-- 1. People no longer need an auth account ------------------------------------
alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles alter column id set default gen_random_uuid();
alter table public.profiles alter column email drop not null;

-- 2. "Acting as" hook -------------------------------------------------------------
-- PostgREST runs this before every API request. For service_role requests that
-- carry an `X-Coop-Actor: <profile id>` header, it sets the JWT subject for the
-- current transaction, which is what auth.uid() reads.
create or replace function public.coop_pre_request()
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_actor uuid;
begin
  if current_user <> 'service_role' then
    return;
  end if;
  v_actor := public.try_uuid(nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-coop-actor');
  if v_actor is null then
    return;
  end if;
  perform set_config('request.jwt.claim.sub', v_actor::text, true);
end;
$$;

-- Runs for every role (it returns immediately for anything but service_role).
grant execute on function public.coop_pre_request() to anon, authenticated, service_role;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticator') then
    execute 'alter role authenticator set pgrst.db_pre_request to ''public.coop_pre_request''';
    perform pg_notify('pgrst', 'reload config');
  end if;
end;
$$;

-- 3. Create a person -------------------------------------------------------------
create or replace function public.create_person(
  p_full_name  text,
  p_email      text default null,
  p_job_title  text default null
)
returns public.profiles
language plpgsql security definer set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  if char_length(coalesce(trim(p_full_name), '')) < 2 then
    raise exception 'Name must be at least 2 characters' using errcode = '23514';
  end if;

  insert into public.profiles (full_name, email, job_title)
  values (trim(p_full_name), nullif(lower(trim(p_email)), ''), nullif(trim(p_job_title), ''))
  returning * into v_profile;

  return v_profile;
end;
$$;

-- 4. Add a person to an organisation (owners and admins only) ---------------------
create or replace function public.add_organisation_member(
  p_organisation_id  uuid,
  p_user_id          uuid,
  p_role             public.org_role default 'member',
  p_title            text default null
)
returns public.organisation_members
language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.organisation_members;
begin
  if not public.is_org_admin(p_organisation_id) then
    raise exception 'Only organisation owners and admins can add people' using errcode = '42501';
  end if;
  if p_role = 'owner' then
    raise exception 'An organisation has exactly one owner' using errcode = '23514';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Person not found' using errcode = 'P0002';
  end if;

  select * into v_row from public.organisation_members
  where organisation_id = p_organisation_id and user_id = p_user_id;
  if found then
    return v_row;   -- already a member: adding again is a no-op
  end if;

  insert into public.organisation_members (organisation_id, user_id, role, title)
  values (p_organisation_id, p_user_id, p_role, nullif(trim(p_title), ''))
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.create_person(text, text, text) from public, anon;
revoke execute on function public.add_organisation_member(uuid, uuid, public.org_role, text) from public, anon;
grant execute on function public.create_person(text, text, text) to authenticated, service_role;
grant execute on function public.add_organisation_member(uuid, uuid, public.org_role, text) to authenticated, service_role;
