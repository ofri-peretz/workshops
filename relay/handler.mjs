// Relay's API as one fetch-style handler: (Request) => Response. The local server and the Vercel
// function both call it; only the store differs.
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import { SCENES } from "./scenes.mjs";
import { reportOf, validName, TAKEAWAYS, runOf, recapView, chapterList, promText, CAP, FAIL_WHEN_BROKEN, POOL_MS, loadWait, workersFor, validAnswer, validControl, validSpans, validPhases, phoneView, screenView, statusSummary, sceneAt } from "./core.mjs";

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

const titledName = (room) => room.title || ({ 5: "Signals", 1: "Relay is slow", 2: "Relay breaks", 3: "GraphQL measured", 4: "Follow one request" })[room.workshop];
// The close's links: this session's recap, and (once you've picked) your follow-up.
// Links use the address the phone came in on: localhost locally, the real domain on Vercel.
const withLinks = (v, room, p, k, home) => {
  if (!["takeaway", "qa", "outro"].includes(v.type)) return v;
  return { ...v, recap: room.runId ? `${home}/recap?r=${room.runId}&p=${p.id}&k=${k}` : undefined,
    followup: v.mine !== undefined || Object.keys(p.answers).some((s) => TAKEAWAYS.has(s)) ? `/api/followup.ics?p=${p.id}&k=${k}` : undefined };
};

export function createHandler({ store, token, codeSecret, scale = 1, random = Math.random }) {
  if (!token) throw new Error("PRESENTER_TOKEN is required");
  if (!codeSecret) throw new Error("CODE_SECRET is required");
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms * scale));
  const json = (code, body, headers = {}) => new Response(JSON.stringify(body), { status: code, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });
  const read = async (request) => {
    const text = await request.text();
    if (text.length > 2048) throw new Error("too large"); // a composed program lists up to 24 chapters
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

      if (method === "GET" && path === "/chapters") return presenter ? json(200, { chapters: chapterList() }) : json(403, { error: "presenter link needed" });
      if (method === "GET" && path === "/config") // what the pages may know: PostHog only when its key is set
        return json(200, { posthog: process.env.POSTHOG_KEY ? { key: process.env.POSTHOG_KEY, host: process.env.POSTHOG_HOST || "https://us.i.posthog.com" } : null });
      // The screen's "Email me a presenter link": Supabase emails a sign-in link to the owner only;
      // landing back, the screen trades the owner's session for the presenter token.
      const sb = process.env.SUPABASE_URL, sbKey = process.env.SUPABASE_KEY, owner = process.env.OWNER_EMAIL;
      if (method === "POST" && (path === "/screen-link" || path === "/screen-unlock") && !(sb && sbKey && owner)) return json(503, { error: "Email sign-in isn't set up on this relay." });
      if (method === "POST" && path === "/screen-link") {
        const back = /(^|\.)workshop\.ofriperetz\.dev$|^localhost$|^127\.0\.0\.1$/.test(url.hostname) ? url.origin : "https://screen.signals.workshop.ofriperetz.dev";
        const r = await fetch(`${sb}/auth/v1/otp?redirect_to=${encodeURIComponent(back + "/screen")}`, { method: "POST", headers: { apikey: sbKey, "content-type": "application/json" }, body: JSON.stringify({ email: owner, create_user: false }) });
        return r.ok ? json(200, { sent: true }) : json(r.status === 429 ? 429 : 502, { error: r.status === 429 ? "A link was just sent. Check your email, or wait a minute." : "The email couldn't be sent." });
      }
      if (method === "POST" && path === "/screen-unlock") {
        const { access_token } = await read(request).catch(() => ({}));
        const r = typeof access_token === "string" ? await fetch(`${sb}/auth/v1/user`, { headers: { apikey: sbKey, authorization: `Bearer ${access_token}` } }) : null;
        const user = r?.ok ? await r.json() : null;
        return user?.email?.toLowerCase() === owner.toLowerCase() ? json(200, { t: token }) : json(403, { error: "This link isn't the owner's. Request a new one." });
      }
      if (method === "GET" && path === "/screen") return presenter ? json(200, screenView(room, Date.now())) : json(403, { error: "presenter link needed" });
      if (method === "POST" && path === "/control") {
        if (!presenter) return json(403, { error: "presenter link needed" });
        const body = await read(request);
        if (!validControl(body)) return json(400, { error: "unknown control" });
        await append("control", { op: body.op, i: body.i, w: body.w, a: body.a, id: body.id, intro: body.intro, c: body.c, title: body.title, wait: body.wait === true, names: body.names, voters: body.voters });
        return json(200, screenView(room, Date.now()));
      }
      // After the room: the recap (public) and the one-week follow-up (needs the phone's signed link).
      const follow = (pid) => hmac(codeSecret, "follow:" + pid).slice(0, 24);
      const signed = (q) => ID.test(q.get("p") || "") && q.get("k") === follow(q.get("p"));
      if (method === "GET" && path === "/recap") {
        const r = Number(url.searchParams.get("r"));
        if (!Number.isInteger(r) || r < 1) return json(400, { error: "which session?" });
        const run = runOf(await store.events({ from: r }), r);
        if (!run) return json(404, { error: "no such session" });
        return json(200, recapView(run, signed(url.searchParams) ? run.phones.get(url.searchParams.get("p")) : undefined), { "cache-control": "public, max-age=60" });
      }
      if (path === "/followup" || path === "/followup.ics") {
        const q = url.searchParams;
        if (!signed(q)) return json(403, { error: "This follow-up link isn't valid." });
        const mine = await store.events({ phone: q.get("p"), kind: "answer" });
        const pick = mine.findLast((e) => TAKEAWAYS.has(e.data.scene)), done = mine.findLast((e) => e.data.scene === "followup");
        if (!pick) return json(404, { error: "No pick to follow up on." });
        const item = SCENES.find((x) => x.id === pick.data.scene).items[pick.data.value];
        const link = `${url.origin}/followup?p=${q.get("p")}&k=${q.get("k")}`;
        if (path === "/followup.ics") {
          const day = new Date(Date.parse(pick.data.t) || pick.data.t); day.setUTCDate(day.getUTCDate() + 7);
          const d = day.toISOString().slice(0, 10).replaceAll("-", "");
          const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//workshop.ofriperetz.dev//EN", "BEGIN:VEVENT", `UID:${q.get("p")}@workshop.ofriperetz.dev`,
            `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`, `DTSTART;VALUE=DATE:${d}`, "SUMMARY:Did you do it? (workshop follow-up)",
            `DESCRIPTION:${item.replace(/[,;\\]/g, (c) => "\\" + c)}\\n${link}`, `URL:${link}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
          return new Response(ics, { headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": "attachment; filename=followup.ics" } });
        }
        if (method === "GET") return json(200, { pick: item, done: done ? done.data.value === 1 : null });
        if (method === "POST") {
          const { did } = await read(request);
          if (typeof did !== "boolean") return json(400, { error: "did you, or not yet?" });
          if (done) return json(409, { error: "Already answered. Thank you." });
          await store.append({ phone: q.get("p"), kind: "answer", data: { t: Date.now(), scene: "followup", value: did ? 1 : 0, of: pick.data.scene } });
          return json(200, { ok: true });
        }
      }
      if (method === "GET" && path === "/run-report") { // the presenter's per-run report (latest run unless ?r=)
        if (!presenter) return json(403, { error: "presenter link needed" });
        const r = Number(url.searchParams.get("r")) || room.runId;
        if (!r) return json(404, { error: "no run yet" });
        const events = (await store.events({ from: r })), run = runOf(events, r);
        if (!run) return json(404, { error: "no such run" });
        const cut = events.findIndex((e, i) => i > 0 && e.kind === "control" && ["start", "reset"].includes(e.data?.op));
        return json(200, { run: r, title: titledName(run), ...reportOf(run, cut < 0 ? events : events.slice(0, cut)) });
      }
      if (method === "GET" && path === "/impact") {
        if (!presenter) return json(403, { error: "presenter link needed" });
        const ans = await store.events({ kind: "answer" });
        const picks = new Set(ans.filter((e) => TAKEAWAYS.has(e.data.scene)).map((e) => e.phone)), fu = ans.filter((e) => e.data.scene === "followup");
        // Every answer ever given to a question with a right answer: which ideas the rooms find hard.
        const qs = SCENES.filter((x) => x.answer !== undefined && x.type !== "takeaway").map((x) => {
          const got = ans.filter((e) => e.data.scene === x.id);
          return { id: x.id, q: x.title, right: got.filter((e) => e.data.value === x.answer).length, total: got.length };
        }).filter((x) => x.total).sort((a, b) => a.right / a.total - b.right / b.total);
        return json(200, { picked: picks.size, followedUp: fu.length, did: fu.filter((e) => e.data.value === 1).length, questions: qs });
      }
      // Push: a Server-Sent Events stream that says "step" the moment the presenter acts, so every
      // phone (and screen) re-reads its view at once. Each stream lives under a minute; the browser's
      // EventSource reconnects by itself. Polling stays as the fallback.
      if (method === "GET" && path === "/stream") {
        if (!presenter && !p) return json(401, { error: "join first" });
        const enc = new TextEncoder(), until = Date.now() + 50_000;
        let last = store.room().seq || 0;
        const body = new ReadableStream({
          async start(ctrl) {
            ctrl.enqueue(enc.encode("retry: 1000\n: open\n\n"));
            while (Date.now() < until && !request.signal?.aborted) {
              await new Promise((r) => setTimeout(r, 250));
              try { await store.sync(); } catch {}
              const seq = store.room().seq || 0;
              if (seq !== last) { last = seq; ctrl.enqueue(enc.encode(`event: step\ndata: ${seq}\n\n`)); }
            }
            ctrl.close();
          },
        });
        return new Response(body, { headers: { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" } });
      }
      // Everything below is for phones, and only while the presenter has the room open.
      if (!(await store.gate()).live) return json(403, { error: JOIN.closed[1], closed: true });
      if (method === "POST" && path === "/scan") { await store.append({ phone: null, kind: "answer", data: { t: Date.now(), scene: "_scan", value: 1 } }); return json(200, { ok: true }); }
      if (method === "POST" && path === "/join") {
        let rid = phoneId;
        if (!p) {
          const code = String((await read(request)).code ?? "");
          if (!/^\d{6}$/.test(code)) return json(401, { error: "Enter the 6-digit code from the big screen.", needCode: true });
          const ip = (request.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
          const outcome = await store.tryJoin(hmac(codeSecret, code), hmac(codeSecret, "ip:" + ip).slice(0, 16)); // never store an IP
          if (outcome !== "ok") { const [status, error] = JOIN[outcome] ?? JOIN.closed; return json(status, { error, needCode: outcome === "wrong" || outcome === "expired" }); }
          // a device mark (never the raw IP or user agent): two sessions from one phone count as a reconnection
          const dev = hmac(codeSecret, "dev:" + ip + "|" + (request.headers.get("user-agent") || "")).slice(0, 16);
          rid = randomUUID(); await store.append({ phone: rid, kind: "join", data: { t: Date.now(), dev } }); room = store.room(); p = room.phones.get(rid); }
        return json(200, phoneView(room, p), { "set-cookie": `rid=${rid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${url.protocol === "https:" ? "; Secure" : ""}` });
      }

      if (method === "GET" && path === "/status") return json(200, statusSummary(room, Date.now()));
      if (method === "GET" && path === "/metrics") // what a Prometheus scrape of Relay would read
        return new Response(promText(room, Date.now()), { headers: { "content-type": "text/plain; version=0.0.4", "cache-control": "no-store" } });
      if (!p) return json(401, { error: "join first" });
      if (method === "GET" && path === "/view") return json(200, withLinks(phoneView(room, p), room, p, hmac(codeSecret, "follow:" + p.id).slice(0, 24), url.origin));

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
      if (method === "POST" && path === "/name") { // named sessions: a first name for the leaderboard
        if (room.names !== "named") return json(409, { error: "This session is anonymous." });
        const { name } = await read(request);
        if (!validName(name)) return json(400, { error: "Use 1 to 24 letters or digits." });
        await append("answer", { scene: "_name", value: name.trim() });
        return json(200, { ok: true });
      }
      if (method === "POST" && path === "/event") { // presence and calls to action, for the run report
        const { type, target } = await read(request);
        if (type === "beat") { await append("answer", { scene: "_beat", value: 1 }); return json(200, { ok: true }); }
        if (type === "cta" && ["linkedin", "github", "devto", "blog", "recap"].includes(target)) { await append("answer", { scene: "_cta", value: target }); return json(200, { ok: true }); }
        return json(400, { error: "unknown event" });
      }
      if (method === "POST" && path === "/answer") {
        if (room.eyes) return json(423, { error: "Eyes on the screen for a moment." });
        const s = sceneAt(room), { value } = await read(request);
        if (!validAnswer(s, value)) return json(400, { error: "not an answer for this scene" });
        if ((room.shown.has(s.id) && (s.answer !== undefined || s.type === "termcheck")) || s.chosen !== undefined) return json(409, { error: "answers are closed" });
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
