import { ApiError, check, route } from "@/lib/http";

/** GET /api/v1/invitations/:token: preview an invitation before accepting. */
export const GET = route<{ token: string }>(async ({ supabase, params }) => {
  const rows = check(await supabase.rpc("get_invitation", { p_token: params.token })) as unknown[];
  if (!rows?.length) throw new ApiError(404, "Invitation not found");
  return rows[0];
});
