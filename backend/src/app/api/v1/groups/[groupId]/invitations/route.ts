import { ApiError, check, parseBody, route } from "@/lib/http";
import { CreateInvitation, createInvitation } from "@/lib/invitations";

/** POST /api/v1/groups/:groupId/invitations: group admin invites someone by email, with a role. */
export const POST = route<{ groupId: string }>(async ({ req, supabase, params }) => {
  const body = await parseBody(req, CreateInvitation);
  const group = check(
    await supabase.from("groups").select("organisation_id").eq("id", params.groupId).maybeSingle(),
  ) as { organisation_id: string } | null;
  if (!group) throw new ApiError(404, "Group not found");
  return createInvitation(supabase, group.organisation_id, params.groupId, body);
});
