import { check, route } from "@/lib/http";

/** GET /api/v1/me/tasks: tasks owned by the caller across all groups (clearance dashboard). */
export const GET = route(async ({ supabase, user }) => {
  const tasks = check(
    await supabase
      .from("task_board")
      .select(
        "id, task_key, title, status, progress, priority, due_date, group_id, completed_at, status_changed_at, unmet_dependency_count, open_blocker_count",
      )
      .eq("owner_user_id", user.id)
      .order("due_date", { ascending: true, nullsFirst: false }),
  ) as { group_id: string }[];

  const groupIds = [...new Set(tasks.map((t) => t.group_id))];
  const groups = groupIds.length
    ? (check(await supabase.from("groups").select("id, name").in("id", groupIds)) as { id: string; name: string }[])
    : [];
  return { tasks, groups };
});
