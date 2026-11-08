import { accessToken } from "@/lib/session";
import { env } from "@/lib/env";

// One run's raw engagement log as a file: every join, answer, message, tap and heartbeat, nothing derived.
export async function GET(request: Request) {
  if (!(await accessToken())) return Response.json({ error: "Sign in to the console first." }, { status: 401 });
  const r = Number(new URL(request.url).searchParams.get("r"));
  if (!Number.isInteger(r) || r < 1) return Response.json({ error: "which run? ?r=" }, { status: 400 });
  const res = await fetch(`${env.relayUrl()}/api/run-events?r=${r}&t=${encodeURIComponent(env.presenterToken())}`, { cache: "no-store" });
  return new Response(res.body, { status: res.status, headers: { "content-type": "application/json", "content-disposition": `attachment; filename="workshop-run-${r}.json"`, "cache-control": "no-store" } });
}
