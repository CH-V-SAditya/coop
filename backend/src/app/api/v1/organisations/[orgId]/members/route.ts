import { z } from "zod";
import { check, parseBody, route } from "@/lib/http";

/** GET /api/v1/organisations/:orgId/members */
export const GET = route<{ orgId: string }>(async ({ supabase, params }) => {
  return check(
    await supabase
      .from("organisation_members")
      .select("id, role, title, joined_at, user_id, profile:profiles(full_name, email, avatar_url, job_title)")
      .eq("organisation_id", params.orgId)
      .order("joined_at"),
  );
});

const AddOrgMember = z.object({
  user_id: z.uuid(),
  role: z.enum(["member", "admin"]).default("member"),
  title: z.string().trim().max(120).optional(),
});

/** POST /api/v1/organisations/:orgId/members: owners and admins add an existing person. */
export const POST = route<{ orgId: string }>(async ({ req, supabase, params }) => {
  const b = await parseBody(req, AddOrgMember);
  return check(
    await supabase
      .rpc("add_organisation_member", {
        p_organisation_id: params.orgId,
        p_user_id: b.user_id,
        p_role: b.role,
        p_title: b.title || null,
      })
      .single(),
  );
});
