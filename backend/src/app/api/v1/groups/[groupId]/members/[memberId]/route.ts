import { z } from "zod";
import { ApiError, check, parseBody, route } from "@/lib/http";

const UpdateMember = z.object({
  role: z.enum(["member", "admin"]).optional(),
  /** null clears the role (the AI may then propose one). */
  functional_role: z.string().trim().max(80).nullable().optional(),
  can_create_tasks: z.boolean().optional(),
  can_schedule_tasks: z.boolean().optional(),
  can_assign_tasks: z.boolean().optional(),
  can_upload_context: z.boolean().optional(),
});

/** PATCH /api/v1/groups/:groupId/members/:memberId (memberId = group_members.id) */
export const PATCH = route<{ groupId: string; memberId: string }>(async ({ req, supabase, params }) => {
  const body = await parseBody(req, UpdateMember);
  const update: Record<string, unknown> = { ...body };
  if (body.functional_role !== undefined) {
    const role = body.functional_role?.trim() || null;
    update.functional_role = role;
    update.role_source = role ? "admin" : null; // set by a human admin
  }
  const rows = check(
    await supabase.from("group_members").update(update).eq("id", params.memberId).eq("group_id", params.groupId).select(),
  ) as unknown[];
  if (rows.length === 0) throw new ApiError(403, "Only a group admin can change members");
  return rows[0];
});

/** DELETE /api/v1/groups/:groupId/members/:memberId: remove a member (or leave the group). */
export const DELETE = route<{ groupId: string; memberId: string }>(async ({ supabase, params }) => {
  const rows = check(
    await supabase.from("group_members").delete().eq("id", params.memberId).eq("group_id", params.groupId).select("id"),
  ) as unknown[];
  if (rows.length === 0) throw new ApiError(403, "You are not allowed to remove this member");
  return { ok: true };
});
