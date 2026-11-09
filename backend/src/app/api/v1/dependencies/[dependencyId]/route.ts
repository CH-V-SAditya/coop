import { check, route } from "@/lib/http";

/** DELETE /api/v1/dependencies/:dependencyId */
export const DELETE = route<{ dependencyId: string }>(async ({ supabase, params }) => {
  check(await supabase.rpc("remove_task_dependency", { p_dependency_id: params.dependencyId }));
  return { ok: true };
});
