import "server-only";
import { createHmac } from "node:crypto";
import { env } from "./env";

export type RoomState = {
  status: "closed" | "live" | "locked";
  openedAt: string | null;
  liveUntil: string | null;
  joinUntil: string | null;
  code: string | null;
};

const LIVE_MS = 2 * 3600_000;
const JOIN_MS = LIVE_MS; // the code works as long as the room is open; "Sign everyone out" replaces it

// The plain code is never stored: it is derived from the secret and the code's own expiry, so any
// console instance (laptop or Vercel) recomputes it. Supabase keeps only its HMAC.
const codeFor = (joinUntil: string) =>
  String(parseInt(createHmac("sha256", env.codeSecret()).update("code:" + Date.parse(joinUntil)).digest("hex").slice(0, 12), 16) % 1_000_000).padStart(6, "0");

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

/** Writes the owner's row; RLS returns no row for anyone else, which we treat as a hard error. */
async function update(jwt: string, fields: Record<string, unknown>) {
  const rows = await rest(jwt, "relay_access?id=eq.1", { method: "PATCH", body: JSON.stringify(fields) });
  if (!rows.length) throw new Error("This account can't control the room. Sign in as the room's owner.");
  return rows[0];
}

export async function readRoom(jwt: string): Promise<RoomState> {
  const [a] = await rest(jwt, "relay_access?id=eq.1&select=opened_at,live_until,join_until,locked,code_hmac");
  const live = a && a.live_until && Date.parse(a.live_until) > Date.now();
  const derived = live && a.join_until && Date.parse(a.join_until) > Date.now() ? codeFor(a.join_until) : null;
  const code = derived && hmac(derived) === a.code_hmac ? derived : null;
  return {
    status: !live ? "closed" : a.locked ? "locked" : "live",
    openedAt: a?.opened_at ?? null,
    liveUntil: live ? a.live_until : null,
    joinUntil: live ? a.join_until : null,
    code,
  };
}

/** Empties the room into the chosen workshop, then opens it with a fresh code. */
export async function goLive(jwt: string, workshop: string, { intro, audience, chapters, title, names }: { intro: string; audience: string; chapters?: string[]; title?: string; names?: string }) {
  await relayControl({ op: "start", wait: true, w: Number(workshop) || workshop, intro, a: audience, names, ...(chapters ? { c: chapters, title } : {}) });
  const now = Date.now(), joinUntil = new Date(now + JOIN_MS).toISOString();
  await update(jwt, {
    opened_at: new Date(now).toISOString(),
    live_until: new Date(now + LIVE_MS).toISOString(),
    join_until: joinUntil,
    code_hmac: hmac(codeFor(joinUntil)),
    locked: false,
  });
}

/** A new code for the same room: phones already in stay; the 60 minutes restart; a lock lifts. */
export async function newJoinCode(jwt: string) {
  const joinUntil = new Date(Date.now() + JOIN_MS).toISOString();
  await update(jwt, { join_until: joinUntil, code_hmac: hmac(codeFor(joinUntil)), locked: false });
}

export async function closeRoom(jwt: string) {
  await update(jwt, { live_until: new Date().toISOString(), code_hmac: null });
}

/** Whether the workshop has begun and how many phones are in. Null when the relay can't be read. */
export type Stage = { begun: boolean; people: number; title: string; step: number; steps: number; scene: string; present: number; answered: number | null; clock: number; total: number };
export async function readStage(): Promise<Stage | null> {
  const r = await fetch(`${env.relayUrl()}/api/screen?t=${encodeURIComponent(env.presenterToken())}`, { cache: "no-store" }).catch(() => null);
  if (!r?.ok) return null;
  const v = await r.json();
  return { begun: v.begun !== false, people: v.people, title: v.workshop ?? "", step: (v.i ?? 0) + 1, steps: v.n ?? 0, scene: v.scene?.title ?? "", present: v.present ?? v.people,
    answered: typeof v.results?.total === "number" ? v.results.total : null, clock: v.clock ?? 0, total: v.total ?? 0 };
}

/** Across every session: who picked one thing to do, and who said they did it a week later. */
export type Impact = { picked: number; followedUp: number; did: number; questions: { id: string; q: string; right: number; total: number }[] };
export async function readImpact(): Promise<Impact | null> {
  const r = await fetch(`${env.relayUrl()}/api/impact?t=${encodeURIComponent(env.presenterToken())}`, { cache: "no-store" }).catch(() => null);
  return r?.ok ? r.json() : null;
}

export type RunReport = {
  run: number; title: string;
  reach: { scanned: number; joined: number; phones: number };
  presence: { minute: number; present: number }[];
  churnRate: number | null; reconnectionRate: number | null;
  polls: { id: string; q: string; answered: number; present: number; rate: number }[];
  concepts: Record<string, { right: number; total: number }>;
  learning: { before: number; after: number } | null;
  terms?: { n: number; before: number; after: number } | null;
  ctas: Record<string, number>;
  participants?: { name: string; points: number; answered: number; right: number; terms: { before: number; after: number; n: number } | null; sends: number; practice: number; termsOpened: number; recapOpened: number }[];
};
export type Run = { r: number; t: number; w: number; title: string; joined: number };
/** Every run ever, newest first: the history behind each report. */
export async function readRuns(): Promise<Run[]> {
  const r = await fetch(`${env.relayUrl()}/api/runs?t=${encodeURIComponent(env.presenterToken())}`, { cache: "no-store" }).catch(() => null);
  return r?.ok ? (await r.json()).runs : [];
}
/** One run's report (the latest unless `run` is given): reach, presence, churn, engagement, learning, clicks. */
export async function readRunReport(run?: number): Promise<RunReport | null> {
  const r = await fetch(`${env.relayUrl()}/api/run-report?t=${encodeURIComponent(env.presenterToken())}${run ? `&r=${run}` : ""}`, { cache: "no-store" }).catch(() => null);
  return r?.ok ? r.json() : null;
}

export type Chapter = { id: string; name: string; q: string; min: number; in: { w: number; title: string }[] };

/** The relay's chapter library, for Compose. Empty when the relay can't be read. */
export async function readChapters(): Promise<Chapter[]> {
  const r = await fetch(`${env.relayUrl()}/api/chapters?t=${encodeURIComponent(env.presenterToken())}`, { cache: "no-store" }).catch(() => null);
  return r?.ok ? (await r.json()).chapters : [];
}

export async function relayControl(body: Record<string, unknown>) {
  const r = await fetch(`${env.relayUrl()}/api/control?t=${encodeURIComponent(env.presenterToken())}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Relay refused the control (${r.status}). Check RELAY_URL and PRESENTER_TOKEN.`);
}
