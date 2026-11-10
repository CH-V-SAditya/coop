import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { z, type ZodType } from "zod";
import { ACTOR_HEADER, createActorClient } from "@/lib/supabase/server";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export type AuthedUser = { id: string; email: string | null };

export type RouteArgs<P> = {
  req: NextRequest;
  params: P;
  supabase: SupabaseClient;
  user: AuthedUser;
};

/** Postgres / PostgREST error codes raised by the task engine -> HTTP status. */
const STATUS_BY_CODE: Record<string, number> = {
  "28000": 401, // not authenticated
  "42501": 403, // insufficient privilege / not allowed
  P0002: 404, // not found
  PGRST116: 404, // .single() found no row
  "40001": 409, // stale version (optimistic concurrency)
  "23505": 409, // unique violation
  "23514": 422, // check violation / business rule
  "23503": 422, // foreign key violation
  "22P02": 422, // invalid input syntax (e.g. bad uuid)
  "0A000": 422, // feature not supported (e.g. non-FS dependency)
  P0001: 422,
};

type DbError = { code?: string; message: string; details?: string | null; hint?: string | null };

/** Throw an ApiError for a Supabase error, keeping the engine's human message. */
export function check<T>(result: { data: T; error: DbError | null }): T {
  if (result.error) {
    const { code, message } = result.error;
    const friendly =
      code === "23505" ? "That already exists." : message.replace(/^new row violates row-level security policy.*$/, "You are not allowed to do that.");
    const status = code?.startsWith("PGRST3") ? 401 : (code && STATUS_BY_CODE[code]) || (message.includes("row-level security") ? 403 : 400);
    throw new ApiError(status, friendly, code);
  }
  return result.data;
}

export async function parseBody<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "Request body must be JSON");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new ApiError(422, first ? `${first.path.join(".") || "body"}: ${first.message}` : "Invalid request");
  }
  return parsed.data;
}

export const uuid = z.uuid();

function assertUuidParams(params: Record<string, string>) {
  for (const [key, value] of Object.entries(params)) {
    if (key.endsWith("Id") && !uuid.safeParse(value).success) {
      throw new ApiError(404, "Not found");
    }
  }
}

/** Prototype mode (no sign-in): the frontend names the person it is acting as. */
function resolveActor(req: NextRequest): string | null {
  const actor = req.headers.get(ACTOR_HEADER)?.trim() ?? "";
  if (!actor) return null;
  if (!uuid.safeParse(actor).success) throw new ApiError(400, "Invalid person id");
  return actor;
}

type Handler<A> = (args: A) => Promise<unknown>;

function wrap<P extends Record<string, string>>(run: (req: NextRequest, params: P) => Promise<unknown>) {
  return async (req: NextRequest, ctx: { params: Promise<P> }) => {
    try {
      const params = ((await ctx?.params) ?? {}) as P;
      assertUuidParams(params);
      const result = await run(req, params);
      return Response.json(result ?? { ok: true });
    } catch (err) {
      if (err instanceof ApiError) {
        return Response.json({ error: err.message, code: err.code }, { status: err.status });
      }
      // Make a missing SUPABASE_SECRET_KEY obvious instead of a generic error.
      if (err instanceof Error && err.message.startsWith("Backend is not configured")) {
        return Response.json({ error: err.message, code: "NOT_CONFIGURED" }, { status: 500 });
      }
      console.error("[api] unhandled error", err);
      return Response.json({ error: "Something went wrong" }, { status: 500 });
    }
  };
}

/**
 * Wraps a route handler that acts as a person: requires the X-Coop-Actor
 * header, validates uuid path params, serialises the result as JSON and maps
 * errors to HTTP statuses.
 */
export function route<P extends Record<string, string> = Record<string, never>>(handler: Handler<RouteArgs<P>>) {
  return wrap<P>(async (req, params) => {
    const actor = resolveActor(req);
    if (!actor) throw new ApiError(401, "Choose who you are acting as first.", "NO_ACTOR");
    return handler({ req, params, supabase: createActorClient(actor), user: { id: actor, email: null } });
  });
}

/** Same as route(), for endpoints that work without a person (listing and creating people). */
export function openRoute<P extends Record<string, string> = Record<string, never>>(
  handler: Handler<Omit<RouteArgs<P>, "user"> & { user: AuthedUser | null }>,
) {
  return wrap<P>(async (req, params) => {
    const actor = resolveActor(req);
    return handler({ req, params, supabase: createActorClient(actor), user: actor ? { id: actor, email: null } : null });
  });
}
