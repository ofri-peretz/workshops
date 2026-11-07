// Self-check: node test.mjs — exits non-zero if the library, the workshops or Relay's behaviour breaks.
// Runs the same handler the Vercel function uses, on the in-memory store.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SCENES, SCENE, POLL_TYPES, PRESENTER } from "./scenes.mjs";
import { CONCEPTS, GLOSSARY } from "./concepts.mjs";
import { CASES } from "./cases.mjs";
import { WORKSHOPS, SERIES, CHAPTERS } from "./workshops.mjs";
import { GROUPS, fresh, reduce, sceneAt, checkTrace, buildTrace, SPAN_NAMES } from "./core.mjs";
import { createServer } from "./server.mjs";

// ---- the library: nothing taught is ever dropped, every term is defined --------------------------
assert.equal(new Set(SCENES.map((s) => s.id)).size, SCENES.length, "scene ids are unique");
const uncovered = (scenes) => Object.keys(CONCEPTS).filter((c) => !scenes.some((s) => s.concepts.includes(c)));
assert.deepEqual(uncovered(SCENES), [], "every concept has a scene");
assert.deepEqual(uncovered(SCENES.filter((s) => s.id !== "impact")), ["percentile-impact"], "mutation: dropping a concept's only scene fails");
for (const s of SCENES) {
  for (const c of s.concepts) assert.ok(CONCEPTS[c], `${s.id}: unknown concept ${c}`);
  for (const t of s.terms) assert.ok(GLOSSARY[t], `${s.id}: term "${t}" is not in the glossary`);
}
for (const t of Object.keys(GLOSSARY)) assert.ok(SCENES.some((s) => s.terms.includes(t)), `glossary term "${t}" is taught by no scene`);
for (const s of SCENES.filter((x) => POLL_TYPES.has(x.type))) {
  assert.ok(s.options?.length >= 2, `${s.id} has options`);
  if (s.answer !== undefined) assert.ok(s.answer >= 0 && s.answer < s.options.length, `${s.id} answer is an option`);
}

// ---- the hosted database accepts every event the handler writes (schema.sql mirrors it) ----------
const allowedKinds = (sql) => sql.match(/relay_events_kind_check[\s\S]*?array\[([^\]]*)\]/)[1].match(/'([^']+)'/g).map((k) => k.slice(1, -1));
const handlerSrc = readFileSync(new URL("./handler.mjs", import.meta.url), "utf8");
const written = [...new Set([...handlerSrc.matchAll(/(?:append\(|kind: )"(\w+)"/g)].map((m) => m[1]))];
const schemaSql = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
assert.deepEqual(written.filter((k) => !allowedKinds(schemaSql).includes(k)), [], "schema.sql allows every event kind the handler writes");
assert.deepEqual(written.filter((k) => !allowedKinds(schemaSql.replace(",'curious'", "")).includes(k)), ["curious"], "mutation: a kind missing from the schema fails");

// ---- every workshop, over every combination of fork choices, fits its minutes -------------------
for (const [w, W] of Object.entries(WORKSHOPS)) {
  const ids = W.spine.filter((x) => typeof x === "string"), forks = W.spine.filter((x) => typeof x !== "string");
  // The arc every workshop follows: who I am, why it matters, what we'll cover; hands-on chapters;
  // then the case studies the room picks, the one thing for Monday, questions, and the outro.
  assert.deepEqual(ids.slice(0, 4), ["intro", "series", "today", "scan"], `workshop ${w} opens: who I am, the series, what we'll cover, then the one QR`);
  assert.ok(ids.indexOf("why") > 4 && ids.indexOf("why") < 9, `workshop ${w}: why it matters comes right after the room's first hands-on moment`);
  assert.equal(ids.filter((x) => x === "scan").length, 1, `workshop ${w}: one QR, once`);
  assert.deepEqual([ids.at(-4), ids.at(-2), ids.at(-1)], ["cases", "qa", "outro"], `workshop ${w} closes: case studies, Monday, questions, outro`);
  assert.ok(W.why?.title && W.why.lead && W.why.abt && CASES[W.why.case]?.source, `workshop ${w}: a why with a real case`);
  assert.ok(W.studies.length >= 3 && W.studies.every((c) => CASES[c]?.source), `workshop ${w}: at least 3 real case studies for the room to pick from`);
  assert.equal(new Set(W.studies.map((c) => CASES[c].cause)).size, W.studies.length, `workshop ${w}: its case studies each have a different root cause`);
  const taught = new Set([...ids, ...forks.flatMap((f) => f.detours.flatMap((d) => d.scenes))].flatMap((id) => SCENE[id].terms));
  for (const t of W.terms) assert.ok(taught.has(t), `workshop ${w}: "Today" promises the term "${t}", which no scene on its path teaches`);
  assert.ok(W.terms.length <= 10 && W.parts.length >= 2 && W.parts.length <= 5, `workshop ${w}: 2-5 parts, at most 10 terms on "Today"`);

  for (const f of forks) for (const d of f.detours) for (const id of [...d.scenes, ...d.after]) assert.ok(SCENE[id], `${w}/${f.fork}: unknown scene ${id}`);
  for (const id of ids) assert.ok(SCENE[id], `workshop ${w}: unknown scene ${id}`);
  const base = ids.reduce((t, id) => t + SCENE[id].min, 0);
  const combos = forks.reduce((acc, f) => acc.flatMap((c) => f.detours.map((d) => [...c, d])), [[]]);
  for (const c of combos) {
    const total = base + c.reduce((t, d) => t + d.scenes.reduce((u, id) => u + SCENE[id].min, 0), 0);
    assert.equal(total + (W.buffer ?? 0), W.minutes ?? 30, `workshop ${w} via ${c.map((d) => d.title).join(" / ")} is ${W.minutes ?? 30} min (with its buffer)`);
  }
}

// The case bank: every case is easy to tell in three beats, and every real one names its source.
for (const [id, c] of Object.entries(CASES)) {
  assert.ok(["company", "government", "research", "example"].includes(c.kind), `${id}: kind`);
  assert.ok(c.kind === "example" ? c.who.startsWith("Example:") : c.source?.startsWith("https://"), `${id}: a real case has its source; an example says so`);
  for (const [k, max] of [["who", 4], ["what", 8], ["happened", 20], ["why", 15], ["lesson", 10]])
    assert.ok(c[k] && c[k].split(/\s+/).length <= max, `${id}: ${k} in ${max} words or fewer`);
  assert.ok(c.tell.startsWith("Say: ") && c.cause, `${id}: a tell for the notes and a root cause`);
}

// Every chapter is told the same way: a question; it opens on a question, a case or the room doing
// something; the room tries it on their phones; one line to remember; its terms taught inside it.
const HANDS_ON = new Set([...POLL_TYPES, "chat", "metrics", "logs", "trace", "dots", "journey", "requests", "fanout", "load", "slo", "nines"]);
for (const [id, c] of Object.entries(CHAPTERS)) {
  if (!c.q) continue;
  const ids = c.scenes.flatMap((x) => (typeof x === "string" ? [x] : x.detours.flatMap((d) => d.scenes)));
  const first = typeof c.scenes[0] === "string" ? SCENE[c.scenes[0]] : { type: "fork" };
  assert.ok(HANDS_ON.has(first.type) || first.case, `${id}: opens on a question, a case, or the room doing something`);
  assert.ok(ids.some((x) => HANDS_ON.has(SCENE[x].type)), `${id}: the room tries it on their phones`);
  assert.ok(c.remember && c.remember.split(/\s+/).length <= 8 && !/\.$/.test(c.remember), `${id}: one line to remember, 8 words at most, no period`);
  assert.ok(c.name.split(/\s+/).length <= 3 && c.q.split(/\s+/).length <= 8, `${id}: name 3 words, question 8`);
  assert.ok(c.hook && c.hook.split(/\s+/).length <= 6 && !/\.$/.test(c.hook), `${id}: a hook, what you'll do, in 6 words`);
  assert.ok(c.concept?.split(/\s+/).length <= 5 && c.asks?.endsWith("?") && c.asks.split(/\s+/).length <= 10, `${id}: a concept (5 words) and the business question it answers (10 words)`);
  const taught = new Set(ids.flatMap((x) => SCENE[x].terms));
  assert.ok(c.scenes.some((x) => typeof x === "string" && SCENE[x].case?.source?.startsWith("https://")), `${id}: tells at least one real, sourced case on its main line`);
  assert.ok((c.terms ?? []).length <= 4 && c.terms.every((t) => taught.has(t)), `${id}: up to 4 key terms, each taught inside the chapter`);
}

// Replaying the same log gives the same room (what every serverless instance relies on).
const log = [{ id: 1, phone: "a", kind: "join", data: {} }, { id: 2, phone: "b", kind: "join", data: {} }, { id: 3, kind: "control", data: { op: "next" } }];
const r1 = log.reduce(reduce, fresh()), r2 = log.reduce(reduce, fresh());
assert.deepEqual([...r1.phones.values()].map((p) => p.group), [...r2.phones.values()].map((p) => p.group));
assert.equal(r1.pos, 1);

let coin = 0; // deterministic randomness: alternate 0 and 0.99
const { server, store, code: CODE } = createServer({ scale: 0.01, token: "t", random: () => (coin++ % 2 ? 0.99 : 0) });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/api`;
const room = () => store.room();
const here = () => sceneAt(room()).id;
const ctl = (op, extra = {}) => fetch(base + "/control?t=t", { method: "POST", body: JSON.stringify({ op, ...extra }) });
const go = (id) => ctl("goto", { i: room().path.indexOf(id) });
const screen = async () => (await fetch(base + "/screen?t=t")).json();
async function phone() {
  const r = await fetch(base + "/join", { method: "POST", body: JSON.stringify({ code: CODE }) });
  const cookie = r.headers.get("set-cookie").split(";")[0];
  const call = (path, body, headers = {}) => fetch(base + path, { method: "POST", headers: { cookie, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  call.view = async () => (await fetch(base + "/view", { headers: { cookie } })).json();
  call.cookie = cookie;
  return call;
}

// Four phones land in four different groups; slower groups wait longer.
let phones = await Promise.all([1, 2, 3, 4].map(phone));
assert.deepEqual(GROUPS.map((g) => [...room().phones.values()].filter((p) => p.group === g).length), [1, 1, 1, 1]);
const times = await Promise.all(phones.map(async (call) => { const t0 = performance.now(); await call("/send", {}); return performance.now() - t0; }));
assert.ok(Math.max(...times) >= 60 && Math.min(...times) < Math.max(...times), "groups differ (7 s → 70 ms at scale 0.01)");

// Who I am depends on the audience; phones only ever get the tech version (the phone page is public).
assert.equal((await ctl("audience", { a: "nobody" })).status, 400);
await ctl("audience", { a: "jewish-community" });
await ctl("detour", { id: "intro" }); // the intro is a library slide now; the waiting screen carries the host
const screenIntro = await screen();
assert.equal(screenIntro.scene.type, "intro");
assert.ok(screenIntro.speaker.items.some((x) => x.includes("Amichai")) && screenIntro.speaker.items.some((x) => x.includes("8200")));
const phoneIntro = await (await phones[0]("/join")).json();
assert.ok(phoneIntro.items.length && !phoneIntro.items.some((x) => /8200|Amichai/.test(x)), "phones never show military or personal background");
assert.equal(phoneIntro.promise, WORKSHOPS[1].promise);
assert.deepEqual(phoneIntro.presenter.links.map((l) => l.label), ["LinkedIn", "dev.to", "GitHub", "Blog"], "the intro carries the presenter's links");

// An impatient second tap counts as a resend; the phone's measured time attaches to its message.
const slowest = phones[times.indexOf(Math.max(...times))];
await slowest("/send", { again: true });
assert.equal([...room().phones.values()].reduce((t, p) => t + p.dups, 0), 1);
assert.equal((await slowest("/rtt", { ms: 7100 })).status, 200);
assert.ok([...room().phones.values()].some((p) => p.last?.rtt === 7100));

// Polls: only valid answers, counted, closed once the answer is revealed. Terms build up on phones.
await go("timeout");
assert.equal((await phones[0]("/answer", { value: 9 })).status, 400);
assert.equal((await phones[0]("/answer", { value: 1 })).status, 200);
await ctl("reveal");
assert.equal((await phones[1]("/answer", { value: 0 })).status, 409);
const terms = (await (await phones[0]("/join")).json()).terms.map((t) => t.term);
assert.ok(terms.includes("latency") && terms.includes("timeout") && !terms.includes("p99"), "phones get the terms taught so far");

// Go deeper: once per phone per scene; it orders the fork's options when the room reaches it.
await go("felt");
assert.equal((await phones[0]("/curious")).status, 200);
assert.equal((await phones[0]("/curious")).status, 409);
await phones[1]("/curious");
assert.equal((await screen()).curious, 2);
await go("fork:w1");
let fork = sceneAt(room());
assert.equal(fork.type, "fork");
assert.equal(fork.order[0], 1, "the detour that deepens 'felt' is offered first");

// The fork: the room votes, Reveal takes the winner, the detour plays, then back to the spine.
for (const [k, call] of phones.entries()) await call("/answer", { value: k < 3 ? 0 : 1 });
await ctl("reveal");
assert.equal(room().choices.w1, 1);
assert.equal((await phones[0]("/answer", { value: 1 })).status, 409, "votes close once chosen");
await ctl("next");
assert.equal(here(), "again");
await ctl("next");
assert.equal(here(), "impact");
await ctl("next");
assert.equal(here(), "requests", "back on the spine after the detour");
assert.equal((await screen()).total, WORKSHOPS[1].minutes + SCENE.intro.min, "the chosen path keeps the workshop's length (plus the intro played from the library)");

// A library jump plays any scene now, costs its minutes, and names the flex scenes to skip.
await ctl("detour", { id: "n1" });
assert.equal(here(), "n1");
const jumped = await screen();
assert.equal(jumped.over, SCENE.intro.min + 2, "library jumps add up");
assert.equal(jumped.total, WORKSHOPS[1].minutes + SCENE.intro.min + 2, "the jump adds its minutes");
assert.ok(jumped.flexAhead.includes(SCENE.aws.title));
await ctl("next");
assert.equal(here(), "aws", "back to the spine after a jump: on to the next spine scene");
assert.equal((await ctl("detour", { id: "nope" })).status, 400);

// The outage: errors appear and the status page shows it.
await ctl("break");
const codes = await Promise.all([1, 2, 3, 4].map(() => phones[0]("/request").then((r) => r.status)));
assert.ok(codes.includes(500) && codes.includes(200), "some requests fail while broken");
assert.equal((await (await fetch(base + "/status")).json()).components[0].status, "Partial outage");
await ctl("fix");

// Fan-out: a job is slow when any of its 100 calls is.
coin = 0;
assert.equal((await (await phones[3]("/job")).json()).slow, true);

// Load: past Relay's workers, requests wait longer.
const waits = await Promise.all([...Array(45)].map(() => phones[0]("/load").then((r) => r.json()).then((b) => b.ms)));
assert.ok(Math.max(...waits) >= 2 * Math.min(...waits), "queueing doubles the slowest wait");

// Traces: every message is a measured trace that continues the phone's traceparent.
const TID = "4bf92f3577b34da6a3ce929d0e0e4736";
const sent = await (await phones[3]("/send", {}, { traceparent: `00-${TID}-00f067aa0ba902b7-01` })).json();
assert.equal(sent.trace, TID, "the server continues the phone's trace");
assert.deepEqual(checkTrace(sent.spans), [], "spans sit inside their parent and the required ones are there");
assert.deepEqual(checkTrace(sent.spans.filter((x) => x.n !== "relay.deliver")), ["missing relay.deliver"], "mutation: a dropped span fails");
const deliver = sent.spans.find((x) => x.n === "relay.deliver");
const g3 = room().phones.get(phones[3].cookie.split("=")[1]).group; // joins race, so look the phone up by its id
assert.ok(deliver.d >= g3 * 0.01 * 0.8, "relay.deliver is the group's wait");
assert.ok(!sent.spans.some((x) => x.n === "db.pool.acquire"), "no span on the pool wait before Add span");
assert.equal((await phones[3]("/rtt", { ms: 500, trace: TID, spans: sent.spans, phases: { request: [5, 400], response: [405, 3] } })).status, 200);
const tr = buildTrace(room().chat.findLast((c) => c.trace === TID));
assert.ok(tr.gaps.some((x) => x.dur >= 50), "the gap nobody owns shows in the trace");
assert.ok(tr.spans.every((x) => SPAN_NAMES.includes(x.name)), "span names come from the allowed list");
assert.ok(![...room().phones.keys()].some((id) => JSON.stringify(tr).includes(id)), "a trace never carries the phone id");
const bad = await (await phones[3]("/send", {}, { traceparent: "nonsense" })).json();
assert.match(bad.trace, /^[0-9a-f]{32}$/);
assert.notEqual(bad.trace, TID, "a malformed traceparent gets a fresh trace id");
assert.equal((await phones[3]("/rtt", { ms: 5, trace: bad.trace, spans: [{ n: "evil", s: 0, d: 1 }] })).status, 400, "unknown spans are rejected");
await ctl("instrument");
const fixed = await (await phones[3]("/send", {})).json();
await phones[3]("/rtt", { ms: 400, trace: fixed.trace, spans: fixed.spans });
assert.ok(fixed.spans.some((x) => x.n === "db.pool.acquire"), "after Add span the wait has a span");
assert.ok(!buildTrace(room().chat.findLast((c) => c.trace === fixed.trace)).gaps.some((x) => x.dur >= 50), "and the gap is gone");

// Presenter controls and the projector's data need the token; reset clears the room.
assert.equal((await fetch(base + "/control", { method: "POST", body: "{}" })).status, 403);
assert.equal((await fetch(base + "/screen")).status, 403);
await ctl("reset");
assert.equal(room().phones.size, 0);
assert.equal(room().audience, "jewish-community", "reset keeps the event's audience");
assert.equal(room().path.length, WORKSHOPS[1].spine.length, "reset restores the spine");

// Each workshop is its own session: Next stops at its end; Start switches with an empty room.
await go("outro");
await ctl("next");
assert.equal(here(), "outro", "Next stops at the end of the workshop");
assert.equal((await ctl("start", { w: 9 })).status, 400, "an unknown workshop is refused");
assert.equal((await ctl("start", { w: 2, intro: "maybe" })).status, 400, "an unknown intro is refused");
assert.equal((await ctl("start", { w: 2, a: "nobody" })).status, 400, "an unknown audience is refused");
await ctl("start", { w: 2, a: "tech", intro: "returning" });
assert.deepEqual([room().intro, room().audience], ["returning", "tech"], "the console sets the intro and audience as it opens the room");
await ctl("reset");
assert.equal(room().intro, "returning", "a reset keeps the intro");
await ctl("start", { w: 2, wait: true });
assert.equal(here(), "intro");
const waiter = await phone();
assert.equal((await waiter.view()).type, "waiting", "after Go live, phones wait for the presenter");
assert.equal((await screen()).scene.type, "waiting", "the big screen waits too, with the join code");
await ctl("begin");
assert.equal((await waiter.view()).type, "intro", "Begin starts every phone where the presenter is");
await ctl("start", { w: 2, wait: true });
await ctl("next");
assert.equal([here(), (await screen()).scene.type].join(), "intro,intro", "Next from the waiting room begins on the intro");
await ctl("prev");
assert.equal(here(), "intro", "Back stops at the start");

// Workshop 2: the room's incident update is posted, fix resolves; Next at a fork takes the default.
phones = await Promise.all([1, 2].map(phone));
await go("outage");
await ctl("break");
await go("update");
await phones[0]("/answer", { value: 1 });
await ctl("reveal");
assert.ok(room().incidents[0].updates.some((u) => u.text.startsWith("Some messages fail")), "winning update is posted");
await ctl("fix");
assert.ok((await (await fetch(base + "/status")).json()).incidents[0].updates.at(-1).text.startsWith("Resolved"));
await go("fork:w2");
await ctl("next");
assert.equal(here(), "graphql", "Next without a vote takes the default detour");
await ctl("start", { w: 3 });
assert.equal((await screen()).total, WORKSHOPS[3].minutes);

// ---- Signals: 60 minutes; its live demos read the room's own messages ---------------------------
await ctl("start", { w: 5 });
assert.equal((await screen()).total + WORKSHOPS[5].buffer, 60, "Signals is 60 minutes, buffer included");
const sig = [await phone(), await phone()];
for (const ph of sig) for (let i = 0; i < 3; i++) await ph("/send", {});
await go("sig-metrics");
const m = (await screen()).results;
assert.equal(m.total, 6, "the counter counts every message");
assert.deepEqual(m.buckets, [...m.buckets].sort((a, b) => a - b), "histogram buckets are cumulative");
assert.ok(m.p95 != null && m.p95FromBuckets != null, "p95 exact and from buckets");
const mine = await sig[0].view();
assert.equal(mine.mySent, 3, "each phone sees its own counter");
const prom = await (await fetch(base + "/metrics")).text();
assert.match(prom, /^# TYPE relay_messages_total counter$/m);
assert.match(prom, /^relay_send_duration_seconds_bucket\{le="\+Inf"\} \d+$/m);
for (const line of prom.trim().split("\n")) assert.match(line, /^(# (HELP|TYPE) \w+ .+|\w+(\{[^}]*\})? -?[\d.]+)$/, `valid Prometheus text: ${line}`);
await go("sig-logs");
const logs = await sig[1].view();
assert.equal(logs.myLines.length, 3, "a phone finds its own lines");
assert.ok(logs.myLines.every((l) => l.client === logs.client && /^[0-9a-f]{32}$/.test(l.trace_id)), "every log line carries the client and a trace id");
assert.ok(!JSON.stringify(logs.lines).includes(sig[0].cookie.split("=")[1]), "log lines never show a phone's cookie id");

// ---- the room is closed unless the presenter opened it; the join code is guarded -----------------
const join = (code, ip = "198.51.100.1") => fetch(base + "/join", { method: "POST", headers: { "x-forwarded-for": ip }, body: JSON.stringify({ code }) });
const wrong = CODE === "000000" ? "000001" : "000000";
const insider = await phone();
assert.equal((await join("12")).status, 401, "a malformed code is refused");
for (let i = 1; i <= 5; i++) assert.equal((await join(wrong)).status, 401, `wrong try ${i} is 401`);
assert.equal((await join(CODE)).status, 429, "the 6th try from one network is rate-limited, even with the right code");
assert.equal((await join(CODE, "198.51.100.2")).status, 200, "another network still joins");
store.setAccess({ joinUntil: Date.now() - 1 });
assert.equal((await join(CODE, "198.51.100.3")).status, 401, "an expired code admits nobody new");
assert.equal((await insider("/curious")).status !== 403, true, "phones already in keep working after the code expires");
store.setAccess({ joinUntil: Infinity, openedAt: Date.now() });
for (let i = 0; i < 29; i++) await join(wrong, `203.0.113.${i}`);
assert.equal((await join(wrong, "203.0.113.200")).status, 429, "30 wrong tries across the room lock joining");
assert.equal((await join(CODE, "203.0.113.201")).status, 429, "locked means locked, even with the right code");
store.setAccess({ liveUntil: Date.now() - 1 });
for (const path of ["/view", "/send", "/status"]) assert.equal((await insider(path)).status, 403, `closed: ${path} is 403`);
assert.equal((await fetch(base + "/metrics")).status, 403, "closed: /metrics is 403 too");
assert.equal((await fetch(base + "/status")).status, 403, "closed: the status page API is 403 too");
assert.equal((await screen()).total !== undefined, true, "the presenter's screen still works while closed");

// Headlines follow docs/storytelling.md: a few words, the takeaway as a claim. Enforced on the Signals path.
const words = (t = "") => t.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
const within = (what, text, max) => assert.ok(words(text) <= max, `${what}: "${text}" is ${words(text)} words, max ${max}`);
for (const [k, W] of Object.entries(WORKSHOPS)) { within(`workshop ${k} name`, W.title, 3); within(`workshop ${k} tagline`, W.promise, 8); assert.ok(!/\.$/.test(W.promise), `workshop ${k} tagline ends without a period`); }
for (const x of SERIES) within(`series ${x.track}`, x.what, 8);
for (const [k, W] of Object.entries(WORKSHOPS)) for (const [name, q] of W.parts) { within(`workshop ${k} part`, name, 3); within(`workshop ${k} part question`, q, 8); }
for (const id of WORKSHOPS[5].spine.filter((id) => typeof id === "string" && !["intro", "qa"].includes(id))) {
  const s = SCENE[id];
  within(`${id} headline`, s.title, 10);
  within(`${id} takeaway`, s.takeaway, 8);
  within(`${id} subline`, s.lead, 12);
  within(`${id} phone line`, s.phone, 12);
  for (const it of s.items || []) within(`${id} item`, it, 8);
  for (const h of [s.title, s.takeaway].filter(Boolean)) assert.ok(!/\.$/.test(h), `${id}: a headline has no closing period: "${h}"`);
  if (s.case) { within(`${id} case`, s.case.who, 4); within(`${id} case line`, s.case.what, 8); }
  if (s.case) assert.ok(s.case.source || s.case.who.startsWith("Example:"), `${id}: a case is real (with its source) or labelled Example`);
  if (s.type === "poll" && s.answer !== undefined) assert.ok(s.takeaway, `${id}: a question with an answer reveals a takeaway headline`);
}

await ctl("start", { w: 5 });
await go("today");
const today = (await screen()).today;
assert.deepEqual(today.parts.map((x) => x.name), ["Feel it", "Metrics", "Logs", "Traces", "The outage"], "Today lists Signals' parts");
assert.deepEqual(today.cases.map((c) => c.who), ["US unemployment insurance, 2020", "Amazon Dynamo, 2007", "Twitter, 2018", "Google Dapper, 2010", "AWS S3, 2017"], "Today names each part's first real case");
await go("signals");
assert.equal((await screen()).act, "Feel it", "the header names the chapter, as Today does, not the scene's library label");
await go("sig-metrics");
assert.equal((await screen()).remember, undefined, "the line to remember waits for the chapter's last scene");
await go("mean");
assert.equal((await screen()).remember, CHAPTERS["sig-metrics"].remember, "the chapter's last scene shows its line to remember");

// The console can compose a program from any chapters, and Today follows it.
assert.equal((await ctl("start", { w: 5, c: ["sig-logs"] })).status, 400, "a program opens with the welcome");
assert.equal((await ctl("start", { w: 5, c: ["welcome", "nope"] })).status, 400, "unknown chapters are refused");
await ctl("start", { w: 5, c: ["welcome", "sig-logs", "gql-find", "sig-close"] });
await go("today");
assert.deepEqual((await screen()).today.parts.map((x) => x.name), ["Logs", "Find it"], "Today lists the composed program's parts");
await ctl("reset");
assert.equal(room().chapters.join(), "welcome,sig-logs,gql-find,sig-close", "a reset keeps the composed program");
assert.equal((await ctl("start", { w: 5, c: ["welcome", "sig-logs"], title: "<script>" })).status, 400, "a program title is plain words");
await ctl("start", { w: 5, c: ["welcome", "sig-logs", "gql-find", "sig-close"], title: "Logs and GraphQL" });
assert.deepEqual([(await screen()).workshop, (await screen()).promise], ["Logs and GraphQL", "Logs · Find it"], "a composed program shows its own title, and its parts as the promise");
const lib = (await (await fetch(base + "/chapters?t=t")).json()).chapters;
assert.ok(lib.find((c) => c.id === "sig-logs").min === 9 && lib.every((c) => c.q), "the console reads the chapter library with minutes");
assert.equal((await fetch(base + "/chapters")).status, 403, "the chapter library is for the presenter");

await ctl("start", { w: 5 });
await go("mean");
assert.equal((await screen()).scene.title, SCENE.mean.title, "a poll opens on its question");
await ctl("reveal");
assert.equal((await screen()).scene.title, SCENE.mean.takeaway, "on reveal, the answer becomes the headline");

// The presenter and Interlace are described the brand's way (relay/brand.json, synced).
const BRAND = JSON.parse(readFileSync(new URL("./brand.json", import.meta.url), "utf8"));
const techItems = (await import("./scenes.mjs")).AUDIENCES.tech.items.join(" | ");
for (const fact of BRAND.author.facts) assert.ok(techItems.includes(fact), `the intro carries the brand's line: ${fact}`);
assert.ok(!/\b\d+ ESLint plugins\b|750k/i.test(readFileSync(new URL("./scenes.mjs", import.meta.url), "utf8")), "no hand-typed Interlace numbers in scenes.mjs");
// The close: each phone picks one thing for the week, gets a signed follow-up and the session's recap.
store.setAccess({ liveUntil: Infinity, joinUntil: Infinity, locked: false, openedAt: Date.now() }); // a fresh room
await ctl("start", { w: 5 });
const runId = room().runId;
const closer = await phone(), other = await phone();
await closer("/send", {});
await go("mean");
await closer("/answer", { value: SCENE.mean.answer }); await other("/answer", { value: (SCENE.mean.answer + 1) % SCENE.mean.options.length });
await go("felt");
const tm = (await screen()).timer;
assert.ok(tm && tm.total === SCENE.felt.min * 60_000 && tm.left > tm.total - 5_000, "a hands-on step starts its countdown when the room arrives");
assert.equal((await closer.view()).timer.total, tm.total, "phones see the same countdown");
await go("today");
assert.equal((await screen()).timer, undefined, "talk-only steps have no countdown");
await go("why");
assert.equal((await screen()).why.title, WORKSHOPS[5].why.title, "why it matters names the problem the room just felt");
await go("cases");
assert.deepEqual((await closer.view()).options, WORKSHOPS[5].studies.map((c) => CASES[c].who), "the room votes among the workshop's case studies");
await closer("/answer", { value: 2 }); await other("/answer", { value: 2 });
assert.equal((await screen()).study, undefined, "the story waits for the vote");
await ctl("reveal");
assert.equal((await screen()).study.who, CASES[WORKSHOPS[5].studies[2]].who, "Reveal tells the case the room picked");
await go("outro");
assert.equal((await closer.view()).next.status, "Next", "the outro teases the next workshop");
await go("sig-monday");
assert.equal((await closer.view()).followup, undefined, "no follow-up before a pick");
assert.equal((await closer("/answer", { value: 1 })).status, 200);
assert.equal((await other("/answer", { value: 9 })).status, 400, "a pick is one of the items");
assert.deepEqual((await screen()).results.counts, [0, 1, 0], "the big screen counts the picks");
const v = await closer.view(), fu = new URL(v.followup, "http://x");
assert.ok(v.recap.includes(`r=${runId}`), "the phone gets this session's recap link");
const q = `p=${fu.searchParams.get("p")}&k=${fu.searchParams.get("k")}`;
store.setAccess({ liveUntil: Date.now() - 1 }); // everything below works after the room has closed
assert.equal((await (await fetch(`${base}/followup?${q}`)).json()).pick, SCENE["sig-monday"].items[1], "the follow-up knows your pick");
assert.equal((await fetch(`${base}/followup?p=${fu.searchParams.get("p")}&k=nope`)).status, 403, "a follow-up link is signed");
assert.match(await (await fetch(`${base}/followup.ics?${q}`)).text(), /BEGIN:VEVENT[\s\S]*DTSTART;VALUE=DATE:\d{8}/, "the reminder is a calendar event");
const did = (x) => fetch(`${base}/followup?${q}`, { method: "POST", body: JSON.stringify({ did: x }) });
assert.equal((await did(true)).status, 200);
assert.equal((await did(false)).status, 409, "one answer per follow-up");
const imp = await (await fetch(base + "/impact?t=t")).json();
assert.deepEqual([imp.picked, imp.followedUp, imp.did], [1, 1, 1], "the console sees picks and follow-through");
assert.ok(imp.questions.some((x) => x.id === "mean" && x.total >= 2), "the console sees how rooms answer each question");
await ctl("start", { w: 1 }); // the next session must not leak into this recap
const rc = await (await fetch(`${base}/recap?r=${runId}&${q}`)).json();
assert.equal(rc.title, "Signals");
assert.deepEqual(rc.learning.find((x) => x.id === "mean"), { id: "mean", q: SCENE.mean.title, a: SCENE.mean.takeaway, right: 1, total: 2 }, "the recap shows how the room learned, question by question");
assert.deepEqual(rc.mine.score, { right: 1, answered: 1 }, "and your own score");
assert.deepEqual(rc.monday.counts, [0, 1, 0], "the recap keeps the room's picks");
assert.equal(rc.room.people, 2, "the recap is this session's room only");
assert.deepEqual([rc.mine.sent, rc.mine.pick], [1, SCENE["sig-monday"].items[1]], "with your link, the recap shows your own numbers");
assert.equal((await (await fetch(`${base}/recap?r=${runId}`)).json()).mine, undefined, "without your link, only the room's");
assert.equal((await fetch(`${base}/recap?r=${runId + 1}`)).status, 404, "a recap starts at a session's start");

// Push: a phone's /stream hears "step" the moment the presenter moves (well under a second).
store.setAccess({ liveUntil: Infinity, joinUntil: Infinity, locked: false, openedAt: Date.now() });
await ctl("start", { w: 5 });
const listener = await phone();
const res = await fetch(base + "/stream", { headers: { cookie: listener.cookie } });
assert.equal(res.headers.get("content-type"), "text/event-stream");
const reader = res.body.getReader(), dec = new TextDecoder();
const heard = (async () => { let buf = ""; for (;;) { const { value, done } = await reader.read(); if (done) return null; buf += dec.decode(value); if (buf.includes("event: step")) return Date.now(); } })();
const sentAt = Date.now();
await ctl("next");
const at = await Promise.race([heard, new Promise((r) => setTimeout(() => r(null), 3000))]);
assert.ok(at && at - sentAt < 1000, `the phone hears Next within a second (took ${at ? at - sentAt : "never"} ms)`);
await reader.cancel();
assert.equal((await fetch(base + "/stream")).status, 401, "the stream is for joined phones and the presenter");

// The road: a phone sees its own message travel into the logging and tracing systems.
await go("sig-road");
await listener("/send", {});
const road = (await listener.view()).road;
assert.deepEqual(road.stages.map((x) => x.name), ["Written", "Shipped", "Stored", "Searchable"], "the log road has its four stages");
assert.ok(road.mine?.line?.trace_id && road.counts[0] >= 1, "the phone sees its own log line, and the room's count");
await go("sig-trace-road");
assert.equal((await listener.view()).road.mode, "traces", "the trace road follows the same message's spans");

// The game: named or anonymous, points for right and fast, a leaderboard, voters, eyes up.
store.setAccess({ liveUntil: Infinity, joinUntil: Infinity, locked: false, openedAt: Date.now() });
assert.equal((await ctl("start", { w: 5, names: "loud" })).status, 400, "an unknown name mode is refused");
await ctl("start", { w: 5, names: "named", voters: true });
const fast = await phone(), slow = await phone(), miss = await phone();
assert.equal((await fast.view()).needName, true, "a named session asks for a first name");
assert.equal((await fast("/name", { name: "<b>" })).status, 400, "names are plain words");
assert.equal((await fast("/name", { name: "  Dana " })).status, 200);
await slow("/name", { name: "Noa" });
await go("mean");
await fast("/answer", { value: SCENE.mean.answer });
await slow("/answer", { value: SCENE.mean.answer });
room().phones.get(slow.cookie.split("=")[1]).at.mean += 30_000; // that answer came 30 s in
await miss("/answer", { value: (SCENE.mean.answer + 1) % SCENE.mean.options.length });
await ctl("reveal");
const lb = (await screen()).leaderboard;
assert.deepEqual(lb.map((x) => x.name), ["Dana", "Noa", "Player 3"], "the leaderboard orders by points; unnamed phones are players");
assert.ok(lb[0].points > lb[1].points && lb[1].points >= 500 && lb[2].points === 0, "right and fast beats right and slow; wrong scores 0");
assert.deepEqual((await screen()).who[SCENE.mean.answer], ["Dana", "Noa"], "show voters lists who chose each option");
assert.equal((await fast.view()).who, undefined, "voters never reach phones");
assert.equal((await fast.view()).rank, 1, "each phone knows its rank");
await ctl("mode", { voters: false });
assert.equal((await screen()).who, undefined, "voters can be switched off");
await ctl("start", { w: 5 });
const anon = await phone();
assert.equal((await anon("/name", { name: "Dana" })).status, 409, "an anonymous session never takes names");
await ctl("eyes");
await go("mean");
assert.equal((await anon("/answer", { value: 0 })).status, 423, "eyes up pauses input");
assert.equal((await anon.view()).eyes, true, "phones know to look up");
await ctl("eyes");
assert.equal((await anon("/answer", { value: 0 })).status, 200);
assert.ok([...room().devs].every((d) => /^[0-9a-f]{16}$/.test(d)), "joins carry a device mark, never an IP");
await phone(); // the same device (same address and browser) joins again
assert.ok(room().reconnects >= 1, "a second session from the same device counts as a reconnection");

// The run report: reach, presence, engagement, learning, conversion, reconnection.
const rep = await (await fetch(base + "/run-report?t=t")).json();
assert.ok(rep.reach.joined >= 1 && rep.presence[0].minute === 0, "the report has reach and a presence curve");
assert.ok(rep.polls.some((x) => x.id === "mean" && x.answered >= 1 && x.rate > 0), "the report has answered/present per poll");
assert.ok(rep.reconnectionRate > 0 && rep.churnRate >= 0, "the report has reconnection and churn rates");
assert.equal((await fetch(base + "/run-report")).status, 403, "the run report is for the presenter");
await ctl("start", { w: 5 });
const learner = await phone();
await go("mean"); await learner("/answer", { value: (SCENE.mean.answer + 1) % SCENE.mean.options.length });
await go("mean-again"); await learner("/answer", { value: SCENE.mean.answer });
assert.deepEqual((await (await fetch(base + "/run-report?t=t")).json()).learning, { before: 0, after: 1 }, "the learning check measures before and after");

// The home page outlives every room: it must list the same links and the same series.
const hub = readFileSync(new URL("./public/hub.html", import.meta.url), "utf8");
for (const l of PRESENTER.links) assert.ok(hub.includes(`href="${l.href}"`), `hub.html links ${l.label}`);
for (const x of SERIES) assert.ok(hub.includes(x.track.replace(/^\d+ · /, "")), `hub.html lists ${x.track}`);

server.close(); server.closeAllConnections?.();
console.log("relay self-check: ok");
