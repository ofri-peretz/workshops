import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { saveSession } from "@/lib/session";

// The callback page hands over the tokens from the magic link. Only the owner's email is accepted.
export async function POST(request: Request) {
  const { access_token, refresh_token, expires_in } = await request.json().catch(() => ({}));
  if (typeof access_token !== "string" || typeof refresh_token !== "string") return NextResponse.json({ error: "Missing tokens" }, { status: 400 });
  const r = await fetch(`${env.supabaseUrl()}/auth/v1/user`, { headers: { apikey: env.anonKey(), authorization: `Bearer ${access_token}` } });
  const user = r.ok ? await r.json() : null;
  if (!user || user.email?.toLowerCase() !== env.ownerEmail().toLowerCase()) return NextResponse.json({ error: "This account can't use the console." }, { status: 403 });
  await saveSession({ access: access_token, refresh: refresh_token, expiresAt: Date.now() + Number(expires_in || 3600) * 1000 });
  return NextResponse.json({ ok: true });
}
