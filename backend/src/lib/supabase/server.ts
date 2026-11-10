import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { assertConfigured, env } from "@/lib/env";

/** Header that tells Postgres which person the API is acting as (see migration 800). */
export const ACTOR_HEADER = "x-coop-actor";

/**
 * Prototype mode (no sign-in): a server-side client that acts AS a person.
 * Postgres' pre-request hook reads the actor header and makes auth.uid() return
 * that person, so the task engine's permission checks still apply. With no
 * actor (e.g. listing or creating people), auth.uid() is null.
 */
export function createActorClient(actorId: string | null): SupabaseClient {
  assertConfigured();
  return createClient(env.supabaseUrl, env.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: actorId ? { [ACTOR_HEADER]: actorId } : {} },
  });
}
