// Relay's room, rebuilt from an event log. Every tap, answer and presenter control is an event;
// reduce() folds them into the room in order, so any server (or serverless instance) that replays
// the same log sees the same room. Randomness happens before an event is written, never here.
import { SCENES, SCENE, POLL_TYPES, AUDIENCES, PRESENTER, INTROS } from "./scenes.mjs";
import { WORKSHOPS, SERIES } from "./workshops.mjs";
import { GLOSSARY } from "./concepts.mjs";

export const GROUPS = [100, 1000, 3000, 7000]; // ms per chat message, hidden until revealed
export const NINES = [99, 99.9, 99.95, 99.99, 99.999];
export const SLO_MS = [100, 300, 1000];
export const SLO_PCT = [99, 99.9, 99.99];
export const WORK_MS = 200;
// Relay's capacity in the load scenes scales with the room (one worker per 8 phones, at least 4),
// so "send every second" from every phone always overloads it: 64 phones → 8 workers → 40 req/s.
export const workersFor = (phones) => Math.max(4, Math.ceil(phones / 8));
export const CAP = { send: 80, request: 200, job: 50, load: 400 }; // per phone
export const FAIL_WHEN_BROKEN = 0.5;
export const loadWait = (inflight, workers) => WORK_MS * Math.max(1, Math.ceil(inflight / workers)); // queueing model

// ---- traces --------------------------------------------------------------------------------------
// The server measures its spans per message; the phone adds its own root span and the connection
// phases from Resource Timing, and sends the whole trace back with its round-trip time.
export const POOL_MS = 80; // the wait for a database connection: real time, no span until "Add span"
export const SERVER_SPANS = ["POST /send", "session.lookup", "relay.deliver", "db.pool.acquire", "db.append"];
const PHASES = { dns: "dns.lookup", connect: "tcp.connect", tls: "tls.handshake", request: "http.request", response: "http.response" };
export const SPAN_NAMES = ["relay.send", ...Object.values(PHASES), ...SERVER_SPANS];
const num = (x) => Number.isFinite(x) && x >= 0 && x <= 60000;
const okAttr = (a) => a === undefined || (a && typeof a === "object" && Object.keys(a).length <= 3 &&
  Object.entries(a).every(([k, v]) => k.length <= 40 && (typeof v === "number" || (typeof v === "string" && v.length <= 40))));
export const validSpans = (xs) => Array.isArray(xs) && xs.length >= 1 && xs.length <= 8 &&
  xs.every((x) => x && SERVER_SPANS.includes(x.n) && num(x.s) && num(x.d) && okAttr(x.a) && (x.e === undefined || x.e === 1));
export const validPhases = (ph) => ph === undefined || (ph && typeof ph === "object" &&
  Object.entries(ph).every(([k, v]) => Object.hasOwn(PHASES, k) && Array.isArray(v) && v.length === 2 && v.every(num)));
export function checkTrace(spans) { // what a well-formed server trace must hold
  const problems = [], root = spans[0];
  for (const n of ["POST /send", "session.lookup", "relay.deliver", "db.append"]) if (!spans.some((x) => x.n === n)) problems.push("missing " + n);
  for (const x of spans.slice(1)) if (x.s < root.s || x.s + x.d > root.s + root.d + 1) problems.push(x.n + " outside its parent");
  return problems;
}
export function buildTrace(c) { // one message as a trace the projector and phone can draw, ms from the phone's start
  if (!c?.spans) return null;
  const root = c.spans[0], total = Math.max(c.rtt ?? 0, root.d), ph = c.phases || {};
  const responseStart = ph.request ? ph.request[0] + ph.request[1] : null;
  const off = responseStart != null ? Math.max(ph.request[0], responseStart - root.d) : Math.max(0, (total - root.d) / 2);
  const spans = [{ name: "relay.send", start: 0, dur: total, depth: 0, side: "phone", error: !c.ok, attrs: { "http.request.method": "POST", "url.path": "/api/send" } }];
  for (const [k, name] of Object.entries(PHASES)) if (ph[k]) spans.push({ name, start: ph[k][0], dur: ph[k][1], depth: 1, side: "phone", parent: "relay.send", attrs: {} });
  c.spans.forEach((x, i) => spans.push({ name: x.n, start: off + x.s, dur: x.d, depth: i ? 2 : 1, side: "server", parent: i ? "POST /send" : "relay.send", error: !!x.e, attrs: x.a || {} }));
  const gaps = [], kids = c.spans.slice(1).sort((a, b) => a.s - b.s);
  let at = 0;
  for (const k of kids) { if (k.s - at > 2) gaps.push({ start: off + at, dur: k.s - at }); at = Math.max(at, k.s + k.d); }
  if (root.d - at > 2) gaps.push({ start: off + at, dur: root.d - at });
  return { traceId: c.trace, total, ok: c.ok, group: c.g, spans, gaps };
}

export const pct = (xs, q) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1))]);
};
const mean = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

// The room walks a path: the workshop's spine, with each fork's chosen detour spliced in after it
// and any library jump inserted where it was played. Forks appear as "fork:<id>".
const spineOf = (w) => WORKSHOPS[w].spine.map((x) => (typeof x === "string" ? x : "fork:" + x.fork));
const forkOf = (w, id) => WORKSHOPS[w].spine.find((x) => x.fork === id);
export function sceneAt(room, k = room.pos) {
  const id = room.path[k];
  if (!id.startsWith("fork:")) return SCENE[id];
  const f = forkOf(room.workshop, id.slice(5)), order = room.forkOrder[f.fork] || f.detours.map((_, i) => i);
  return { id: f.fork, type: "fork", act: "Your call", min: 0, title: f.title, options: order.map((i) => f.detours[i].title), order, slot: f.slot,
    chosen: room.choices[f.fork], detours: f.detours, concepts: [], terms: [],
    notes: "The room votes; Reveal takes the winner. Or take any option yourself. Next without a vote stays on the default." };
}
const curiosity = (room, d) => d.after.reduce((t, id) => t + (room.curious[id] || 0), 0);
function arrive(room) { // freeze a fork's option order (by curiosity) the moment the room reaches it
  const id = room.path[room.pos];
  if (!id.startsWith("fork:")) return;
  const f = forkOf(room.workshop, id.slice(5));
  room.forkOrder[f.fork] ??= f.detours.map((_, i) => i).sort((a, b) => curiosity(room, f.detours[b]) - curiosity(room, f.detours[a]));
}
function choose(room, f, d) { // d = detour index in the workshop file
  if (room.choices[f.id] !== undefined || !f.detours[d]) return;
  room.choices[f.id] = d;
  room.path.splice(room.path.indexOf("fork:" + f.id) + 1, 0, ...f.detours[d].scenes);
}
const minutes = (room, upto) => room.path.slice(0, upto).reduce((t, id, k) => {
  const s = sceneAt(room, k);
  return t + (s.type === "fork" ? (s.chosen === undefined ? s.slot : 0) : s.min);
}, 0);

export function fresh(w = 1) {
  return {
    workshop: w, path: spineOf(w), pos: 0, choices: {}, forkOrder: {}, over: 0, curious: {}, instrumented: false,
    groupsShown: false, broken: false, shown: new Set(), slo: null, audience: "tech", intro: "first",
    phones: new Map(), // id -> { id, group, sends, dups, answers, used, last, job }
    chat: [], reqs: [], jobs: { n: 0, slow: 0 }, load: [], incidents: [],
  };
}
const phonesIn = (room, g) => [...room.phones.values()].filter((p) => p.group === g);

// ---- the reducer ------------------------------------------------------------------------------
export function reduce(room, ev) {
  const p = room.phones.get(ev.phone), d = ev.data || {}, t = d.t;
  if (p && CAP[ev.kind]) p.used[ev.kind] = (p.used[ev.kind] || 0) + 1; // per-phone caps
  switch (ev.kind) {
    case "join": {
      if (p) return room;
      const counts = GROUPS.map((g) => phonesIn(room, g).length), min = Math.min(...counts);
      const pool = GROUPS.filter((_, i) => counts[i] === min);
      room.phones.set(ev.phone, { id: ev.phone, group: pool[hash(ev.phone) % pool.length], sends: 0, dups: 0, answers: {}, used: {}, last: null, job: null, curious: new Set() });
      return room;
    }
    case "send": {
      if (!p) return room;
      p.sends++; if (d.again) p.dups++;
      room.chat.push({ t, id: p.id, g: p.group, ms: d.ms, ok: d.ok, rtt: null, n: ev.id, trace: d.trace });
      p.lastSend = ev.id;
      return room;
    }
    case "rtt": {
      const c = p && room.chat.findLast((x) => x.id === p.id && x.n === p.lastSend);
      if (c && c.rtt == null) {
        c.rtt = d.ms; p.last = { rtt: Math.round(d.ms), server: Math.round(c.ms) };
        if (d.spans && d.trace === c.trace) Object.assign(c, { spans: d.spans, phases: d.phases }); // the message's trace
      }
      return room;
    }
    case "answer": if (p) p.answers[d.scene] = d.value; return room;
    case "request": room.reqs.push({ t, ok: d.ok }); return room;
    case "job": if (p) { room.jobs.n++; if (d.slow) room.jobs.slow++; p.job = { slow: d.slow, slowCalls: d.slowCalls, ms: d.ms }; } return room;
    case "load": room.load.push({ t, ms: d.ms }); return room;
    case "curious": if (p && !p.curious.has(d.scene)) { p.curious.add(d.scene); room.curious[d.scene] = (room.curious[d.scene] || 0) + 1; } return room;
    case "control": return control(room, d);
    default: return room;
  }
}

function control(room, { op, i, w, a, id, t, intro }) {
  const s = sceneAt(room);
  if (op === "reset") return { ...fresh(room.workshop), audience: room.audience, intro: room.intro }; // stay in this workshop
  if (op === "start") return { ...fresh(w), audience: a ?? room.audience, intro: intro ?? "first" }; // switch workshops with an empty room
  if (op === "audience") { room.audience = a; return room; } // who's in the room decides the intro
  if (op === "next") {
    if (s.type === "fork") choose(room, s, forkOf(room.workshop, s.id).default); // no vote: stay on the default
    if (room.pos < room.path.length - 1) room.pos++;
    arrive(room);
  } else if (op === "prev") { if (room.pos > 0) room.pos--; }
  else if (op === "goto") { if (i < room.path.length) { room.pos = i; arrive(room); } }
  else if (op === "choose") { if (s.type === "fork") choose(room, s, i); }
  else if (op === "detour") { room.path.splice(room.pos + 1, 0, id); room.over += SCENE[id].min; room.pos++; } // a library jump costs time
  else if (op === "groups") room.groupsShown = true;
  else if (op === "instrument") room.instrumented = true; // "Add span": later messages show db.pool.acquire
  else if (op === "break" && !room.broken) { room.broken = true; room.incidents.push({ start: t, end: null, title: "Messages failing to send", updates: [{ at: t, text: "Investigating elevated errors on the Chat API." }] }); }
  else if (op === "fix" && room.broken) { room.broken = false; const inc = room.incidents.at(-1); inc.end = t; inc.updates.push({ at: t, text: "Resolved. Messages are sending normally." }); }
  else if (op === "reveal") {
    room.shown.add(s.id);
    if (s.type === "fork") {
      const r = results(room, s, t);
      if (r.total) choose(room, s, s.order[r.counts.indexOf(Math.max(...r.counts))]);
    }
    if (s.type === "slo") {
      const pick = (key, opts) => { const c = opts.map((o) => [...room.phones.values()].filter((x) => x.answers.slo?.[key] === o).length); return opts[c.indexOf(Math.max(...c))]; };
      room.slo = { pct: pick("pct", SLO_PCT), ms: pick("ms", SLO_MS) };
    }
    if (s.post && room.incidents.at(-1)) {
      const r = results(room, s, t), win = r.counts.indexOf(Math.max(...r.counts));
      room.incidents.at(-1).updates.push({ at: t, text: s.options[win] });
    }
  }
  return room;
}

export function validControl({ op, i, w, a, id, intro }) {
  if (op === "audience") return Object.hasOwn(AUDIENCES, a);
  if (["next", "prev", "reveal", "groups", "break", "fix", "reset", "instrument"].includes(op)) return true;
  if (op === "start") return Number.isInteger(w) && Object.hasOwn(WORKSHOPS, w) && (a === undefined || Object.hasOwn(AUDIENCES, a)) && (intro === undefined || INTROS.includes(intro));
  if (op === "detour") return typeof id === "string" && Object.hasOwn(SCENE, id);
  return (op === "goto" || op === "choose") && Number.isInteger(i) && i >= 0 && i < 100;
}
export function validAnswer(s, value) {
  if (POLL_TYPES.has(s.type)) return Number.isInteger(value) && value >= 0 && value < s.options.length;
  if (s.type === "nines") return NINES.includes(value);
  if (s.type === "slo") return !!value && SLO_MS.includes(value.ms) && SLO_PCT.includes(value.pct);
  return false;
}

// ---- views ------------------------------------------------------------------------------------
export function results(room, s, now) {
  const answers = [...room.phones.values()].map((p) => [p.group, p.answers[s.id]]).filter(([, a]) => a !== undefined);
  switch (s.type) {
    case "fork": return { ...results(room, { ...s, type: "poll" }, now), curious: s.order.map((d) => curiosity(room, s.detours[d])) };
    case "gantt": { const tr = traced(room); return { ...results(room, { ...s, type: "poll" }, now), real: tr.length ? buildTrace(tr.at(-1)) : null }; }
    case "trace": {
      const tr = traced(room), failed = tr.filter((c) => !c.ok).sort((a, b) => b.n - a.n)[0], latest = [...tr].sort((a, b) => b.n - a.n)[0];
      const pooled = (c) => c.spans.some((x) => x.n === "db.pool.acquire"), shown = tr.find((c) => pooled(c) === room.instrumented); // fastest first: the gap is largest there
      return { n: tr.length, gaps: tr.filter((c) => !pooled(c)).length, instrumented: room.instrumented, fastest: buildTrace(shown || latest),
        slowest: buildTrace(tr.at(-1)), typical: buildTrace(tr[Math.floor((tr.length - 1) / 2)]), latest: buildTrace(latest), failed: buildTrace(failed) };
    }
    case "poll": return {
      counts: s.options.map((_, i) => answers.filter(([, a]) => a === i).length), total: answers.length,
      byGroup: GROUPS.map((g) => s.options.map((_, i) => answers.filter(([gg, a]) => gg === g && a === i).length)),
    };
    case "chat": case "journey": case "stat": return {
      groups: GROUPS.map((g) => {
        const ps = phonesIn(room, g), last = ps.filter((p) => p.last);
        return { ms: g, people: ps.length, sends: ps.reduce((t, p) => t + p.sends, 0), dups: ps.reduce((t, p) => t + p.dups, 0),
          rtt: mean(last.map((p) => p.last.rtt)), service: mean(last.map((p) => p.last.server)) };
      }),
      outage: outage(room, now),
    };
    case "dots": {
      const ok = room.chat.filter((c) => c.ok && c.rtt != null), ms = ok.map((c) => c.rtt);
      return { dots: ok.map((c) => ({ ms: c.rtt, g: c.g })), mean: mean(ms), p50: pct(ms, 0.5), p95: pct(ms, 0.95), p99: pct(ms, 0.99), max: ms.length ? Math.round(Math.max(...ms)) : null };
    }
    case "metrics": return metricsOf(room, now);
    case "logs": return { lines: room.chat.slice(-14).map(logLine).reverse(), ...levels(room.chat) };
    case "fanout": return { ...room.jobs, share: room.jobs.n ? room.jobs.slow / room.jobs.n : null };
    case "requests": {
      const ok = room.reqs.filter((r) => r.ok).length;
      return { last: room.reqs.slice(-100).map((r) => r.ok), total: room.reqs.length, ok, uptime: room.reqs.length ? ok / room.reqs.length : null };
    }
    case "nines": return { counts: NINES.map((n) => answers.filter(([, a]) => a === n).length), options: NINES };
    case "slo": return { slo: room.slo, total: answers.length };
    case "load": {
      const recent = room.load.filter((l) => l.t > now - 10000).map((l) => l.ms);
      const secs = [...Array(60)].map((_, i) => {
        const from = now - (60 - i) * 1000, xs = room.load.filter((l) => l.t >= from && l.t < from + 1000).map((l) => l.ms);
        return { rate: xs.length, p99: pct(xs, 0.99) };
      });
      return { rate: recent.length / 10, p50: pct(recent, 0.5), p99: pct(recent, 0.99), capacity: (workersFor(room.phones.size) * 1000) / WORK_MS, secs };
    }
    default: return {};
  }
}
const traced = (room) => room.chat.filter((c) => c.spans && c.rtt != null).sort((a, b) => a.rtt - b.rtt);

// ---- metrics and logs, computed from the same messages the room just sent ------------------------
export const BUCKETS = [250, 500, 1000, 2500, 5000, 10000]; // histogram upper bounds, ms (le)
const waited = (c) => c.rtt ?? c.ms;
export const clientId = (phoneId) => hash(phoneId).toString(16).padStart(8, "0").slice(0, 6); // a stand-in for a request's client, never the cookie id
// A percentile read from bucket counts, interpolated inside the bucket: what Prometheus's
// histogram_quantile() does, and why a p95 can sit flat on a bucket edge.
export function bucketQuantile(q, counts, total) {
  if (!total) return null;
  const rank = q * total;
  for (let i = 0, lo = 0, below = 0; i < BUCKETS.length; lo = BUCKETS[i], below = counts[i], i++)
    if (counts[i] >= rank) return Math.round(lo + ((BUCKETS[i] - lo) * (rank - below)) / Math.max(1, counts[i] - below));
  return BUCKETS.at(-1);
}
function metricsOf(room, now) {
  const done = room.chat.filter((c) => waited(c) != null), ms = done.map(waited);
  const cumulative = BUCKETS.map((le) => ms.filter((x) => x <= le).length);
  const secs = [...Array(60)].map((_, i) => {
    const from = now - (60 - i) * 1000, xs = room.chat.filter((c) => c.t >= from && c.t < from + 1000);
    return { sent: xs.length, phones: new Set(room.chat.filter((c) => c.t >= from - 14000 && c.t < from + 1000).map((c) => c.id)).size };
  });
  return {
    total: room.chat.length, errors: room.chat.filter((c) => !c.ok).length,
    rate: room.chat.filter((c) => c.t > now - 10000).length / 10,
    sending: new Set(room.chat.filter((c) => c.t > now - 15000).map((c) => c.id)).size,
    buckets: cumulative, count: ms.length, p95: pct(ms, 0.95), p95FromBuckets: bucketQuantile(0.95, cumulative, ms.length), mean: mean(ms), secs,
  };
}
function logLine(c) {
  const ms = waited(c);
  return { time: new Date(c.t).toISOString(), level: !c.ok ? "error" : ms != null && ms > 2500 ? "warn" : "info", route: "POST /send",
    status: c.ok ? 200 : 503, duration_ms: ms == null ? null : Math.round(ms), client: clientId(c.id), trace_id: c.trace ?? null };
}
const levels = (chat) => ({ count: chat.length, errors: chat.filter((c) => !c.ok).length, slowest: chat.length ? logLine(chat.reduce((a, b) => ((waited(b) ?? 0) > (waited(a) ?? 0) ? b : a))) : null });

/** Relay's own /metrics page in Prometheus text format: one counter, one gauge, one histogram. */
export function promText(room, now) {
  const m = metricsOf(room, now), sum = room.chat.reduce((t, c) => t + (waited(c) ?? 0), 0) / 1000;
  return [
    "# HELP relay_messages_total Messages sent to Relay since the room opened.", "# TYPE relay_messages_total counter",
    `relay_messages_total{status="200"} ${m.total - m.errors}`, `relay_messages_total{status="503"} ${m.errors}`,
    "# HELP relay_phones_sending Phones that sent a message in the last 15 seconds.", "# TYPE relay_phones_sending gauge",
    `relay_phones_sending ${m.sending}`,
    "# HELP relay_send_duration_seconds How long each message took, as the phone measured it.", "# TYPE relay_send_duration_seconds histogram",
    ...BUCKETS.map((le, i) => `relay_send_duration_seconds_bucket{le="${le / 1000}"} ${m.buckets[i]}`),
    `relay_send_duration_seconds_bucket{le="+Inf"} ${m.count}`, `relay_send_duration_seconds_sum ${sum.toFixed(3)}`, `relay_send_duration_seconds_count ${m.count}`, "",
  ].join("\n");
}
function outage(room, now) {
  const mins = [...Array(20)].map((_, i) => {
    const from = now - (20 - i) * 60000, xs = room.chat.filter((c) => c.t >= from && c.t < from + 60000);
    return { total: xs.length, errors: xs.filter((c) => !c.ok).length };
  });
  const ok = room.chat.filter((c) => c.ok).length;
  return { mins, uptime: room.chat.length ? ok / room.chat.length : null };
}

const ALWAYS_LEAD = new Set(["intro", "next", "qa", "takeaway", "show"]); // nothing to reveal on these
const termsSoFar = (room) => [...new Set(room.path.slice(0, room.pos + 1).flatMap((id, k) => sceneAt(room, k).terms))].map((term) => ({ term, ...GLOSSARY[term] }));
export function phoneView(room, p) {
  const s = sceneAt(room), shown = room.shown.has(s.id), W = WORKSHOPS[room.workshop];
  const v = { i: room.pos, n: room.path.length, id: s.id, type: s.type, workshopId: room.workshop, act: s.act, title: s.title, phone: s.phone, link: s.link,
    options: s.options, items: s.items, mode: s.mode, calls: s.calls, nines: s.type === "nines" ? NINES : undefined,
    slo: s.type === "slo" ? { ms: SLO_MS, pct: SLO_PCT, chosen: room.slo } : undefined,
    shown, answer: shown ? s.answer : undefined, mine: p?.answers[s.id], lead: shown || ALWAYS_LEAD.has(s.type) ? s.lead : undefined,
    workshop: W.title, promise: W.promise, terms: termsSoFar(room), curiousMine: !!p?.curious.has(s.id), chosen: s.chosen,
    group: room.groupsShown ? p?.group : undefined, broken: room.broken };
  if (s.type === "intro") Object.assign(v, { lead: AUDIENCES.tech.lead, items: AUDIENCES.tech.items, series: SERIES, intro: room.intro }); // phones: tech only
  if (s.type === "intro" || s.type === "qa") v.presenter = PRESENTER;
  if (p && s.type === "journey" && p.last) v.last = p.last;
  if (p && s.type === "dots") {
    const all = room.chat.filter((c) => c.ok && c.rtt != null), mine = all.filter((c) => c.id === p.id).map((c) => c.rtt);
    if (mine.length) { const worst = Math.max(...mine); v.worst = Math.round(worst); v.faster = Math.round((100 * all.filter((c) => c.rtt < worst).length) / all.length); }
  }
  if (p && s.type === "fanout") v.job = p.job;
  if (p && s.type === "metrics") {
    const mine = room.chat.filter((c) => c.id === p.id), ms = mine.map(waited).filter((x) => x != null), all = room.chat.map(waited).filter((x) => x != null);
    Object.assign(v, { mySent: mine.length, myErrors: mine.filter((c) => !c.ok).length, myP95: pct(ms, 0.95), roomP95: pct(all, 0.95), roomTotal: room.chat.length });
  }
  if (p && s.type === "logs") {
    const id = clientId(p.id);
    Object.assign(v, { client: id, lines: room.chat.slice(-30).map(logLine).reverse(), myLines: room.chat.filter((c) => c.id === p.id).slice(-8).map(logLine).reverse() });
  }
  if (p && s.type === "trace") v.trace = buildTrace(room.chat.findLast((c) => c.id === p.id && c.spans));
  return v;
}
export function screenView(room, now) {
  const s = sceneAt(room), W = WORKSHOPS[room.workshop];
  const flexAhead = room.path.slice(room.pos + 1).filter((id) => SCENE[id]?.flex).map((id) => SCENE[id].title);
  return { i: room.pos, n: room.path.length, workshop: W.title, workshopId: room.workshop, promise: W.promise, scene: s,
    shown: room.shown.has(s.id), groupsShown: room.groupsShown, broken: room.broken,
    people: room.phones.size, results: results(room, s, now), slo: room.slo, curious: room.curious[s.id] || 0,
    audience: room.audience, speaker: AUDIENCES[room.audience], intro: room.intro, presenter: PRESENTER, series: SERIES, instrumented: room.instrumented, audiences: Object.entries(AUDIENCES).map(([k, x]) => ({ k, label: x.label })),
    workshops: Object.entries(WORKSHOPS).map(([k, x]) => ({ k: +k, title: x.title })),
    library: SCENES.map((x) => ({ id: x.id, title: x.title, act: x.act, min: x.min })),
    clock: minutes(room, room.pos + 1), total: minutes(room, room.path.length), over: room.over, flexAhead };
}
export function statusSummary(room, now) {
  const today = [...room.chat, ...room.reqs], ok = today.filter((x) => x.ok).length;
  const days = [...Array(89)].map((_, i) => (i === 23 ? 0.9971 : i === 61 ? 0.9988 : 1)); // sample history
  days.push(today.length ? ok / today.length : 1);
  const p99 = pct(room.chat.filter((c) => c.ok && c.t > now - 120000).map((c) => c.ms), 0.99);
  const chat = room.broken ? "Partial outage" : p99 != null && p99 > 3000 ? "Degraded performance" : "Operational";
  return {
    overall: chat === "Operational" ? "All systems operational" : chat,
    components: [{ name: "Chat API", status: chat }, { name: "Message delivery", status: room.broken ? "Partial outage" : "Operational" }, { name: "Sign-in", status: "Operational" }],
    days, uptime90: days.reduce((a, b) => a + b, 0) / days.length, sampleHistory: true,
    incidents: room.incidents.slice().reverse(),
  };
}
