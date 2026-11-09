import "server-only";

export const env = {
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseKey: process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "",
  /** Comma-separated list of origins allowed to call the API (the React frontend). */
  allowedOrigins: (process.env.FRONTEND_ORIGINS ?? "http://localhost:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  /** Public URL of the frontend, used to build invitation links. */
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",
};

export function assertConfigured() {
  if (!env.supabaseUrl || !env.supabaseKey) {
    throw new Error("Backend is not configured: set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in backend/.env.local");
  }
}
