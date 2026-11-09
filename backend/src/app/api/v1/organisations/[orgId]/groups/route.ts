import { z } from "zod";
import { check, parseBody, route } from "@/lib/http";

/** GET /api/v1/organisations/:orgId/groups: groups visible to the caller, with counts. */
export const GET = route<{ orgId: string }>(async ({ supabase, params, user }) => {
  const groups = check(
    await supabase
      .from("groups")
      .select("id, name, goal, description, created_at, group_members(count)")
      .eq("organisation_id", params.orgId)
      .is("archived_at", null)
      .order("created_at"),
  ) as { id: string }[];

  const ids = groups.map((g) => g.id);
  const [tasks, mine] = await Promise.all([
    ids.length
      ? supabase.from("tasks").select("group_id, status").in("group_id", ids)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("group_member_directory").select("group_id, role").eq("user_id", user.id).in("group_id", ids),
  ]);
  const taskRows = check(tasks) as { group_id: string; status: string }[];
  const myRoles = Object.fromEntries((check(mine) as { group_id: string; role: string }[]).map((r) => [r.group_id, r.role]));

  return groups.map((g) => {
    const own = taskRows.filter((t) => t.group_id === g.id && t.status !== "cancelled");
    return {
      ...g,
      my_role: myRoles[g.id] ?? null,
      task_total: own.length,
      task_completed: own.filter((t) => t.status === "completed").length,
      task_blocked: own.filter((t) => t.status === "blocked").length,
    };
  });
});

const CreateGroup = z.object({
  name: z.string().trim().min(2).max(120),
  goal: z.string().trim().max(4000).optional(),
  description: z.string().trim().max(2000).optional(),
  functional_role: z.string().trim().max(80).optional(),
});

/** POST /api/v1/organisations/:orgId/groups: caller becomes group admin. */
export const POST = route<{ orgId: string }>(async ({ req, supabase, params }) => {
  const body = await parseBody(req, CreateGroup);
  return check(
    await supabase.rpc("create_group", {
      p_organisation_id: params.orgId,
      p_name: body.name,
      p_goal: body.goal ?? null,
      p_description: body.description ?? null,
      p_functional_role: body.functional_role ?? null,
    }),
  );
});
