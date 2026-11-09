import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { assertConfigured, env } from "@/lib/env";

/**
 * A Supabase client that acts AS the calling user: their access token is
 * forwarded to PostgREST, so every query is subject to Row Level Security and
 * every engine function sees the right auth.uid().
 */
export function createUserClient(accessToken: string): SupabaseClient {
  assertConfigured();
  return createClient(env.supabaseUrl, env.supabaseKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
