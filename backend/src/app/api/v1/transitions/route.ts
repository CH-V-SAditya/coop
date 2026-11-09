import { check, route } from "@/lib/http";

/** GET /api/v1/transitions: the task state machine, as stored in Postgres. */
export const GET = route(async ({ supabase }) => {
  return check(await supabase.from("task_status_transitions").select("*"));
});
