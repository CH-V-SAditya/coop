import { check, route } from "@/lib/http";

/** POST /api/v1/invitations/:token/accept */
export const POST = route<{ token: string }>(async ({ supabase, params }) => {
  return check(await supabase.rpc("accept_invitation", { p_token: params.token }));
});
