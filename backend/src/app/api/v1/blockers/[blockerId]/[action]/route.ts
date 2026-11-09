import { z } from "zod";
import { ApiError, check, route } from "@/lib/http";

const Note = z.object({ note: z.string().trim().max(2000).optional() });

const RPC = {
  confirm: "confirm_blocker",
  resolve: "resolve_blocker",
  dismiss: "dismiss_blocker",
} as const;

/**
 * POST /api/v1/blockers/:blockerId/(confirm|resolve|dismiss)
 *   confirm: task moves in_progress -> blocked
 *   resolve/dismiss: last open blocker cleared -> task resumes in_progress
 */
export const POST = route<{ blockerId: string; action: string }>(async ({ req, supabase, params }) => {
  const fn = RPC[params.action as keyof typeof RPC];
  if (!fn) throw new ApiError(404, "Unknown blocker action");

  let raw: unknown = {};
  try {
    const text = await req.text();
    raw = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError(400, "Request body must be JSON");
  }
  const parsed = Note.safeParse(raw);
  if (!parsed.success) throw new ApiError(422, "Invalid note");

  const args: Record<string, unknown> = { p_blocker_id: params.blockerId };
  if (fn !== "confirm_blocker") args.p_note = parsed.data.note || null;
  return check(await supabase.rpc(fn, args));
});
