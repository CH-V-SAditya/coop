import { NextResponse, type NextRequest } from "next/server";

const allowedOrigins = (process.env.FRONTEND_ORIGINS ?? "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// Vite moves to the next free port (5174, 5175, ...) when 5173 is taken, so in development
// any localhost origin is accepted. In production only FRONTEND_ORIGINS is.
const isDev = process.env.NODE_ENV !== "production";
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/** CORS for the React frontend. Prototype mode: the person being acted as travels in X-Coop-Actor. */
export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "";
  const allowed = allowedOrigins.includes(origin) || (isDev && LOCAL_ORIGIN.test(origin));

  const corsHeaders: Record<string, string> = allowed
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,X-Coop-Actor",
        "Access-Control-Max-Age": "600",
        Vary: "Origin",
      }
    : {};

  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: allowed ? 204 : 403, headers: corsHeaders });
  }

  const response = NextResponse.next();
  Object.entries(corsHeaders).forEach(([key, value]) => response.headers.set(key, value));
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
