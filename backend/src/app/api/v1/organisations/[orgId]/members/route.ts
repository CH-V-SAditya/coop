import { check, route } from "@/lib/http";

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
