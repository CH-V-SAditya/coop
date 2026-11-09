import { z } from "zod";
import { env } from "@/lib/env";
import { check, parseBody, route } from "@/lib/http";
import { CreateInvitation, createInvitation } from "@/lib/invitations";

/** GET /api/v1/organisations/:orgId/invitations: pending invitations visible to the caller. */
export const GET = route<{ orgId: string }>(async ({ supabase, params }) => {
  const rows = check(
    await supabase
      .from("invitations")
      .select("id, email, org_role, group_role, functional_role, status, expires_at, created_at, token, group:groups(id, name)")
      .eq("organisation_id", params.orgId)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ) as { token: string }[];
  return rows.map((r) => ({ ...r, invite_url: `${env.frontendUrl}/invite/${r.token}` }));
});

/** POST /api/v1/organisations/:orgId/invitations: invite to the organisation (optionally a group). */
export const POST = route<{ orgId: string }>(async ({ req, supabase, params }) => {
  const body = await parseBody(req, CreateInvitation.extend({ group_id: z.uuid().optional() }));
  return createInvitation(supabase, params.orgId, body.group_id ?? null, body);
});
