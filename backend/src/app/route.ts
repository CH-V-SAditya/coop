/** GET /: health check. */
export function GET() {
  return Response.json({ name: "Coop API", version: "v1", status: "ok" });
}
