// Where Relay's event log lives. Both stores expose the same four calls:
//   sync()      bring this process's copy of the room up to date
//   room()      the current room (core.mjs shape)
//   append(ev)  write one event and fold it in
//   bump(d)     atomically change the load scene's in-flight counter, returning the new value
//   gate()      is the room live, and does the join code still admit phones?
//   tryJoin(hmac, ip)  one join attempt: ok | wrong | rate_limited | locked | expired | closed
//   events({ from, phone, kind })  past events, oldest first (recaps and follow-ups, after the room closes)
import { fresh, reduce } from "./core.mjs";

// Local runs and the self-check. Mirrors relay_gate() and relay_try_join() in migrations/.
export function memoryStore() {
  let room = fresh(), id = 0, inflight = 0;
  const log = [];
  let access = { liveUntil: Infinity, joinUntil: Infinity, codeHmac: null, locked: false, openedAt: 0 }, fails = [];
  const recent = (ip) => fails.filter((f) => f.at >= Math.max(Date.now() - 600_000, access.openedAt) && (ip === undefined || f.ip === ip)).length;
  return {
    setAccess(a) { access = { ...access, ...a }; if (a.openedAt !== undefined) fails = []; },
    async gate() {
      const t = Date.now(), live = access.liveUntil > t;
      return { live, joinable: live && access.joinUntil > t && !access.locked, locked: access.locked };
    },
    async tryJoin(hmac, ip) {
      const t = Date.now();
      if (!(access.liveUntil > t)) return "closed";
      if (access.locked) return "locked";
      if (!(access.joinUntil > t)) return "expired";
      if (recent(ip) >= 5) return "rate_limited";
      if (access.codeHmac && access.codeHmac === hmac) return "ok";
      fails.push({ at: t, ip });
      if (recent() >= 30) { access.locked = true; return "locked"; }
      return "wrong";
    },
    async sync() {},
    room: () => room,
    async append(ev) { ev.id = ++id; log.push(ev); room = reduce(room, ev); return ev; },
    async events({ from = 0, phone, kind } = {}) { return log.filter((e) => e.id >= from && (!phone || e.phone === phone) && (!kind || e.kind === kind)); },
    async bump(d) { inflight = Math.max(0, inflight + d); return inflight; },
  };
}

// Supabase (Postgres) through its REST API. Each serverless instance keeps a replica of the room
// and applies only events newer than the last one it saw.
export function supabaseStore({ url, key, minInterval = 300 }) {
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_KEY are required");
  const headers = { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" };
  const rest = async (path, init = {}) => {
    const r = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...headers, ...init.headers } });
    if (!r.ok) throw new Error(`supabase ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return r.status === 204 ? null : r.json();
  };
  let room = fresh(), lastId = null, lastSync = 0, inflightSync = null, gateAt = 0, gateCache = null;

  async function pull() {
    if (lastId === null) { // cold start: replay from the latest reset
      const [reset] = await rest("relay_events?select=id&kind=eq.control&data->>op=eq.reset&order=id.desc&limit=1");
      lastId = reset ? reset.id - 1 : 0;
    }
    for (;;) {
      const rows = await rest(`relay_events?select=id,phone,kind,data&id=gt.${lastId}&order=id.asc&limit=1000`);
      for (const ev of rows) { room = reduce(room, ev); lastId = ev.id; }
      if (rows.length < 1000) break;
    }
    lastSync = Date.now();
  }
  async function sync(force = false) {
    if (inflightSync) return inflightSync;
    if (!force && Date.now() - lastSync < minInterval) return;
    inflightSync = pull().finally(() => { inflightSync = null; });
    return inflightSync;
  }
  return {
    sync: () => sync(false),
    room: () => room,
    async append(ev) {
      const [row] = await rest("relay_events", { method: "POST", headers: { prefer: "return=representation" }, body: JSON.stringify({ phone: ev.phone ?? null, kind: ev.kind, data: ev.data ?? {} }) });
      if (inflightSync) await inflightSync;
      await sync(true); // apply it (and anything before it) in log order
      return row;
    },
    async bump(d) { return rest("rpc/relay_bump", { method: "POST", body: JSON.stringify({ d }) }); },
    async gate() { // cached briefly: every request asks, Close must still land within seconds
      if (Date.now() - gateAt < 2000) return gateCache;
      const [g] = await rest("rpc/relay_gate", { method: "POST", body: "{}" });
      gateAt = Date.now(); gateCache = g ?? { live: false, joinable: false, locked: false };
      return gateCache;
    },
    async events({ from = 0, phone, kind } = {}) { // ponytail: one page of 5000; a run is far smaller
      const q = [`id=gte.${Number(from) || 0}`, phone && `phone=eq.${phone}`, kind && `kind=eq.${kind}`].filter(Boolean).join("&");
      return rest(`relay_events?select=id,phone,kind,data&${q}&order=id.asc&limit=5000`);
    },
    async tryJoin(hmac, ip) { gateAt = 0; return rest("rpc/relay_try_join", { method: "POST", body: JSON.stringify({ p_hmac: hmac, p_ip: ip }) }); },
  };
}
