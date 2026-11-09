import { z } from "zod";
import { BLOCKER_CATEGORIES } from "@/lib/domain";
import { check, parseBody, route } from "@/lib/http";

const ReportBlocker = z.object({
  title: z.string().trim().min(1).max(200),
  category: z.enum(BLOCKER_CATEGORIES).default("other"),
  description: z.string().trim().max(5000).optional(),
  blocking_task_id: z.uuid().nullable().optional(),
  resolution_owner_id: z.uuid().nullable().optional(),
  suggested_resolution: z.string().trim().max(2000).optional(),
  downstream_impact: z.string().trim().max(2000).optional(),
});

/** POST /api/v1/tasks/:taskId/blockers: structured "Report blocker". */
export const POST = route<{ taskId: string }>(async ({ req, supabase, params }) => {
  const b = await parseBody(req, ReportBlocker);
  return check(
    await supabase.rpc("report_blocker", {
      p_task_id: params.taskId,
      p_title: b.title,
      p_category: b.category,
      p_description: b.description || null,
      p_blocking_task_id: b.blocking_task_id ?? null,
      p_resolution_owner_id: b.resolution_owner_id ?? null,
      p_suggested_resolution: b.suggested_resolution || null,
      p_downstream_impact: b.downstream_impact || null,
    }),
  );
});
