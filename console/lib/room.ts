import "server-only";
import { createHmac, randomInt } from "node:crypto";
import { env } from "./env";

export type RoomState = {
  status: "closed" | "live" | "locked";
  openedAt: string | null;
  liveUntil: string | null;
  joinUntil: string | null;
  code: string | null;
};

const LIVE_MS = 2 * 3600_000;
const JOIN_MS = 60 * 60_000;

// The plain code exists only here, in this laptop's console process. Supabase keeps its HMAC.
let current: { code: string; openedAt: string } | null = null;

const rest = async (jwt: string, path: string, init: RequestInit = {}) => {
  const r = await fetch(`${env.supabaseUrl()}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: env.anonKey(), authorization: `Bearer ${jwt}`, "content-type": "application/json", prefer: "return=representation", ...init.headers },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 160)}`);
  return r.json();
};

const hmac = (code: string) => createHmac("sha256", env.codeSecret()).update(code).digest("hex");
const newCode = () => String(randomInt(1_000_000)).padStart(6, "0");

/** Writes the owner's row; RLS returns no row for anyone else, which we treat as a hard error. */
async function update(jwt: string, fields: Record<string, unknown>) {
  const rows = await rest(jwt, "relay_access?id=eq.1", { method: "PATCH", body: JSON.stringify(fields) });
  if (!rows.length) throw new Error("This account can't control the room. Sign in as the room's owner.");
  return rows[0];
}

export async function readRoom(jwt: string): Promise<RoomState> {
  const [a] = await rest(jwt, "relay_access?id=eq.1&select=opened_at,live_until,join_until,locked");
  const live = a && a.live_until && Date.parse(a.live_until) > Date.now();
  if (!live) current = null;
  const code = current && a && current.openedAt === a.opened_at && Date.parse(a.join_until) > Date.now() ? current.code : null;
  return {
    status: !live ? "closed" : a.locked ? "locked" : "live",
    openedAt: a?.opened_at ?? null,
    liveUntil: live ? a.live_until : null,
    joinUntil: live ? a.join_until : null,
    code,
  };
}

/** Empties the room into the chosen workshop, then opens it with a fresh code. */
export async function goLive(jwt: string, workshop: string) {
  await relayControl({ op: "start", w: Number(workshop) || workshop });
  const code = newCode(), now = Date.now();
  const row = await update(jwt, {
    opened_at: new Date(now).toISOString(),
    live_until: new Date(now + LIVE_MS).toISOString(),
    join_until: new Date(now + JOIN_MS).toISOString(),
    code_hmac: hmac(code),
    locked: false,
  });
  current = { code, openedAt: row.opened_at };
}

/** A new code for the same room: phones already in stay; the 60 minutes restart; a lock lifts. */
export async function newJoinCode(jwt: string) {
  const code = newCode();
  const row = await update(jwt, { join_until: new Date(Date.now() + JOIN_MS).toISOString(), code_hmac: hmac(code), locked: false });
  current = { code, openedAt: row.opened_at };
}

export async function closeRoom(jwt: string) {
  await update(jwt, { live_until: new Date().toISOString(), code_hmac: null });
  current = null;
}

export async function relayControl(body: Record<string, unknown>) {
  const r = await fetch(`${env.relayUrl()}/api/control?t=${encodeURIComponent(env.presenterToken())}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Relay refused the control (${r.status}). Check RELAY_URL and PRESENTER_TOKEN.`);
}
