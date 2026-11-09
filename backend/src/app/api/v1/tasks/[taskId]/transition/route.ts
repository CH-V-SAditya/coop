import { z } from "zod";
import { TASK_STATUSES } from "@/lib/domain";
import { check, parseBody, route } from "@/lib/http";

const Transition = z.object({
  to: z.enum(TASK_STATUSES),
  reason: z.string().trim().max(2000).optional(),
  expected_version: z.number().int().optional(),
});

/** POST /api/v1/tasks/:taskId/transition: the only way to change a task's status. */
export const POST = route<{ taskId: string }>(async ({ req, supabase, params }) => {
  const body = await parseBody(req, Transition);
  return check(
    await supabase.rpc("transition_task", {
      p_task_id: params.taskId,
      p_to_status: body.to,
      p_reason: body.reason || null,
      p_expected_version: body.expected_version ?? null,
    }),
  );
});
