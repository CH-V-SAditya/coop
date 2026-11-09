import { z } from "zod";
import { check, parseBody, route } from "@/lib/http";

const CreateOrganisation = z.object({ name: z.string().trim().min(2).max(120) });

/** POST /api/v1/organisations: create an organisation; caller becomes owner. */
export const POST = route(async ({ req, supabase }) => {
  const { name } = await parseBody(req, CreateOrganisation);
  return check(await supabase.rpc("create_organisation", { p_name: name }));
});
