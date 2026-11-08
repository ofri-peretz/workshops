import { readRoom } from "@/lib/room";
import { accessToken } from "@/lib/session";

// The big screen asks this every few seconds, so a new code reaches the projector without a reload.
export async function GET() {
  const jwt = await accessToken();
  if (!jwt) return Response.json({ error: "Sign in to the console first." }, { status: 401 });
  const { code, status } = await readRoom(jwt);
  return Response.json({ code, status }, { headers: { "cache-control": "no-store" } });
}
