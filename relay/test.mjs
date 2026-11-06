// Self-check: node test.mjs — exits non-zero if the library, the workshops or Relay's behaviour breaks.
// Runs the same handler the Vercel function uses, on the in-memory store.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SCENES, SCENE, POLL_TYPES } from "./scenes.mjs";
import { CONCEPTS, GLOSSARY } from "./concepts.mjs";
import { WORKSHOPS } from "./workshops.mjs";
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

// ---- every workshop, over every combination of fork choices, is 30 minutes ----------------------
for (const [w, W] of Object.entries(WORKSHOPS)) {
  const ids = W.spine.filter((x) => typeof x === "string"), forks = W.spine.filter((x) => typeof x !== "string");
  assert.equal(ids[0], "intro", `workshop ${w} opens with the intro`);
  assert.equal(ids.at(-1), "qa", `workshop ${w} closes with questions`);
  for (const f of forks) for (const d of f.detours) for (const id of [...d.scenes, ...d.after]) assert.ok(SCENE[id], `${w}/${f.fork}: unknown scene ${id}`);
  for (const id of ids) assert.ok(SCENE[id], `workshop ${w}: unknown scene ${id}`);
  const base = ids.reduce((t, id) => t + SCENE[id].min, 0);
  const combos = forks.reduce((acc, f) => acc.flatMap((c) => f.detours.map((d) => [...c, d])), [[]]);
  for (const c of combos) {
    const total = base + c.reduce((t, d) => t + d.scenes.reduce((u, id) => u + SCENE[id].min, 0), 0);
    assert.equal(total, 30, `workshop ${w} via ${c.map((d) => d.title).join(" / ")} is 30 min`);
  }
}

// Replaying the same log gives the same room (what every serverless instance relies on).
const log = [{ id: 1, phone: "a", kind: "join", data: {} }, { id: 2, phone: "b", kind: "join", data: {} }, { id: 3, kind: "control", data: { op: "next" } }];
const r1 = log.reduce(reduce, fresh()), r2 = log.reduce(reduce, fresh());
assert.deepEqual([...r1.phones.values()].map((p) => p.group), [...r2.phones.values()].map((p) => p.group));
assert.equal(r1.pos, 1);

let coin = 0; // deterministic randomness: alternate 0 and 0.99
const { server, store } = createServer({ scale: 0.01, token: "t", random: () => (coin++ % 2 ? 0.99 : 0) });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/api`;
const room = () => store.room();
const here = () => sceneAt(room()).id;
const ctl = (op, extra = {}) => fetch(base + "/control?t=t", { method: "POST", body: JSON.stringify({ op, ...extra }) });
const go = (id) => ctl("goto", { i: room().path.indexOf(id) });
const screen = async () => (await fetch(base + "/screen?t=t")).json();
async function phone() {
  const r = await fetch(base + "/join", { method: "POST" });
  const cookie = r.headers.get("set-cookie").split(";")[0];
  return (path, body, headers = {}) => fetch(base + path, { method: "POST", headers: { cookie, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
}

// Four phones land in four different groups; slower groups wait longer.
let phones = await Promise.all([1, 2, 3, 4].map(phone));
assert.deepEqual(GROUPS.map((g) => [...room().phones.values()].filter((p) => p.group === g).length), [1, 1, 1, 1]);
const times = await Promise.all(phones.map(async (call) => { const t0 = performance.now(); await call("/send", {}); return performance.now() - t0; }));
assert.ok(Math.max(...times) >= 60 && Math.min(...times) < Math.max(...times), "groups differ (7 s → 70 ms at scale 0.01)");

// Who I am depends on the audience; phones only ever get the tech version (the phone page is public).
assert.equal((await ctl("audience", { a: "nobody" })).status, 400);
await ctl("audience", { a: "jewish-community" });
const screenIntro = await screen();
assert.equal(screenIntro.scene.type, "intro");
assert.ok(screenIntro.speaker.items.some((x) => x.includes("Amichai")) && screenIntro.speaker.items.some((x) => x.includes("8200")));
const phoneIntro = await (await phones[0]("/join")).json();
assert.ok(phoneIntro.items.length && !phoneIntro.items.some((x) => /8200|Amichai/.test(x)), "phones never show military or personal background");
assert.equal(phoneIntro.promise, WORKSHOPS[1].promise);

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
assert.equal((await screen()).total, 30, "the chosen path is still 30 minutes");

// A library jump plays any scene now, costs its minutes, and names the flex scenes to skip.
await ctl("detour", { id: "n1" });
assert.equal(here(), "n1");
const jumped = await screen();
assert.equal(jumped.over, 2);
assert.equal(jumped.total, 32);
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
const g3 = [...room().phones.values()][3].group;
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
await go("qa");
await ctl("next");
assert.equal(here(), "qa", "Next stops at the end of the workshop");
assert.equal((await ctl("start", { w: 5 })).status, 400);
await ctl("start", { w: 2 });
assert.equal(here(), "intro");
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
assert.equal((await screen()).total, 30);

server.close(); server.closeAllConnections?.();
console.log("relay self-check: ok");
