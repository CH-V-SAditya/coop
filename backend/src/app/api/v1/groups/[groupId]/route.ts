import { z } from "zod";
import { getGroupWithViewer } from "@/lib/domain";
import { ApiError, check, parseBody, route } from "@/lib/http";

/** GET /api/v1/groups/:groupId: group, members (with functional roles) and the caller's rights. */
export const GET = route<{ groupId: string }>(async ({ supabase, params, user }) => {
  const { group, viewer } = await getGroupWithViewer(supabase, params.groupId, user.id);
  const [members, org] = await Promise.all([
    supabase.from("group_member_directory").select("*").eq("group_id", group.id).order("joined_at"),
    supabase.from("organisations").select("id, name, task_key_prefix").eq("id", group.organisation_id).single(),
  ]);
  return { group, organisation: check(org), members: check(members), viewer };
});

const UpdateGroup = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  goal: z.string().trim().max(4000).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  members_can_upload_context: z.boolean().optional(),
});

/** PATCH /api/v1/groups/:groupId: group admin edits name / goal / context policy. */
export const PATCH = route<{ groupId: string }>(async ({ req, supabase, params }) => {
  const body = await parseBody(req, UpdateGroup);
  const rows = check(await supabase.from("groups").update(body).eq("id", params.groupId).select()) as unknown[];
  if (rows.length === 0) throw new ApiError(403, "Only a group admin can edit this group");
  return rows[0];
});
