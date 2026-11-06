// Where Relay's event log lives. Both stores expose the same four calls:
//   sync()      bring this process's copy of the room up to date
//   room()      the current room (core.mjs shape)
//   append(ev)  write one event and fold it in
//   bump(d)     atomically change the load scene's in-flight counter, returning the new value
import { fresh, reduce } from "./core.mjs";

export function memoryStore() { // local runs and the self-check
  let room = fresh(), id = 0, inflight = 0;
  return {
    async sync() {},
    room: () => room,
    async append(ev) { ev.id = ++id; room = reduce(room, ev); return ev; },
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
  let room = fresh(), lastId = null, lastSync = 0, inflightSync = null;

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
  };
}
