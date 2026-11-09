import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { env } from "@/lib/env";
import { check } from "@/lib/http";

export const CreateInvitation = z.object({
  email: z.email(),
  org_role: z.enum(["member", "admin"]).default("member"),
  group_role: z.enum(["member", "admin"]).default("member"),
  /** Functional role inside the group (e.g. "Frontend"). Empty = let the AI infer it later. */
  functional_role: z.string().trim().max(80).optional(),
});

export async function createInvitation(
  supabase: SupabaseClient,
  orgId: string,
  groupId: string | null,
  body: z.infer<typeof CreateInvitation>,
) {
  const invitation = check(
    await supabase.rpc("create_invitation", {
      p_organisation_id: orgId,
      p_email: body.email,
      p_group_id: groupId,
      p_org_role: body.org_role,
      p_group_role: body.group_role,
      p_functional_role: body.functional_role || null,
    }),
  ) as { token: string };

  // Email delivery is a later phase: return a link the inviter can share.
  return { ...invitation, invite_url: `${env.frontendUrl}/invite/${invitation.token}` };
}
