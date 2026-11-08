// Relay's room, rebuilt from an event log. Every tap, answer and presenter control is an event;
// reduce() folds them into the room in order, so any server (or serverless instance) that replays
// the same log sees the same room. Randomness happens before an event is written, never here.
import { SCENES, SCENE, POLL_TYPES, AUDIENCES, PRESENTER, INTROS } from "./scenes.mjs";
import { WORKSHOPS, SERIES, CHAPTERS, spineOf, partsOf, termsOf } from "./workshops.mjs";
import { GLOSSARY } from "./concepts.mjs";
import { CASES } from "./cases.mjs";

export const GROUPS = [100, 300, 500, 1000, 3000, 7000]; // ms per chat message, hidden until revealed
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
// room.chapters is the workshop's list unless the console composed another one.
const pathOf = (chapters) => spineOf(chapters).map((x) => (typeof x === "string" ? x : "fork:" + x.fork));
const FORKS = Object.fromEntries(Object.values(CHAPTERS).flatMap((c) => c.scenes.filter((x) => typeof x !== "string").map((f) => [f.fork, f])));
const forkOf = (_w, id) => FORKS[id];
// Each path step carries its chapter (room.part), so the header matches "Today"; detours and library
// jumps take the chapter of the step they were played from.
const partsAlong = (chapters) => chapters.flatMap((c) => CHAPTERS[c].scenes.map(() => c));
const insertSteps = (room, at, ids) => { room.path.splice(at, 0, ...ids); room.part.splice(at, 0, ...ids.map(() => room.part[at - 1])); };
export function sceneAt(room, k = room.pos) {
  const id = room.path[k];
  if (SCENE[id]?.type === "cases") return { ...SCENE[id], options: studiesOf(room).map((c) => c.who) }; // the room picks a case
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
  insertSteps(room, room.path.indexOf("fork:" + f.id) + 1, f.detours[d].scenes);
}
const minutes = (room, upto) => room.path.slice(0, upto).reduce((t, id, k) => {
  const s = sceneAt(room, k);
  return t + (s.type === "fork" ? (s.chosen === undefined ? s.slot : 0) : s.min);
}, 0);

export function fresh(w = 1, chapters = WORKSHOPS[w].chapters) {
  return {
    workshop: w, chapters, path: pathOf(chapters), part: partsAlong(chapters), pos: 0, choices: {}, forkOrder: {}, over: 0, curious: {}, instrumented: false,
    groupsShown: false, broken: false, shown: new Set(), slo: null, audience: "tech", intro: "first", begun: true,
    names: "anonymous", voters: false, eyes: false, arrived: {}, scans: 0, ctas: {}, devs: new Set(), reconnects: 0, joins: 0,
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
      room.phones.set(ev.phone, { id: ev.phone, n: room.phones.size + 1, group: pool[hash(ev.phone) % pool.length], sends: 0, dups: 0, answers: {}, at: {}, used: {}, last: null, job: null, curious: new Set(), beat: t, joinedAt: t });
      room.joins++;
      if (d.dev) { if (room.devs.has(d.dev)) room.reconnects++; else room.devs.add(d.dev); } // same device, new session
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
    case "answer":
      if (d.scene === "_scan") { room.scans++; return room; } // the join page loaded (no phone yet)
      if (!p) return room;
      if (d.scene === "_name") p.name = d.value;
      else if (d.scene === "_beat") p.beat = t;
      else if (d.scene === "_cta") room.ctas[d.value] = (room.ctas[d.value] || 0) + 1;
      else if (SCENE[d.scene]?.type === "termcheck") { const m = (p.answers[d.scene] ||= {}); if (m[d.value.k] === undefined) m[d.value.k] = d.value.a; p.at[d.scene] = t; } // first try per term
      else if (d.scene !== "followup") { p.answers[d.scene] = d.value; p.at[d.scene] = t; }
      return room;
    case "request": room.reqs.push({ t, ok: d.ok }); return room;
    case "job": if (p) { room.jobs.n++; if (d.slow) room.jobs.slow++; p.job = { slow: d.slow, slowCalls: d.slowCalls, ms: d.ms }; } return room;
    case "load": room.load.push({ t, ms: d.ms }); return room;
    case "curious": if (p && !p.curious.has(d.scene)) { p.curious.add(d.scene); room.curious[d.scene] = (room.curious[d.scene] || 0) + 1; } return room;
    case "control": return control(room, { ...d, ev: ev.id });
    default: return room;
  }
}

function control(room, { op, i, w, a, id, t, intro, c, title, ev, wait, names, voters }) {
  const before = room.pos, begunBefore = room.begun;
  const out = control1(room, { op, i, w, a, id, t, intro, c, title, ev, wait, names, voters });
  if (out.pos !== before || out.begun !== begunBefore || op === "detour") { out.since = t; out.arrived[out.path[out.pos]] = t; } // the countdown restarts on every new step
  out.seq = (room.seq || 0) + 1; // every presenter action: what /api/stream pushes to phones
  return out;
}
function control1(room, { op, i, w, a, id, t, intro, c, title, ev, wait, names, voters }) {
  const s = sceneAt(room);
  if (op === "eyes") { room.eyes = !room.eyes; return room; }
  if (op === "signout") { room.phones = new Map(); room.signedOut = ev; return room; } // everyone rejoins with the new code; the step stays // "look at the screen": phones pause input
  if (op === "mode") { if (names) room.names = names; if (voters !== undefined) room.voters = voters; return room; }
  if (op === "reset") return { ...fresh(room.workshop, room.chapters), title: room.title, runId: ev, names: room.names, voters: room.voters, audience: room.audience, intro: room.intro }; // stay in this workshop
  if (op === "start") return { ...fresh(w, c ?? WORKSHOPS[w].chapters), title: c ? title : undefined, runId: ev, audience: a ?? room.audience, intro: intro ?? "first", begun: !wait, names: names ?? "anonymous", voters: voters === true }; // the presenter leads the opening; phones join at the Scan slide // an empty room; phones wait until "begin"
  if (op === "begin" || (op === "next" && !room.begun)) { room.begun = true; return room; }
  if (op === "goto" || op === "detour") room.begun = true; // jumping to a scene starts the workshop
  if (op === "audience") { room.audience = a; return room; } // who's in the room decides the intro
  if (op === "next") {
    if (s.type === "fork") choose(room, s, forkOf(room.workshop, s.id).default); // no vote: stay on the default
    if (room.pos < room.path.length - 1) room.pos++;
    arrive(room);
  } else if (op === "prev") { if (room.pos > 0) room.pos--; }
  else if (op === "goto") { if (i < room.path.length) { room.pos = i; arrive(room); } }
  else if (op === "choose") { if (s.type === "fork") choose(room, s, i); }
  else if (op === "detour") { insertSteps(room, room.pos + 1, [id]); room.over += SCENE[id].min; room.pos++; } // a library jump costs time
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

// A composed program: known chapters, each once, opening with the welcome and up to 3 hours.
export const MAX_PROGRAM_MIN = 180;
const programMinutes = (c) => spineOf(c).reduce((t, x) => t + (typeof x === "string" ? SCENE[x].min : x.slot), 0);
export const validProgram = (c) => Array.isArray(c) && c.length >= 2 && c.some((x) => CHAPTERS[x]?.q) && c.length <= 24 && c[0] === "welcome" && new Set(c).size === c.length
  && c.every((x) => typeof x === "string" && Object.hasOwn(CHAPTERS, x)) && programMinutes(c) <= MAX_PROGRAM_MIN;
export const NAME_MODES = ["anonymous", "named"];
export const validName = (x) => typeof x === "string" && /^[\p{L}\p{N} .'’-]{1,24}$/u.test(x.trim());
export function validControl({ op, i, w, a, id, intro, c, title, names, voters }) {
  if (op === "mode") return (names === undefined || NAME_MODES.includes(names)) && (voters === undefined || typeof voters === "boolean");
  if (op === "audience") return Object.hasOwn(AUDIENCES, a);
  if (["eyes", "begin", "next", "prev", "reveal", "groups", "break", "fix", "reset", "instrument", "signout"].includes(op)) return true;
  if (op === "start") return Number.isInteger(w) && Object.hasOwn(WORKSHOPS, w) && (a === undefined || Object.hasOwn(AUDIENCES, a)) && (intro === undefined || INTROS.includes(intro)) && (c === undefined || validProgram(c)) && (names === undefined || NAME_MODES.includes(names)) && (voters === undefined || typeof voters === "boolean")
    && (title === undefined || (typeof title === "string" && /^[\p{L}\p{N} &,.:'’-]{1,40}$/u.test(title)));
  if (op === "detour") return typeof id === "string" && Object.hasOwn(SCENE, id);
  return (op === "goto" || op === "choose") && Number.isInteger(i) && i >= 0 && i < 100;
}
export function validAnswer(s, value) {
  if (POLL_TYPES.has(s.type) || s.type === "cases" || (s.type === "outro" && s.options)) return Number.isInteger(value) && value >= 0 && value < s.options.length;
  if (s.type === "nines") return NINES.includes(value);
  if (s.type === "termcheck") return !!value && Number.isInteger(value.k) && value.k >= 0 && value.k < 60 && Number.isInteger(value.a) && value.a >= 0 && value.a < 4;
  if (s.type === "slo") return !!value && SLO_MS.includes(value.ms) && SLO_PCT.includes(value.pct);
  if (s.type === "takeaway") return Number.isInteger(value) && value >= 0 && value < s.items.length; // "the one I'll do this week"
  return false;
}

// ---- views ------------------------------------------------------------------------------------
export function results(room, s, now) {
  const answers = [...room.phones.values()].map((p) => [p.group, p.answers[s.id]]).filter(([, a]) => a !== undefined);
  switch (s.type) {
    case "cases": return results(room, { ...s, type: "poll" }, now);
    case "outro": return s.options ? results(room, { ...s, type: "poll" }, now) : {};
    case "termcheck": return termResults(room, s);
    case "takeaway": return { counts: s.items.map((_, i) => answers.filter(([, a]) => a === i).length), total: answers.length };
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
    case "why": { // the room's own "green dashboard": everything delivered, while one group waited seconds
      const ok = room.chat.filter((c) => c.ok), slow = Math.max(0, ...ok.map(waited).filter((x) => x != null));
      return { total: room.chat.length, failed: room.chat.length - ok.length, slowest: slow || null }; }
    case "step": { // the live example under an explainer: the latest line, the room's lines by level, their size
      const lines = room.chat.map(logLine), bytes = lines.reduce((a, l) => a + JSON.stringify(l).length + 1, 0);
      const m = s.live === "buckets" ? metricsOf(room, now) : null;
      if (m) return { buckets: BUCKETS.map((le, i) => ({ le, n: m.buckets[i] - (i ? m.buckets[i - 1] : 0) })), over: m.count - (m.buckets.at(-1) ?? 0), count: m.count, p95: m.p95, p95FromBuckets: m.p95FromBuckets };
      return { people: room.phones.size, good: lines.filter((l) => l.status === 200 && l.duration_ms != null && l.duration_ms <= 1000).length, line: lines.at(-1) ?? null, lines: lines.length, bytes, by: Object.fromEntries(LEVELS.map(([k]) => [k, lines.filter((l) => l.level === k.toLowerCase()).length])) }; }
    case "basics": { const ms = room.chat.filter((c) => c.ok).map(waited).filter((x) => x != null);
      return { min: ms.length ? Math.round(Math.min(...ms)) : null, max: ms.length ? Math.round(Math.max(...ms)) : null, failed: room.chat.filter((c) => !c.ok).length, total: room.chat.length }; }
    case "spread": { // every message the room sent, and where the average and the percentiles land
      const ms = room.chat.filter((c) => c.ok).map(waited).filter((x) => x != null), m = mean(ms);
      const byPhone = [...room.phones.values()].map((p) => pct(room.chat.filter((c) => c.id === p.id && c.ok).map(waited).filter((x) => x != null), 0.5)).filter((x) => x != null);
      return { dots: ms.slice(-400), mean: m, p50: pct(ms, 0.5), p95: pct(ms, 0.95), p99: pct(ms, 0.99), people: byPhone.length, hidden: m ? byPhone.filter((x) => x > 2 * m).length : 0 }; }
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

// Hands-on steps get a countdown: the scene's minutes, from the moment the room arrived.
export const TIMED = new Set([...POLL_TYPES, "cases", "road", "chat", "metrics", "logs", "trace", "dots", "journey", "requests", "fanout", "load", "slo", "nines", "takeaway", "termcheck"]);
const timerOf = (room, s, now = Date.now()) => (room.begun && room.since && TIMED.has(s.type) && s.min ? { left: Math.max(0, room.since + s.min * 60_000 - now), total: s.min * 60_000 } : undefined);
const ALWAYS_LEAD = new Set(["intro", "why", "today", "outro", "next", "qa", "takeaway", "show"]); // nothing to reveal on these
const termsSoFar = (room) => [...new Set(room.path.slice(0, room.pos + 1).flatMap((id, k) => sceneAt(room, k).terms))].map((term) => ({ term, ...GLOSSARY[term] }));
const WAITING = { act: "Starting soon", type: "waiting", min: 0, notes: "Phones wait here. Begin from the console, or press Next." };
// The case studies the room picks from: the workshop's own, or every studied case of a composed program's workshops.
const studiesOf = (room) => {
  const ids = room.title ? [...new Set(Object.values(WORKSHOPS).filter((W) => W.chapters.some((c) => room.chapters.includes(c) && CHAPTERS[c].q)).flatMap((W) => W.studies))].slice(0, 4) : WORKSHOPS[room.workshop].studies;
  return ids.map((id) => ({ id, ...CASES[id] }));
};
const winnerOf = (room, s) => {
  const counts = s.options.map((_, i) => [...room.phones.values()].filter((p) => p.answers[s.id] === i).length);
  return studiesOf(room)[counts.indexOf(Math.max(...counts))];
};
const nextTrack = () => SERIES.find((x) => x.status === "Next");
// Where this workshop sits in the series: "Part 1 of 4".
const partOf = (room) => { const k = SERIES.findIndex((x) => (x.w || []).includes(room.workshop)); return k < 0 ? null : { n: k + 1, of: SERIES.length, series: "Monitoring series" }; };
// A composed program may carry its own title; its promise is its parts' questions.
const titled = (room) => (room.title ? { ...WORKSHOPS[room.workshop], title: room.title, promise: partsOf(room.chapters).map(([n]) => n).join(" · ") } : WORKSHOPS[room.workshop]);
// The chapter library, for the console's Compose view.
export const chapterList = () => Object.entries(CHAPTERS).filter(([, c]) => c.q).map(([id, c]) => ({ id, name: c.name, q: c.q, min: programMinutes([id]),
  in: Object.entries(WORKSHOPS).filter(([, W]) => W.chapters.includes(id)).map(([k, W]) => ({ w: +k, title: W.title })) }));
// The header names the step's chapter; the chapter's last step shows its line to remember.
const actAt = (room, k = room.pos) => (room.path[k]?.startsWith("fork:") ? "Your call" : CHAPTERS[room.part[k]]?.q ? CHAPTERS[room.part[k]].name : sceneAt(room, k).act); // bookends: the scene's own label
const rememberAt = (room, k = room.pos) => (room.part[k] !== room.part[k + 1] ? CHAPTERS[room.part[k]]?.remember : undefined);
// Each part's case on "Today": its first real (sourced) case, else its first example.
const leadCase = (c) => {
  const cases = c.scenes.filter((x) => typeof x === "string").map((id) => SCENE[id].case).filter(Boolean);
  const k = cases.find((x) => x.source) ?? cases[0];
  return k && { who: k.who, what: k.what, real: !!k.source };
};
const storyOf = (c) => c && { who: c.who, what: c.what, happened: c.happened, why: c.why, lesson: c.lesson, source: c.source, tell: c.tell, impact: c.impact, bridge: c.bridge };
// Why it matters: the workshop's own hook (a composed program uses its first workshop's).
const whyOf = (room) => { const w = WORKSHOPS[room.workshop].why; const c = CASES[w.case]; return { title: w.title, lead: w.lead, case: { who: c.who, what: c.what } }; };
// The outro: tease the next workshop, and the three ways to stay with the series.
const outroOf = (room) => {
  const W = WORKSHOPS[room.workshop], parts = room.chapters.filter((c) => CHAPTERS[c].q);
  const pick = (W.answers ?? parts).filter((c) => room.chapters.includes(c)).slice(0, 3);
  return { next: nextTrack(), series: SERIES, presenter: PRESENTER, answers: pick.map((c) => CHAPTERS[c].asks) };
};
// What "Today" covers: the workshop's own parts and key terms, plus every case its path tells.
const todayOf = (room) => {
  const W = titled(room);
  return { parts: room.chapters.map((c) => CHAPTERS[c]).filter((c) => c.q).map((c) => ({ name: c.name, q: c.q, hook: c.hook, min: Math.round(programMinutes([Object.keys(CHAPTERS).find((k) => CHAPTERS[k] === c)])), concept: c.concept, asks: c.asks, terms: (c.terms ?? []).filter((t) => !c.name.toLowerCase().includes(t.toLowerCase())) })), terms: termsOf(room.chapters).map((term) => ({ term, ...GLOSSARY[term] })),
    cases: room.chapters.filter((c) => CHAPTERS[c].q).map((c) => leadCase(CHAPTERS[c])).filter(Boolean) };
};
export function phoneView(room, p) {
  if (!room.begun) { const W = titled(room); return { ...WAITING, i: 0, n: room.path.length, id: "waiting", workshopId: room.workshop, title: W.title, workshop: W.title, promise: W.promise, part: partOf(room), people: room.phones.size, presenter: PRESENTER, terms: [],
    minutes: minutes(room, room.path.length), parts: partsOf(room.chapters).map(([name, q]) => ({ name, q })), host: { name: PRESENTER.name, photo: PRESENTER.photo, lead: AUDIENCES.tech.lead, items: AUDIENCES.tech.items } }; } // phones: tech only
  const s = sceneAt(room), shown = room.shown.has(s.id), W = titled(room);
  const v = { i: room.pos, n: room.path.length, id: s.id, type: s.type, workshopId: room.workshop, act: actAt(room), remember: rememberAt(room), title: shown && s.takeaway ? s.takeaway : s.title, how: s.how, step: s.type === "step" ? { flow: s.flow, viz: s.viz, example: s.example, live: s.live, parts: s.parts } : undefined, phone: s.phone, link: s.link,
    options: s.options, items: s.items, mode: s.mode, calls: s.calls, nines: s.type === "nines" ? NINES : undefined,
    slo: s.type === "slo" ? { ms: SLO_MS, pct: SLO_PCT, chosen: room.slo } : undefined,
    shown, answer: shown ? s.answer : undefined, mine: p?.answers[s.id], quiz: s.type === "termcheck" ? quizOf(room, s).map((x) => ({ term: x.term, options: x.options, answer: shown ? x.answer : undefined })) : undefined,
    termScore: s.type === "termcheck" && p ? termScore(room, p, s) : undefined, lead: shown || ALWAYS_LEAD.has(s.type) ? s.lead : undefined, why: shown ? s.why : undefined,
    workshop: W.title, promise: W.promise, terms: termsSoFar(room), curiousMine: !!p?.curious.has(s.id), chosen: s.chosen,
    group: room.groupsShown ? p?.group : undefined, broken: room.broken };
  if (s.type === "intro") Object.assign(v, { lead: AUDIENCES.tech.lead, items: AUDIENCES.tech.items, series: SERIES, intro: room.intro }); // phones: tech only
  if (s.type === "intro" || s.type === "qa") v.presenter = PRESENTER;
  if (s.type === "today") v.today = todayOf(room);
  if (s.type === "series") Object.assign(v, { series: SERIES, part: partOf(room) });
  if (s.type === "scan") v.people = room.phones.size;
  if (s.type === "road") v.road = roadOf(room, s, p, Date.now());
  if (s.type === "spread" || s.type === "basics" || (s.type === "step" && s.live)) v.results = results(room, s, Date.now());
  if (s.type === "step" && s.live && p) { const m = room.chat.findLast((c) => c.id === p.id); v.myLine = m ? logLine(m) : null; }
  if (s.type === "spread" && p) v.mineMs = pct(room.chat.filter((c) => c.id === p.id && c.ok).map(waited).filter((x) => x != null), 0.5);
  v.timer = timerOf(room, s);
  if (p) v.score = scoreOf(room, p);
  if (p) Object.assign(v, { points: pointsOf(room, p), rank: rankOf(room, p), of: room.phones.size, needName: room.names === "named" && !p.name, name: p.name });
  v.eyes = room.eyes;
  if (s.options) v.defs = defsOf(s);
  v.part = partOf(room);
  if (POLL_TYPES.has(s.type) || s.type === "cases" || s.type === "takeaway") v.tally = { done: results(room, s, Date.now()).total, of: room.phones.size };
  if (s.type === "cases") v.cards = studiesOf(room).map((c) => ({ who: c.who, what: c.what }));
  if (s.type === "why") v.why = whyOf(room);
  if (s.type === "cases" && shown) v.study = storyOf(winnerOf(room, s));
  if (s.type === "outro") Object.assign(v, outroOf(room));
  if (s.case) v.case = { who: s.case.who, what: s.case.what, happened: s.case.happened, real: !!s.case.source, bridge: s.bridge, impact: s.case.impact };
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
  const s = sceneAt(room), W = titled(room);
  const flexAhead = room.path.slice(room.pos + 1).filter((id) => SCENE[id]?.flex).map((id) => SCENE[id].title);
  return { i: room.pos, n: room.path.length, workshop: W.title, workshopId: room.workshop, promise: W.promise, part: partOf(room), begun: room.begun, waiting: room.begun ? undefined : { parts: partsOf(room.chapters).map(([name, q]) => ({ name, q })), minutes: minutes(room, room.path.length), lead: AUDIENCES.tech.lead }, act: room.begun ? actAt(room) : "Starting soon", remember: room.begun ? rememberAt(room) : undefined, scene: !room.begun ? { ...WAITING, id: "waiting", title: W.title } : room.shown.has(s.id) && s.takeaway ? { ...s, title: s.takeaway } : s, // the question, then the answer as the headline
    shown: room.shown.has(s.id), groupsShown: room.groupsShown, broken: room.broken,
    people: room.phones.size, results: results(room, s, now), slo: room.slo, curious: room.curious[s.id] || 0,
    audience: room.audience, speaker: AUDIENCES[room.audience], intro: room.intro, presenter: PRESENTER, series: SERIES, instrumented: room.instrumented, audiences: Object.entries(AUDIENCES).map(([k, x]) => ({ k, label: x.label })),
    workshops: Object.entries(WORKSHOPS).map(([k, x]) => ({ k: +k, title: x.title })),
    library: SCENES.map((x) => ({ id: x.id, title: x.title, act: x.act, min: x.min })),
    path: room.path, // the presenter's deep links: /screen?t=…#<step id>
    today: s.type === "today" ? todayOf(room) : undefined,
    road: s.type === "road" ? roadOf(room, s, null, now) : undefined,
    timer: timerOf(room, s, now),
    eyes: room.eyes, names: room.names, voters: room.voters, defs: s.options ? defsOf(s) : undefined,
    leaderboard: (QUIZ(s) || s.type === "termcheck") && room.shown.has(s.id) ? leaderboardOf(room, 5, s.id) : undefined,
    who: QUIZ(s) && room.shown.has(s.id) ? votersOf(room, s) : undefined,
    learning: s.type === "qa" ? learningOf(room) : undefined,
    why: s.type === "why" ? whyOf(room) : undefined,
    study: s.type === "cases" && room.shown.has(s.id) ? storyOf(winnerOf(room, s)) : undefined,
    cards: s.type === "cases" ? studiesOf(room).map((c) => ({ who: c.who, what: c.what })) : undefined,
    ...(s.type === "outro" ? outroOf(room) : {}),
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

// How the room learned: every question with a right answer the room reached, in order, with the
// share who got it right. Answers are already in the event log, so this costs no new collection.
export const learningOf = (room) => room.path.slice(0, room.pos + 1).map((id) => SCENE[id])
  .filter((s) => s && POLL_TYPES.has(s.type) && s.answer !== undefined)
  .map((s) => { const a = [...room.phones.values()].map((p) => p.answers[s.id]).filter((x) => x !== undefined);
    return { id: s.id, q: s.title, a: s.takeaway ?? s.options[s.answer], right: a.filter((x) => x === s.answer).length, total: a.length }; });
const scoreOf = (room, p) => { const qs = room.path.map((id) => SCENE[id]).filter((s) => s && POLL_TYPES.has(s.type) && s.answer !== undefined && p.answers[s.id] !== undefined);
  return { right: qs.filter((s) => p.answers[s.id] === s.answer).length, answered: qs.length }; };

// The road a message's telemetry travels. Delays are typical, not measured; the room's counts are
// how many messages have reached each stage by now.
export const ROADS = {
  logs: [
    { at: 0, name: "Written", what: "Relay prints one line to stdout" },
    { at: 1000, name: "Shipped", what: "A shipper sends it on: Fluent Bit, OTel Collector" },
    { at: 2500, name: "Stored", what: "Loki, CloudWatch or Elastic indexes it" },
    { at: 4000, name: "Searchable", what: "Anyone can find it by its id" },
  ],
  traces: [
    { at: 0, name: "Started", what: "Your phone starts the trace and sends traceparent" },
    { at: 300, name: "Spanned", what: "Relay times each step as a span" },
    { at: 1500, name: "Batched", what: "The SDK sends spans to the OTel Collector" },
    { at: 4000, name: "Visible", what: "Tempo or Jaeger shows the whole trace" },
  ],
};
// Log levels as the industry uses them (syslog / OpenTelemetry severity, simplified).
export const LEVELS = [
  ["DEBUG", "Detail for developers; usually off in production"],
  ["INFO", "Normal events: a request finished"],
  ["WARN", "Odd but still working: a slow request"],
  ["ERROR", "A request failed"],
  ["FATAL", "The process can't go on"],
];
const roadOf = (room, s, p, now) => {
  const stages = ROADS[s.mode], mine = p && room.chat.findLast((c) => c.id === p.id);
  return { mode: s.mode, stages, now, mine: mine ? { t: mine.t, line: logLine(mine), trace: mine.trace ?? null } : null,
    counts: stages.map((st) => room.chat.filter((c) => now - c.t >= st.at).length),
    // lines go to the big screen only: phones would redraw on every message
    lines: s.mode === "logs" && !p ? room.chat.slice(-6).map(logLine) : undefined, levels: s.mode === "logs" ? LEVELS : undefined };
};

// A short definition under each answer that names a term ("Logs" -> log), so anyone can answer.
const defOf = (o) => { const k = String(o).toLowerCase(); const g = GLOSSARY[k] || GLOSSARY[k.replace(/s$/, "")]; return g ? g.def.split(/(?<=\.)\s/)[0] : undefined; };
export const defsOf = (s) => (s.options && s.options.some((o) => defOf(o)) ? s.options.map(defOf) : undefined);

// ---- term checks: five 4-option "what does it mean?" questions as a part opens, then every one again at the end.
// Options are the term's definition plus three from the same check, in a fixed order, so screen and phones agree.
const qh = (x) => [...x].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
const checkOf = (term) => SCENES.find((x) => x.type === "termcheck" && !x.final && x.quiz.includes(term));
const QUIZ_ITEMS = new Map();
export const quizItem = (term) => QUIZ_ITEMS.get(term) ?? (QUIZ_ITEMS.set(term, makeItem(term)), QUIZ_ITEMS.get(term));
const makeItem = (term) => {
  const pool = checkOf(term).quiz, opts = [term, ...pool.filter((t) => t !== term).sort((a, b) => qh(term + a) - qh(term + b)).slice(0, 3)].sort((a, b) => qh(a + term) - qh(b + term));
  return { term, options: opts.map((t) => GLOSSARY[t].def), answer: opts.indexOf(term) };
};
const quizTerms = (room, s) => (s.final ? [...new Set(room.path.slice(0, room.path.indexOf(s.id)).map((id) => SCENE[id]).filter((x) => x?.type === "termcheck" && !x.final).flatMap((x) => x.quiz))] : s.quiz);
export const quizOf = (room, s) => quizTerms(room, s).map(quizItem);
const rightIn = (room, p, s) => { const m = p?.answers[s.id] || {}; return quizOf(room, s).filter((it, k) => m[k] === it.answer).length; };
const firstTry = (room, p, terms) => terms.filter((t) => { const c = checkOf(t); return room.path.includes(c.id) && p?.answers[c.id]?.[c.quiz.indexOf(t)] === quizItem(t).answer; }).length;
const termScore = (room, p, s) => { const n = quizTerms(room, s).length; return s.final ? { n, before: firstTry(room, p, quizTerms(room, s)), after: rightIn(room, p, s) } : { n, right: rightIn(room, p, s) }; };
const termPoints = (room, p, skip) => room.path.map((id) => SCENE[id]).filter((s) => s?.type === "termcheck" && s.id !== skip && room.shown.has(s.id)).reduce((a, s) => a + 100 * rightIn(room, p, s), 0); // scores at the reveal, never before
function termResults(room, s) {
  const items = quizOf(room, s), ps = [...room.phones.values()];
  const per = items.map((it, k) => { const as = ps.map((p) => p.answers[s.id]?.[k]).filter((a) => a !== undefined); return { term: it.term, def: GLOSSARY[it.term].def, right: as.filter((a) => a === it.answer).length, total: as.length }; });
  const done = ps.filter((p) => Object.keys(p.answers[s.id] || {}).length >= items.length).length;
  if (!s.final) return { items: per, done, people: ps.length };
  const rows = ps.filter((p) => p.answers[s.id]).map((p) => ({ name: displayName(room, p), ...termScore(room, p, s) }));
  const avg = (f) => (rows.length && items.length ? rows.reduce((a, r) => a + f(r), 0) / rows.length / items.length : 0);
  return { items: per, done, people: ps.length, n: items.length, before: avg((r) => r.before), after: avg((r) => r.after),
    improved: rows.filter((r) => r.after > r.before).sort((a, b) => b.after - b.before - (a.after - a.before)).slice(0, 3).map(({ name, before, after }) => ({ name, before, after })) };
}

// The game: a right answer scores 500 plus up to 500 for speed (time left on that step's countdown).
const QUIZ = (s) => s && POLL_TYPES.has(s.type) && s.answer !== undefined;
export const pointsOf = (room, p, skip) => termPoints(room, p, skip) + room.path.map((id) => SCENE[id]).filter((s) => QUIZ(s) && s.id !== skip).reduce((sum, s) => {
  if (p.answers[s.id] !== s.answer) return sum;
  const from = room.arrived[s.id], total = s.min * 60_000, used = from != null && p.at[s.id] != null ? (p.at[s.id] - from) / total : 1;
  return sum + 500 + Math.round(500 * Math.max(0, Math.min(1, 1 - used)));
}, 0);
const displayName = (room, p) => (room.names === "named" && p.name ? p.name : `Player ${p.n}`);
// The top players, and how many places each moved because of this question (+ up, - down).
export const leaderboardOf = (room, top = 5, sid) => {
  const ps = [...room.phones.values()], now = ps.map((p) => pointsOf(room, p)), was = sid ? ps.map((p) => pointsOf(room, p, sid)) : now;
  const rank = (pts, i) => 1 + pts.filter((x) => x > pts[i]).length;
  return ps.map((p, i) => ({ name: displayName(room, p), points: now[i], move: rank(was, i) - rank(now, i) }))
    .sort((a, b) => b.points - a.points).slice(0, top);
};
const rankOf = (room, p) => { const mine = pointsOf(room, p); return 1 + [...room.phones.values()].filter((x) => pointsOf(room, x) > mine).length; };
const votersOf = (room, s) => room.names === "named" && room.voters && s.options
  ? s.options.map((_, i) => [...room.phones.values()].filter((p) => p.answers[s.id] === i).map((p) => displayName(room, p))) : undefined;

// The run report: reach, presence over time (the churn curve), engagement, learning, conversion and
// reconnection, from one run's events. "Last seen" is a phone's latest beat, answer or send.
export function reportOf(room, events) {
  const t0 = events[0]?.data?.t ?? 0, end = events.at(-1)?.data?.t ?? t0;
  const seen = new Map();
  for (const ev of events) if (ev.phone && ev.data?.t) seen.set(ev.phone, Math.max(seen.get(ev.phone) || 0, ev.data.t));
  const phones = [...room.phones.values()];
  const presentAt = (t) => phones.filter((p) => p.joinedAt <= t && (seen.get(p.id) || p.joinedAt) >= t).length;
  const minutes = [0, 15, 30, 45, 60].filter((m) => t0 + m * 60_000 <= end + 60_000);
  const quiz = room.path.map((id) => SCENE[id]).filter((s) => s && (POLL_TYPES.has(s.type) || s.type === "cases") && room.arrived[s.id] != null);
  const polls = quiz.map((s) => { const answered = phones.filter((p) => p.answers[s.id] !== undefined).length, present = Math.max(1, presentAt(room.arrived[s.id]));
    return { id: s.id, q: s.title, answered, present, rate: answered / present, right: s.answer !== undefined ? phones.filter((p) => p.answers[s.id] === s.answer).length : undefined }; });
  const concepts = {};
  for (const s of quiz.filter((x) => x.answer !== undefined)) for (const c of s.concepts) {
    const k = (concepts[c] ??= { right: 0, total: 0 });
    for (const p of phones) if (p.answers[s.id] !== undefined) { k.total++; if (p.answers[s.id] === s.answer) k.right++; }
  }
  const churned = phones.filter((p) => (seen.get(p.id) || p.joinedAt) < end - 10 * 60_000).length;
  const before = polls.find((x) => x.id === "mean"), after = polls.find((x) => x.id === "mean-again");
  return {
    reach: { scanned: room.scans, joined: room.joins, phones: phones.length },
    presence: minutes.map((m) => ({ minute: m, present: presentAt(t0 + m * 60_000) })),
    churnRate: phones.length ? churned / phones.length : null,
    reconnectionRate: room.joins ? room.reconnects / room.joins : null,
    polls, concepts,
    learning: before && after ? { before: before.right / Math.max(1, before.answered), after: after.right / Math.max(1, after.answered) } : null,
    terms: (() => { const fin = room.path.map((id) => SCENE[id]).find((x) => x?.type === "termcheck" && x.final); if (!fin) return null; const r = termResults(room, fin); return { n: r.n, before: r.before, after: r.after, items: r.items }; })(),
    ctas: room.ctas,
  };
}

// ---- after the room: the recap and the follow-up ---------------------------------------------------
export const TAKEAWAYS = new Set(SCENES.filter((s) => s.type === "takeaway").map((s) => s.id));
/** The run that starts at event `r`: its events up to the next start or reset, folded into a room. */
export function runOf(events, r) {
  const run = [];
  for (const ev of events) {
    if (ev.id < r) continue;
    if (ev.id > r && ev.kind === "control" && ["start", "reset"].includes(ev.data?.op)) break;
    run.push(ev);
  }
  return run[0]?.id === r && run[0].kind === "control" ? run.reduce(reduce, fresh()) : null;
}
/** What stays public after the room closes: the plan, the room's numbers, and (with the phone's link) your own. */
export function recapView(room, p) {
  const W = titled(room), all = room.chat.map(waited).filter((x) => x != null);
  const take = room.path.map((id) => SCENE[id]).find((s) => s && s.type === "takeaway");
  const picks = take ? [...room.phones.values()].map((x) => x.answers[take.id]).filter((a) => a !== undefined) : [];
  const cases = room.path.map((id) => SCENE[id]?.case).filter((c) => c?.source).map(({ who, what, source }) => ({ who, what, source }));
  const v = { title: W.title, promise: W.promise, parts: room.chapters.map((c) => CHAPTERS[c]).filter((c) => c.q).map(({ name, q, remember }) => ({ name, q, remember })),
    terms: termsOf(room.chapters).map((term) => ({ term, ...GLOSSARY[term] })), cases,
    room: { people: room.phones.size, messages: room.chat.length, p95: pct(all, 0.95) },
    monday: take ? { items: take.items, counts: take.items.map((_, i) => picks.filter((a) => a === i).length) } : null,
    learning: learningOf({ ...room, pos: room.path.length - 1 }) };
  if (p) { const ms = room.chat.filter((c) => c.id === p.id).map(waited).filter((x) => x != null);
    v.mine = { sent: ms.length, p95: pct(ms, 0.95), pick: take ? take.items[p.answers[take.id]] : undefined, score: scoreOf(room, p) }; }
  return v;
}
