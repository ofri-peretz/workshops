import "server-only";
import { cookies } from "next/headers";
import { env } from "./env";

const COOKIE = "console_session";

type Session = { access: string; refresh: string; expiresAt: number };

/** Supabase Auth over plain REST: the magic link signs the presenter in; the session lives in an HttpOnly cookie. */
export async function sendSignInLink(email: string, origin: string) {
  const r = await fetch(`${env.supabaseUrl()}/auth/v1/otp?redirect_to=${encodeURIComponent(origin + "/auth/callback")}`, {
    method: "POST",
    headers: { apikey: env.anonKey(), "content-type": "application/json" },
    body: JSON.stringify({ email, create_user: false }),
  });
  if (!r.ok) throw new Error(`Supabase refused to send the link (${r.status}): ${(await r.text()).slice(0, 160)}`);
}

export async function saveSession(s: Session) {
  (await cookies()).set(COOKIE, JSON.stringify(s), { httpOnly: true, secure: process.env.VERCEL === "1", sameSite: "strict", path: "/", maxAge: 12 * 3600 });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

/** The signed-in presenter's access token, refreshed when it is about to expire; null when signed out. */
export async function accessToken(): Promise<string | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  let s: Session;
  try { s = JSON.parse(raw); } catch { return null; }
  if (Date.now() < s.expiresAt - 60_000) return s.access;
  const r = await fetch(`${env.supabaseUrl()}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: env.anonKey(), "content-type": "application/json" },
    body: JSON.stringify({ refresh_token: s.refresh }),
  });
  if (!r.ok) return null;
  const t = await r.json();
  const next = { access: t.access_token, refresh: t.refresh_token, expiresAt: Date.now() + t.expires_in * 1000 };
  try { await saveSession(next); } catch { /* read-only context (a page render): the next action saves it */ }
  return next.access;
}
