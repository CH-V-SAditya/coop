import "server-only";

export const env = {
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  /**
   * Server-only secret key (Supabase -> Project Settings -> API Keys -> Secret key).
   * Prototype mode has no sign-in, so the API talks to Postgres with this key and
   * tells the database which person it is acting as. Never expose it to the browser.
   */
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  /** Comma-separated list of origins allowed to call the API (the React frontend). */
  allowedOrigins: (process.env.FRONTEND_ORIGINS ?? "http://localhost:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
};

export function assertConfigured() {
  if (!env.supabaseUrl || !env.supabaseSecretKey) {
    throw new Error("Backend is not configured: set SUPABASE_URL and SUPABASE_SECRET_KEY in backend/.env.local");
  }
}
