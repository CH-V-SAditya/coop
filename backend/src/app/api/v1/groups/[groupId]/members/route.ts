import { z } from "zod";
import { check, parseBody, route } from "@/lib/http";

const AddMember = z.object({
  organisation_member_id: z.uuid(),
  role: z.enum(["member", "admin"]).default("member"),
  /** e.g. "Frontend". Leave empty and the AI will propose one from the group's context. */
  functional_role: z.string().trim().max(80).optional(),
  can_create_tasks: z.boolean().default(false),
  can_schedule_tasks: z.boolean().default(false),
  can_assign_tasks: z.boolean().default(false),
  can_upload_context: z.boolean().default(false),
});

/** POST /api/v1/groups/:groupId/members: group admin adds an existing organisation member. */
export const POST = route<{ groupId: string }>(async ({ req, supabase, params }) => {
  const b = await parseBody(req, AddMember);
  return check(
    await supabase.rpc("add_group_member", {
      p_group_id: params.groupId,
      p_organisation_member_id: b.organisation_member_id,
      p_role: b.role,
      p_functional_role: b.functional_role || null,
      p_can_create_tasks: b.can_create_tasks,
      p_can_schedule_tasks: b.can_schedule_tasks,
      p_can_assign_tasks: b.can_assign_tasks,
      p_can_upload_context: b.can_upload_context,
    }),
  );
});
