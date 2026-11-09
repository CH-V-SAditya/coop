import { z } from "zod";
import { PRIORITIES, getGroupWithViewer } from "@/lib/domain";
import { ApiError, check, parseBody, route } from "@/lib/http";

const BOARD_COLUMNS =
  "id, task_key, task_number, title, status, progress, priority, due_date, owner_id, owner_name, owner_avatar_url, owner_user_id, reviewer_id, parent_task_id, unmet_dependency_count, open_blocker_count, subtask_count, version, updated_at";

/** GET /api/v1/groups/:groupId/tasks: the group's board. */
export const GET = route<{ groupId: string }>(async ({ supabase, params }) => {
  return check(
    await supabase.from("task_board").select(BOARD_COLUMNS).eq("group_id", params.groupId).order("task_number"),
  );
});

const CreateTask = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(10000).optional(),
  acceptance_criteria: z.string().trim().max(5000).optional(),
  owner_id: z.uuid().nullable().optional(),
  reviewer_id: z.uuid().nullable().optional(),
  parent_task_id: z.uuid().nullable().optional(),
  priority: z.enum(PRIORITIES).default("medium"),
  start_date: z.iso.date().nullable().optional(),
  due_date: z.iso.date().nullable().optional(),
  estimate_hours: z.number().min(0).max(10000).nullable().optional(),
});

/** POST /api/v1/groups/:groupId/tasks: manual (structured) task creation. Tasks are born as drafts. */
export const POST = route<{ groupId: string }>(async ({ req, supabase, params, user }) => {
  const body = await parseBody(req, CreateTask);
  const { group, viewer } = await getGroupWithViewer(supabase, params.groupId, user.id);
  if (!viewer.permissions.canCreateTasks) throw new ApiError(403, "You don't have permission to create tasks in this group");

  return check(
    await supabase
      .from("tasks")
      .insert({ ...body, organisation_id: group.organisation_id, group_id: group.id })
      .select("id, task_number, title, status")
      .single(),
  );
});
