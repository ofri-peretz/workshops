// Relay's API as one fetch-style handler: (Request) => Response. The local server and the Vercel
// function both call it; only the store differs.
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import { SCENES } from "./scenes.mjs";
import { promText, CAP, FAIL_WHEN_BROKEN, POOL_MS, loadWait, workersFor, validAnswer, validControl, validSpans, validPhases, phoneView, screenView, statusSummary, sceneAt } from "./core.mjs";

const ID = /^[0-9a-f-]{36}$/;
const TRACEPARENT = /^00-([0-9a-f]{32})-[0-9a-f]{16}-[0-9a-f]{2}$/; // W3C Trace Context
const r1 = (x) => Math.round(x * 10) / 10;
export const hmac = (secret, value) => createHmac("sha256", secret).update(value).digest("hex");
// What a phone sees for each join outcome. Each says what happened and what to do.
const JOIN = {
  wrong: [401, "That code isn't right. Check the code on the big screen."],
  expired: [401, "This code has expired. Ask the presenter for the new one."],
  rate_limited: [429, "Too many wrong codes from this network. Wait 10 minutes, or scan the QR code."],
  locked: [429, "Joining is paused. The presenter will reopen it."],
  closed: [403, "This workshop isn't running right now."],
};

export function createHandler({ store, token, codeSecret, scale = 1, random = Math.random }) {
  if (!token) throw new Error("PRESENTER_TOKEN is required");
  if (!codeSecret) throw new Error("CODE_SECRET is required");
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms * scale));
  const json = (code, body, headers = {}) => new Response(JSON.stringify(body), { status: code, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });
  const read = async (request) => {
    const text = await request.text();
    if (text.length > 1024) throw new Error("too large");
    try { return text ? JSON.parse(text) : {}; } catch { throw new Error("bad json"); }
  };
  const used = (p, kind) => (p.used[kind] || 0) >= CAP[kind];

  return async function handle(request) {
    const t0 = performance.now(); // the server's root span starts here
    const url = new URL(request.url);
    const path = "/" + (url.searchParams.get("path") ?? url.pathname.replace(/^\/api\//, "")).replace(/^\/+/, "");
    const method = request.method;
    const presenter = url.searchParams.get("t") === token;
    const id = (request.headers.get("cookie") || "").match(/(?:^|;\s*)rid=([^;]+)/)?.[1];
    const phoneId = id && ID.test(id) ? id : null;
    try {
      await store.sync();
      let room = store.room(), p = phoneId ? room.phones.get(phoneId) : undefined;
      const lookupMs = performance.now() - t0;
      const append = async (kind, data = {}) => { const ev = await store.append({ phone: p?.id ?? null, kind, data: { t: Date.now(), ...data } }); room = store.room(); p = p && room.phones.get(p.id); return ev; };

      if (method === "GET" && path === "/screen") return presenter ? json(200, screenView(room, Date.now())) : json(403, { error: "presenter link needed" });
      if (method === "POST" && path === "/control") {
        if (!presenter) return json(403, { error: "presenter link needed" });
        const body = await read(request);
        if (!validControl(body)) return json(400, { error: "unknown control" });
        await append("control", { op: body.op, i: body.i, w: body.w, a: body.a, id: body.id, intro: body.intro });
        return json(200, screenView(room, Date.now()));
      }
      // Everything below is for phones, and only while the presenter has the room open.
      if (!(await store.gate()).live) return json(403, { error: JOIN.closed[1], closed: true });
      if (method === "POST" && path === "/join") {
        let rid = phoneId;
        if (!p) {
          const code = String((await read(request)).code ?? "");
          if (!/^\d{6}$/.test(code)) return json(401, { error: "Enter the 6-digit code from the big screen.", needCode: true });
          const ip = (request.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
          const outcome = await store.tryJoin(hmac(codeSecret, code), hmac(codeSecret, "ip:" + ip).slice(0, 16)); // never store an IP
          if (outcome !== "ok") { const [status, error] = JOIN[outcome] ?? JOIN.closed; return json(status, { error, needCode: outcome === "wrong" || outcome === "expired" }); }
          rid = randomUUID(); await store.append({ phone: rid, kind: "join", data: { t: Date.now() } }); room = store.room(); p = room.phones.get(rid); }
        return json(200, phoneView(room, p), { "set-cookie": `rid=${rid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${url.protocol === "https:" ? "; Secure" : ""}` });
      }

      if (method === "GET" && path === "/status") return json(200, statusSummary(room, Date.now()));
      if (method === "GET" && path === "/metrics") // what a Prometheus scrape of Relay would read
        return new Response(promText(room, Date.now()), { headers: { "content-type": "text/plain; version=0.0.4", "cache-control": "no-store" } });
      if (!p) return json(401, { error: "join first" });
      if (method === "GET" && path === "/view") return json(200, phoneView(room, p));

      if (method === "POST" && path === "/send") { // a chat message: waits the phone's group time
        if (used(p, "send")) return json(429, { error: "that's plenty for today" });
        const { again } = await read(request);
        // One trace per message. Spans are measured around the code they name; the phone's
        // traceparent makes them part of the phone's trace.
        const tp = (request.headers.get("traceparent") || "").match(TRACEPARENT);
        const trace = tp && !/^0+$/.test(tp[1]) ? tp[1] : randomBytes(16).toString("hex");
        const spans = [{ n: "POST /send", s: 0, d: 0, a: { "http.route": "/send" } }, { n: "session.lookup", s: 0, d: r1(lookupMs) }];
        const span = async (n, fn, a) => { const s = performance.now() - t0; await fn(); const x = { n, s: r1(s), d: r1(performance.now() - t0 - s) }; if (a) x.a = a; spans.push(x); return x; };
        const tw = performance.now();
        let ok = true;
        const deliver = await span("relay.deliver", async () => {
          await sleep(p.group);
          await store.sync(); room = store.room();
          ok = !(room.broken && random() < FAIL_WHEN_BROKEN);
        }, { "relay.group_ms": p.group });
        const pool = () => new Promise((r) => setTimeout(r, POOL_MS)); // ponytail: a modeled pool wait, unscaled so the gap shows in tests too
        if (room.instrumented) await span("db.pool.acquire", pool); else await pool(); // the gap nobody owns until "Add span"
        await span("db.append", () => append("send", { ms: performance.now() - tw, ok, again: again === true, trace }), { "db.system": "postgresql" });
        Object.assign(spans[0], { d: r1(performance.now() - t0), a: { ...spans[0].a, "http.response.status_code": ok ? 200 : 503 } });
        if (!ok) spans[0].e = deliver.e = 1;
        const timing = spans.slice(1).map((x) => `${x.n};dur=${x.d}`).concat(`total;dur=${spans[0].d}`).join(", ");
        return json(ok ? 200 : 503, ok ? { ok: true, trace, spans } : { error: "Relay is having trouble", trace, spans }, { "server-timing": timing });
      }
      if (method === "POST" && path === "/curious") { // "Go deeper": once per phone per scene
        const s = sceneAt(room);
        if (p.curious.has(s.id)) return json(409, { error: "already counted" });
        await append("curious", { scene: s.id });
        return json(200, { ok: true });
      }
      if (method === "POST" && path === "/rtt") { // what the phone measured for its last message
        const { ms, trace, spans, phases } = await read(request);
        if (!Number.isFinite(ms) || ms < 0 || ms > 60000) return json(400, { error: "bad timing" });
        if (spans !== undefined && !(typeof trace === "string" && /^[0-9a-f]{32}$/.test(trace) && validSpans(spans) && validPhases(phases)))
          return json(400, { error: "bad trace" });
        await append("rtt", spans ? { ms, trace, spans, phases } : { ms }); // ponytail: server spans come back through the phone; shape-checked, not signed
        return json(200, { ok: true });
      }
      if (method === "POST" && path === "/answer") {
        const s = sceneAt(room), { value } = await read(request);
        if (!validAnswer(s, value)) return json(400, { error: "not an answer for this scene" });
        if ((room.shown.has(s.id) && s.answer !== undefined) || s.chosen !== undefined) return json(409, { error: "answers are closed" });
        await append("answer", { scene: s.id, value });
        return json(200, { ok: true });
      }
      if (method === "POST" && path === "/request") { // "be a request"
        if (used(p, "request")) return json(429, { error: "that's plenty for today" });
        await sleep(80);
        const ok = !(room.broken && random() < FAIL_WHEN_BROKEN);
        await append("request", { ok });
        return ok ? json(200, { ok: true }) : json(500, { error: "Internal Server Error" });
      }
      if (method === "POST" && path === "/job") { // 100 calls, 1 in 100 slow
        if (used(p, "job")) return json(429, { error: "that's plenty for today" });
        const s = SCENES.find((x) => x.type === "fanout");
        let slowCalls = 0;
        for (let i = 0; i < s.calls; i++) if (random() < s.slowShare) slowCalls++;
        const job = { slow: slowCalls > 0, slowCalls, ms: slowCalls ? 1000 : 20 };
        await sleep(job.ms);
        await append("job", job);
        return json(200, job);
      }
      if (method === "POST" && path === "/load") { // the load scenes: in flight beyond capacity waits
        if (used(p, "load")) return json(429, { error: "that's plenty for today" });
        const t0 = performance.now();
        const n = await store.bump(1);
        try { await sleep(loadWait(n, workersFor(room.phones.size))); } finally { await store.bump(-1); }
        const ms = performance.now() - t0;
        await append("load", { ms });
        return json(200, { ms: Math.round(ms) });
      }
      return json(404, { error: "not found" });
    } catch (e) {
      return json(e.message === "too large" || e.message === "bad json" ? 400 : 500, { error: e.message.startsWith("supabase") ? "Relay's database is unavailable" : e.message });
    }
  };
}
