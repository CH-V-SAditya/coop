-- ============================================================================
-- Coop: requests made on behalf of a person obey Row Level Security again
--
-- Migration 800 made auth.uid() return the acting person, but the request
-- still ran as service_role, which BYPASSES Row Level Security. Engine
-- functions checked permissions themselves, but anything that read or wrote a
-- table directly did not: a person could list another organisation's groups,
-- members and tasks, and edit or delete rows they had no rights to.
--
-- Fix: when the backend names an acting person, the pre-request hook now also
-- switches the request to the `authenticated` role. From that point the
-- request is indistinguishable from one made by that person signed in: every
-- RLS policy, column grant and engine check applies. Tenant isolation is
-- enforced by the database, not by each API route remembering to check.
--
-- Requests from the backend WITHOUT an acting person (listing and creating
-- people in prototype mode) still run as service_role.
--
-- The switch is transaction-local, so it never leaks into another request on
-- the same pooled connection. It is permitted because PostgREST's login role
-- (authenticator) is a member of `authenticated`.
-- ============================================================================

create or replace function public.coop_pre_request()
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_actor uuid;
begin
  -- Only the server-side secret key (service_role) may name an acting person.
  if current_user <> 'service_role' then
    return;
  end if;
  v_actor := public.try_uuid(nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-coop-actor');
  if v_actor is null then
    return;
  end if;
  perform set_config('request.jwt.claim.sub', v_actor::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  -- Drop the RLS bypass for the rest of this request.
  perform set_config('role', 'authenticated', true);
end;
$$;

grant execute on function public.coop_pre_request() to anon, authenticated, service_role;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticator') then
    perform pg_notify('pgrst', 'reload schema');
  end if;
end;
$$;
