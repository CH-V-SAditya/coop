import { ApiError, check, route } from "@/lib/http";

/** DELETE /api/v1/organisations/:orgId/invitations/:invitationId: revoke a pending invitation. */
export const DELETE = route<{ orgId: string; invitationId: string }>(async ({ supabase, params }) => {
  const rows = check(
    await supabase
      .from("invitations")
      .update({ status: "revoked" })
      .eq("id", params.invitationId)
      .eq("organisation_id", params.orgId)
      .eq("status", "pending")
      .select("id"),
  ) as { id: string }[];
  if (rows.length === 0) throw new ApiError(404, "Invitation not found");
  return { ok: true };
});
