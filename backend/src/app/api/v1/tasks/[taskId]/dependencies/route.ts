import { z } from "zod";
import { check, parseBody, route } from "@/lib/http";

const AddDependency = z.object({
  /** The task that must finish before this one can start. */
  predecessor_id: z.uuid(),
  type: z.literal("finish_to_start").default("finish_to_start"),
});

/** POST /api/v1/tasks/:taskId/dependencies: link a prerequisite (cycle-checked in Postgres). */
export const POST = route<{ taskId: string }>(async ({ req, supabase, params }) => {
  const body = await parseBody(req, AddDependency);
  return check(
    await supabase.rpc("add_task_dependency", {
      p_predecessor_id: body.predecessor_id,
      p_successor_id: params.taskId,
      p_type: body.type,
    }),
  );
});
