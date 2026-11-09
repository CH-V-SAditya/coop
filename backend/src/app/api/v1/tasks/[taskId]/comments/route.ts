import { z } from "zod";
import { ApiError, check, parseBody, route } from "@/lib/http";

const NewComment = z.object({ body: z.string().trim().min(1).max(5000) });

/** POST /api/v1/tasks/:taskId/comments: task-specific discussion (natural interaction). */
export const POST = route<{ taskId: string }>(async ({ req, supabase, params, user }) => {
  const { body } = await parseBody(req, NewComment);
  const task = check(
    await supabase.from("tasks").select("organisation_id").eq("id", params.taskId).maybeSingle(),
  ) as { organisation_id: string } | null;
  if (!task) throw new ApiError(404, "Task not found");

  return check(
    await supabase
      .from("task_comments")
      .insert({ organisation_id: task.organisation_id, task_id: params.taskId, author_id: user.id, body })
      .select()
      .single(),
  );
});
