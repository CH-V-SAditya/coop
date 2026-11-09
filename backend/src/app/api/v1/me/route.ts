import { z } from "zod";
import { check, parseBody, route } from "@/lib/http";

/** GET /api/v1/me: profile + organisation memberships. */
export const GET = route(async ({ supabase, user }) => {
  const [profile, memberships] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("organisation_members")
      .select("id, role, title, joined_at, organisation:organisations(id, name, slug, task_key_prefix)")
      .eq("user_id", user.id)
      .order("joined_at"),
  ]);
  return { profile: check(profile), memberships: check(memberships) };
});

const ProfileUpdate = z.object({
  full_name: z.string().trim().min(1).max(120).optional(),
  job_title: z.string().trim().max(120).nullable().optional(),
  bio: z.string().trim().max(1000).nullable().optional(),
  timezone: z.string().trim().max(64).optional(),
  avatar_url: z.url().nullable().optional(),
});

/** PATCH /api/v1/me: update own profile. */
export const PATCH = route(async ({ req, supabase, user }) => {
  const body = await parseBody(req, ProfileUpdate);
  return check(await supabase.from("profiles").update(body).eq("id", user.id).select().single());
});
