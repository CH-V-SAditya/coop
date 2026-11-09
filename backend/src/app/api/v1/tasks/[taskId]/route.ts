import { z } from "zod";
import { PRIORITIES, availableTransitions, getGroupWithViewer, profileMap, type TaskStatus } from "@/lib/domain";
import { ApiError, check, parseBody, route } from "@/lib/http";

const RELATED_COLUMNS = "id, task_key, title, status, progress, owner_name, due_date, unmet_dependency_count";

type TaskRow = {
  id: string;
  group_id: string;
  organisation_id: string;
  status: TaskStatus;
  owner_id: string | null;
  reviewer_id: string | null;
  created_by: string | null;
  parent_task_id: string | null;
  unmet_dependency_count: number;
};

/**
 * GET /api/v1/tasks/:taskId: the full task object: identity, ownership,
 * lifecycle, dependencies, blockers, timeline, evidence, history, intelligence.
 */
export const GET = route<{ taskId: string }>(async ({ supabase, params, user }) => {
  const task = check(await supabase.from("task_board").select("*").eq("id", params.taskId).maybeSingle()) as TaskRow | null;
  if (!task) throw new ApiError(404, "Task not found");

  const { group, viewer } = await getGroupWithViewer(supabase, task.group_id, user.id);

  const [predRes, succRes, blockersRes, eventsRes, commentsRes, subtasksRes, membersRes, rulesRes, evidenceRes, suggestionsRes] =
    await Promise.all([
      supabase.from("task_dependencies").select("id, predecessor_id, dependency_type, created_at").eq("successor_id", task.id),
      supabase.from("task_dependencies").select("id, successor_id, dependency_type, created_at").eq("predecessor_id", task.id),
      supabase.from("task_blockers").select("*").eq("task_id", task.id).order("created_at", { ascending: false }),
      supabase.from("task_events").select("*").eq("task_id", task.id).order("id", { ascending: false }).limit(200),
      supabase.from("task_comments").select("*").eq("task_id", task.id).order("created_at"),
      supabase.from("task_board").select(RELATED_COLUMNS).eq("parent_task_id", task.id).order("task_number"),
      supabase.from("group_member_directory").select("*").eq("group_id", task.group_id).order("joined_at"),
      supabase.from("task_status_transitions").select("*"),
      supabase.from("task_evidence").select("*").eq("task_id", task.id).order("created_at", { ascending: false }),
      supabase.from("ai_suggestions").select("*").eq("task_id", task.id).eq("status", "pending"),
    ]);

  const preds = check(predRes) as { id: string; predecessor_id: string; dependency_type: string }[];
  const succs = check(succRes) as { id: string; successor_id: string; dependency_type: string }[];
  const blockers = check(blockersRes) as { status: string; reported_by: string | null }[];
  const events = check(eventsRes) as { actor_id: string | null }[];
  const comments = check(commentsRes) as { author_id: string | null }[];

  const relatedIds = [...preds.map((d) => d.predecessor_id), ...succs.map((d) => d.successor_id)];
  if (task.parent_task_id) relatedIds.push(task.parent_task_id);
  const related = relatedIds.length
    ? (check(await supabase.from("task_board").select(RELATED_COLUMNS).in("id", relatedIds)) as { id: string }[])
    : [];
  const byId = Object.fromEntries(related.map((t) => [t.id, t]));

  const people = await profileMap(supabase, [
    ...events.map((e) => e.actor_id),
    ...comments.map((c) => c.author_id),
    ...blockers.map((b) => b.reported_by),
  ]);

  const confirmed = blockers.filter((b) => b.status === "confirmed").length;
  const isOwner = task.owner_id !== null && task.owner_id === viewer.memberId;

  return {
    task,
    group: { id: group.id, name: group.name, organisation_id: group.organisation_id },
    parent: task.parent_task_id ? (byId[task.parent_task_id] ?? null) : null,
    dependencies: preds.map((d) => ({ id: d.id, type: d.dependency_type, task: byId[d.predecessor_id] ?? null })),
    dependents: succs.map((d) => ({ id: d.id, type: d.dependency_type, task: byId[d.successor_id] ?? null })),
    blockers,
    events,
    comments,
    evidence: check(evidenceRes),
    subtasks: check(subtasksRes),
    members: check(membersRes),
    suggestions: check(suggestionsRes),
    people,
    viewer,
    transitions: availableTransitions(check(rulesRes) as never, task, viewer, confirmed),
    can: {
      edit: viewer.isGroupAdmin || task.created_by === user.id || isOwner || viewer.permissions.canScheduleTasks,
      assign: viewer.permissions.canAssignTasks,
      manageBlockers: viewer.isGroupAdmin || isOwner,
      updateProgress: viewer.isGroupAdmin || isOwner,
      createSubtask: viewer.permissions.canCreateTasks,
      delete: viewer.isGroupAdmin && (task.status === "draft" || task.status === "cancelled"),
    },
  };
});

const UpdateTask = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(10000).nullable().optional(),
  acceptance_criteria: z.string().trim().max(5000).nullable().optional(),
  owner_id: z.uuid().nullable().optional(),
  reviewer_id: z.uuid().nullable().optional(),
  parent_task_id: z.uuid().nullable().optional(),
  progress: z.number().int().min(0).max(100).optional(),
  priority: z.enum(PRIORITIES).optional(),
  start_date: z.iso.date().nullable().optional(),
  due_date: z.iso.date().nullable().optional(),
  estimate_hours: z.number().min(0).max(10000).nullable().optional(),
  /** Optimistic concurrency: the version the client last saw. */
  expected_version: z.number().int().optional(),
});

/** PATCH /api/v1/tasks/:taskId: edit details / progress / owner. Status is NOT editable here. */
export const PATCH = route<{ taskId: string }>(async ({ req, supabase, params }) => {
  const { expected_version, ...changes } = await parseBody(req, UpdateTask);
  if (Object.keys(changes).length === 0) throw new ApiError(422, "Nothing to update");

  let query = supabase.from("tasks").update(changes).eq("id", params.taskId);
  if (expected_version !== undefined) query = query.eq("version", expected_version);
  const rows = check(await query.select("id, version")) as unknown[];

  if (rows.length === 0) {
    if (expected_version !== undefined) throw new ApiError(409, "This task was changed by someone else. Refresh and try again.");
    throw new ApiError(403, "You are not allowed to edit this task");
  }
  return rows[0];
});

/** DELETE /api/v1/tasks/:taskId: group admins may delete draft or cancelled tasks. */
export const DELETE = route<{ taskId: string }>(async ({ supabase, params }) => {
  const rows = check(await supabase.from("tasks").delete().eq("id", params.taskId).select("id")) as unknown[];
  if (rows.length === 0) throw new ApiError(403, "Only group admins can delete draft or cancelled tasks");
  return { ok: true };
});
