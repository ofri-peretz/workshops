import { accessToken } from "@/lib/session";
import { env } from "@/lib/env";

// The big screen (Relay's screen.html, served at /screen) calls /api/screen and /api/control.
// This forwards them to Relay with the presenter token, which never reaches the browser.
async function forward(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (!(await accessToken())) return Response.json({ error: "Sign in to the console first." }, { status: 401 });
  const { path } = await params;
  if (!["screen", "control", "status", "metrics"].includes(path.join("/"))) return Response.json({ error: "not found" }, { status: 404 });
  const target = new URL(`${env.relayUrl()}/api/${path.join("/")}`);
  target.searchParams.set("t", env.presenterToken());
  const r = await fetch(target, {
    method: request.method,
    headers: { "content-type": "application/json" },
    body: request.method === "GET" ? undefined : await request.text(),
    cache: "no-store",
  });
  return new Response(r.body, { status: r.status, headers: { "content-type": r.headers.get("content-type") ?? "application/json", "cache-control": "no-store" } });
}
export const GET = forward;
export const POST = forward;
