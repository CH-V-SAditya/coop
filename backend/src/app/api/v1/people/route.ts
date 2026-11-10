import { z } from "zod";
import { check, openRoute, parseBody } from "@/lib/http";
import { createActorClient } from "@/lib/supabase/server";

/**
 * GET /api/v1/people: everyone in the workspace (prototype mode: used by the "Who are you?" picker
 * and by "add an existing person"). Deliberately read WITHOUT an acting person: requests made as a
 * person obey Row Level Security and would only see people who share an organisation with them.
 * This endpoint goes away when sign-in returns.
 */
export const GET = openRoute(async () => {
  return check(
    await createActorClient(null).from("profiles").select("id, full_name, email, job_title, avatar_url, created_at").order("full_name"),
  );
});

const CreatePerson = z.object({
  full_name: z.string().trim().min(2).max(120),
  email: z.union([z.email(), z.literal("")]).optional(),
  job_title: z.string().trim().max(120).optional(),
});

/** POST /api/v1/people: add a person (prototype mode: people exist without sign-in accounts). */
export const POST = openRoute(async ({ req, supabase }) => {
  const b = await parseBody(req, CreatePerson);
  return check(
    await supabase
      .rpc("create_person", { p_full_name: b.full_name, p_email: b.email || null, p_job_title: b.job_title || null })
      .single(),
  );
});
