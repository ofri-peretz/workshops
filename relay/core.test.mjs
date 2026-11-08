// The rules specs/relay.qnt models, as unit tests: who gets in, which answers count, how scores and
// the leaderboard move. oxmutate grades these tests against the same lines (vitest.config.mjs).
import { describe, expect, it } from "vitest";
import { memoryStore } from "./store.mjs";
import { fresh, reduce, phoneView, screenView, leaderboardOf, pointsOf, quizItem, quizOf, validAnswer, validControl } from "./core.mjs";
import { SCENE } from "./scenes.mjs";

let n = 0;
const ev = (kind, data = {}, phone = null) => ({ id: ++n, kind, phone, data: { t: Date.now(), ...data } });
const roomAt = (sceneId, phones = ["a", "b", "c"]) => {
  let room = reduce(fresh(), ev("control", { op: "start", w: 5, names: "named" }));
  for (const p of phones) { room = reduce(room, ev("join", {}, p)); room = reduce(room, ev("answer", { scene: "_name", value: p.toUpperCase() }, p)); }
  return reduce(room, ev("control", { op: "goto", i: room.path.indexOf(sceneId) }));
};
const answer = (room, p, scene, value) => reduce(room, ev("answer", { scene, value }, p));
const ctl = (room, op) => reduce(room, ev("control", { op }));

describe("joining (relay_try_join)", () => {
  const store = () => { const s = memoryStore(); s.setAccess({ codeHmac: "RIGHT", openedAt: Date.now() }); return s; };
  it("lets the right code in after five typos from the same network", async () => {
    const s = store();
    for (let i = 0; i < 5; i++) expect(await s.tryJoin("typo", "venue")).toBe("wrong");
    expect(await s.tryJoin("typo", "venue")).toBe("rate_limited");
    expect(await s.tryJoin("RIGHT", "venue")).toBe("ok");
  });
  it("refuses everyone when closed, and nobody new once the code expired", async () => {
    const s = store();
    s.setAccess({ liveUntil: Date.now() - 1 });
    expect(await s.tryJoin("RIGHT", "x")).toBe("closed");
    s.setAccess({ liveUntil: Infinity, joinUntil: Date.now() - 1 });
    expect(await s.tryJoin("RIGHT", "x")).toBe("expired");
  });
  it("locks the room after 30 wrong codes from anywhere, and then even the right code waits", async () => {
    const s = store();
    for (let i = 0; i < 29; i++) expect(await s.tryJoin("typo", `ip${i}`)).toBe("wrong");
    expect(await s.tryJoin("typo", "ip29")).toBe("locked");
    expect(await s.tryJoin("RIGHT", "fresh")).toBe("locked");
  });
});

describe("controls", () => {
  it("accepts sign-out and close, and nothing unknown", () => {
    expect(validControl({ op: "signout" })).toBe(true);
    expect(validControl({ op: "close" })).toBe(true);
    expect(validControl({ op: "explode" })).toBe(false);
  });
  it("sign-out empties the room and keeps the step", () => {
    const room = roomAt("felt"), pos = room.pos;
    const out = ctl(room, "signout");
    expect(out.phones.size).toBe(0);
    expect(out.pos).toBe(pos);
    expect(out.signedOut).toBeTruthy();
  });
});

describe("term checks", () => {
  it("asks four options with exactly one right, the same every time", () => {
    const q = quizItem("p95");
    expect(q.options).toHaveLength(4);
    expect(new Set(q.options).size).toBe(4);
    expect(q.answer).toBeGreaterThanOrEqual(0);
    expect(q.answer).toBeLessThan(4);
    expect(quizItem("p95")).toEqual(q);
  });
  it("validates a term answer as a term index and one of four options", () => {
    const s = SCENE["tc-metrics"];
    expect(validAnswer(s, { k: 0, a: 3 })).toBe(true);
    expect(validAnswer(s, { k: 0, a: 4 })).toBe(false);
    expect(validAnswer(s, { k: -1, a: 0 })).toBe(false);
    expect(validAnswer(s, 2)).toBe(false);
  });
  it("keeps the first try per term and scores only after the reveal", () => {
    let room = roomAt("tc-metrics");
    const items = quizOf(room, SCENE["tc-metrics"]);
    room = answer(room, "a", "tc-metrics", { k: 0, a: items[0].answer });
    room = answer(room, "a", "tc-metrics", { k: 0, a: (items[0].answer + 1) % 4 });
    expect(room.phones.get("a").answers["tc-metrics"][0]).toBe(items[0].answer);
    expect(pointsOf(room, room.phones.get("a"))).toBe(0);
    room = ctl(room, "reveal");
    expect(pointsOf(room, room.phones.get("a"))).toBe(100);
    expect(phoneView(room, room.phones.get("a")).termScore).toEqual({ n: 5, right: 1 });
  });
  it("hides the right answers until the reveal", () => {
    let room = roomAt("tc-metrics");
    expect(phoneView(room, room.phones.get("a")).quiz.every((q) => q.answer === undefined)).toBe(true);
    room = ctl(room, "reveal");
    expect(phoneView(room, room.phones.get("a")).quiz.every((q) => Number.isInteger(q.answer))).toBe(true);
  });
  it("compares each phone's start and end in the final check", () => {
    let room = roomAt("tc-metrics");
    const first = quizOf(room, SCENE["tc-metrics"]);
    room = answer(room, "a", "tc-metrics", { k: 0, a: first[0].answer });
    room = reduce(room, ev("control", { op: "goto", i: room.path.indexOf("tc-final") }));
    const fin = quizOf(room, SCENE["tc-final"]);
    fin.forEach((q, k) => { room = answer(room, "a", "tc-final", { k, a: q.answer }); });
    const sc = phoneView(room, room.phones.get("a")).termScore;
    expect(sc.before).toBe(1);
    expect(sc.after).toBe(fin.length);
  });
});

describe("the screen never exposes anyone", () => {
  it("names nobody under the answers", () => {
    let room = roomAt("mean");
    room = answer(room, "a", "mean", SCENE.mean.answer);
    room = answer(room, "b", "mean", (SCENE.mean.answer + 1) % 4);
    room = ctl(room, "reveal");
    expect(screenView(room, Date.now()).who).toBeUndefined();
  });
  it("shows how far each player moved because of this question", () => {
    let room = roomAt("mean");
    room = answer(room, "a", "mean", SCENE.mean.answer);
    room = ctl(room, "reveal");
    room = reduce(room, ev("control", { op: "goto", i: room.path.indexOf("p95-guess") }));
    room = answer(room, "b", "p95-guess", SCENE["p95-guess"].answer);
    room = ctl(room, "reveal");
    const board = leaderboardOf(room, 5, "p95-guess"), by = Object.fromEntries(board.map((x) => [x.name, x]));
    expect(by.B.move).toBeGreaterThanOrEqual(1); // scored: climbs past C
    expect(by.C.move).toBeLessThan(0); // didn't answer: B passed them
    expect(board.every((x) => Number.isInteger(x.move))).toBe(true);
  });
  it("sends the scene library only when asked", () => {
    const room = roomAt("mean");
    expect(screenView(room, Date.now()).library).toBeUndefined();
    expect(screenView(room, Date.now(), true).library.length).toBeGreaterThan(10);
  });
});

describe("edges the first oxmutate run found untested", () => {
  it("records when the room was closed", () => {
    const room = ctl(roomAt("felt"), "close");
    expect(typeof room.closedAt).toBe("number");
  });
  it("ignores an answer for a scene that doesn't exist", () => {
    const room = answer(roomAt("felt"), "a", "no-such-scene", 1);
    expect(room.phones.get("a").answers["no-such-scene"]).toBe(1);
  });
  it("tells a term answer from a poll answer, at the edges", () => {
    const tc = SCENE["tc-metrics"], poll = SCENE.mean;
    expect(validAnswer(tc, { k: 59, a: 0 })).toBe(true);
    expect(validAnswer(tc, { k: 60, a: 0 })).toBe(false);
    expect(validAnswer(tc, { k: 1.5, a: 0 })).toBe(false);
    expect(validAnswer(tc, { k: 0, a: -1 })).toBe(false);
    expect(validAnswer(tc, null)).toBe(false);
    expect(validAnswer(poll, { k: 0, a: 0 })).toBe(false);
    expect(validAnswer(poll, 1)).toBe(true);
  });
  it("builds options from the same check's terms, the right one included", async () => {
    const { GLOSSARY } = await import("./concepts.mjs");
    const pool = SCENE["tc-logs"].quiz;
    for (const term of pool) {
      const q = quizItem(term);
      expect(q.options[q.answer]).toBe(GLOSSARY[term].def);
      const defs = pool.map((t) => GLOSSARY[t].def);
      expect(q.options.every((o) => defs.includes(o))).toBe(true);
    }
  });
  it("asks every earlier check's terms again at the end, once each", () => {
    const room = roomAt("tc-final");
    const terms = quizOf(room, SCENE["tc-final"]).map((q) => q.term);
    const checks = room.path.map((id) => SCENE[id]).filter((s) => s?.type === "termcheck" && !s.final);
    expect(terms).toEqual([...new Set(checks.flatMap((c) => c.quiz))]);
  });
  it("counts the room's right answers per term, and who finished", () => {
    let room = roomAt("tc-metrics");
    const items = quizOf(room, SCENE["tc-metrics"]);
    items.forEach((q, k) => { room = answer(room, "a", "tc-metrics", { k, a: q.answer }); });
    room = answer(room, "b", "tc-metrics", { k: 0, a: (items[0].answer + 1) % 4 });
    const r = screenView(room, Date.now()).results;
    expect(r.items[0]).toMatchObject({ term: items[0].term, right: 1, total: 2 });
    expect(r.items[1]).toMatchObject({ right: 1, total: 1 });
    expect(r.done).toBe(1);
    expect(r.people).toBe(3);
    expect(r.before).toBeUndefined();
  });
  it("shows the room's start and end at the final check, and who improved", () => {
    let room = roomAt("tc-metrics");
    const first = quizOf(room, SCENE["tc-metrics"]);
    room = answer(room, "a", "tc-metrics", { k: 0, a: (first[0].answer + 1) % 4 });
    room = answer(room, "b", "tc-metrics", { k: 0, a: first[0].answer });
    room = reduce(room, ev("control", { op: "goto", i: room.path.indexOf("tc-final") }));
    const fin = quizOf(room, SCENE["tc-final"]);
    fin.forEach((q, k) => { room = answer(room, "a", "tc-final", { k, a: q.answer }); });
    room = answer(room, "b", "tc-final", { k: 0, a: (fin[0].answer + 1) % 4 });
    const r = screenView(room, Date.now()).results;
    expect(r.n).toBe(fin.length);
    expect(r.before).toBeCloseTo(1 / 2 / fin.length);
    expect(r.after).toBeCloseTo(fin.length / 2 / fin.length);
    expect(r.improved).toEqual([{ name: "A", before: 0, after: fin.length }]);
  });
  it("scores 500 for right plus up to 500 for speed, and nothing for wrong", () => {
    let room = roomAt("mean");
    const t0 = room.arrived.mean, half = SCENE.mean.min * 60_000 / 2;
    room = reduce(room, { id: ++n, kind: "answer", phone: "a", data: { t: t0, scene: "mean", value: SCENE.mean.answer } });
    room = reduce(room, { id: ++n, kind: "answer", phone: "b", data: { t: t0 + half, scene: "mean", value: SCENE.mean.answer } });
    room = reduce(room, { id: ++n, kind: "answer", phone: "c", data: { t: t0, scene: "mean", value: (SCENE.mean.answer + 1) % 4 } });
    expect(pointsOf(room, room.phones.get("a"))).toBe(1000);
    expect(pointsOf(room, room.phones.get("b"))).toBe(750);
    expect(pointsOf(room, room.phones.get("c"))).toBe(0);
    const board = leaderboardOf(room, 2);
    expect(board.map((x) => x.name)).toEqual(["A", "B"]);
    expect(leaderboardOf(room).length).toBe(3);
  });
  it("names anonymous players by number, never by their typed name", () => {
    let room = reduce(fresh(), ev("control", { op: "start", w: 5 }));
    room = reduce(room, ev("join", {}, "z"));
    room = answer(room, "z", "_name", "Zed");
    expect(leaderboardOf(room)[0].name).toBe("Player 1");
  });
  it("adds term-check points per right answer, only for revealed checks", () => {
    let room = roomAt("tc-metrics");
    const items = quizOf(room, SCENE["tc-metrics"]);
    items.slice(0, 3).forEach((q, k) => { room = answer(room, "a", "tc-metrics", { k, a: q.answer }); });
    room = ctl(room, "reveal");
    expect(pointsOf(room, room.phones.get("a"))).toBe(300);
    expect(pointsOf(room, room.phones.get("a"), "tc-metrics")).toBe(0);
  });
});

describe("edges the second oxmutate run found", () => {
  it("still takes nines answers (the term-check rule is only for term checks)", () => {
    expect(validAnswer(SCENE.nines, 99.9)).toBe(true);
  });
  it("shows the top five, highest first, whatever order people joined in", () => {
    let room = roomAt("mean", ["a", "b", "c", "d", "e", "f"]);
    const t0 = room.arrived.mean, slot = SCENE.mean.min * 60_000 / 10;
    ["f", "e", "d", "c", "b"].forEach((p, i) => { room = reduce(room, { id: ++n, kind: "answer", phone: p, data: { t: t0 + i * slot, scene: "mean", value: SCENE.mean.answer } }); });
    const board = leaderboardOf(room);
    expect(board).toHaveLength(5);
    expect(board.map((x) => x.name)).toEqual(["F", "E", "D", "C", "B"]);
  });
  it("names the three who improved most, most first, and nobody who didn't", () => {
    let room = roomAt("tc-metrics", ["a", "b", "c", "d", "e"]);
    room = reduce(room, ev("control", { op: "goto", i: room.path.indexOf("tc-final") }));
    const fin = quizOf(room, SCENE["tc-final"]);
    const rightN = { a: 1, b: 4, c: 3, d: 2, e: 0 };
    for (const [p, k] of Object.entries(rightN)) fin.forEach((q, i) => { room = answer(room, p, "tc-final", { k: i, a: i < k ? q.answer : (q.answer + 1) % 4 }); });
    expect(screenView(room, Date.now()).results.improved.map((x) => x.name)).toEqual(["B", "C", "D"]);
  });
  it("reports 0, not NaN, when nobody has answered the final check", () => {
    const room = roomAt("tc-final");
    const r = screenView(room, Date.now()).results;
    expect([r.before, r.after, r.improved.length]).toEqual([0, 0, 0]);
  });
});

describe("questions and the pulse", () => {
  it("lists questions by upvotes, never says who asked, and lets the presenter hide one", () => {
    let room = roomAt("felt");
    room = answer(room, "a", "_ask", "Why p95 and not p99?");
    room = answer(room, "b", "_ask", "Is logging slow?");
    const [q1, q2] = room.questions;
    room = answer(room, "c", "_vote", q2.id);
    let view = screenView(room, Date.now()).questions;
    expect(view.map((q) => [q.text, q.votes])).toEqual([["Is logging slow?", 2], ["Why p95 and not p99?", 1]]);
    expect(JSON.stringify(view)).not.toMatch(/"by"|"a"|"b"/);
    room = answer(room, "c", "_vote", q2.id); // a second tap takes the upvote back
    expect(screenView(room, Date.now()).questions.find((q) => q.id === q2.id).votes).toBe(1);
    room = reduce(room, ev("control", { op: "hideq", i: q1.id }));
    expect(phoneView(room, room.phones.get("b")).questions.map((q) => q.id)).toEqual([q2.id]);
    expect(phoneView(room, room.phones.get("b")).questions[0].own).toBe(true);
    expect(validControl({ op: "hideq", i: q1.id })).toBe(true);
    expect(validControl({ op: "hideq", i: 0 })).toBe(false);
  });
  it("counts got-it and lost per step, one per phone, and a second tap clears it", () => {
    let room = roomAt("felt");
    const mark = (p, v) => { room = answer(room, p, "_pulse", { step: "felt", v }); };
    mark("a", "lost"); mark("b", "ok"); mark("c", "lost"); mark("c", "ok"); mark("a", null);
    expect(screenView(room, Date.now()).pulse).toEqual({ lost: 0, ok: 2 });
    expect(phoneView(room, room.phones.get("c")).pulseMine).toBe("ok");
  });
  it("takes a group label on start, and nothing longer than 60 characters", () => {
    expect(validControl({ op: "start", w: 5, label: "JS meetup" })).toBe(true);
    expect(validControl({ op: "start", w: 5, label: "x".repeat(61) })).toBe(false);
  });
});

describe("test sessions", () => {
  it("takes a test flag on start and a tag for a past run", () => {
    expect(validControl({ op: "start", w: 5, test: true })).toBe(true);
    expect(validControl({ op: "start", w: 5, test: "yes" })).toBe(false);
    expect(validControl({ op: "tag", i: 12, test: false })).toBe(true);
    expect(validControl({ op: "tag", i: 0, test: true })).toBe(false);
    expect(validControl({ op: "tag", i: 12 })).toBe(false);
  });
  it("leaves the live room alone when a past run is tagged", () => {
    const room = roomAt("felt"), pos = room.pos, people = room.phones.size;
    const out = reduce(room, ev("control", { op: "tag", i: 3, test: true }));
    expect([out.pos, out.phones.size]).toEqual([pos, people]);
  });
});

describe("your own words, and names in the log", () => {
  it("keeps the latest wording per term, shows three, and lets the presenter hide one", () => {
    let room = roomAt("explain");
    const s = SCENE.explain;
    expect(validAnswer(s, { k: 0, text: "a number over time" })).toBe(true);
    expect(validAnswer(s, { k: 0, text: "x" })).toBe(false);
    expect(validAnswer(s, { k: 3, text: "out of range" })).toBe(false);
    room = answer(room, "a", "explain", { k: 0, text: "first try" });
    room = answer(room, "a", "explain", { k: 0, text: "a count over time" });
    room = answer(room, "b", "explain", { k: 0, text: "a graph number" });
    let r = screenView(room, Date.now()).results.items[0];
    expect(r.n).toBe(2);
    expect(r.samples.map((x) => x.text)).toEqual(["a graph number", "a count over time"]);
    room = reduce(room, ev("control", { op: "hidex", i: r.samples[0].id }));
    r = screenView(room, Date.now()).results.items[0];
    expect(r.samples.map((x) => x.text)).toEqual(["a count over time"]);
    expect(phoneView(room, room.phones.get("a")).explain[0]).toMatchObject({ term: "metric", mine: "a count over time", def: undefined });
  });
  it("logs the client id, and the name the person picked", () => {
    let room = roomAt("felt");
    room = reduce(room, ev("send", { ms: 120, ok: true }, "a"));
    const line = phoneView(room, room.phones.get("a"));
    expect(room.chat.at(-1).name).toBe("A");
  });
});

describe("edges the third oxmutate run found", () => {
  it("counts extensions and lets the presenter restore a hidden question or answer", () => {
    let room = ctl(roomAt("felt"), "extend");
    room = ctl(room, "extend");
    expect(room.extended).toBe(2);
    room = answer(room, "a", "_ask", "Will this be recorded?");
    const id = room.questions[0].id;
    room = reduce(room, ev("control", { op: "hideq", i: id }));
    room = reduce(room, ev("control", { op: "hideq", i: id }));
    expect(screenView(room, Date.now()).questions[0].hidden).toBeUndefined();
    room = reduce(room, ev("control", { op: "goto", i: room.path.indexOf("explain") }));
    room = answer(room, "a", "explain", { k: 0, text: "a number over time" });
    const aid = screenView(room, Date.now()).results.items[0].samples[0].id;
    room = reduce(room, ev("control", { op: "hidex", i: aid }));
    room = reduce(room, ev("control", { op: "hidex", i: aid }));
    expect(screenView(room, Date.now()).results.items[0].samples).toHaveLength(1);
  });
  it("bounds a typed meaning: 2 to 160 characters, not just spaces, for a real term", () => {
    const s = SCENE.explain;
    expect(validAnswer(s, { k: 0, text: "x".repeat(160) })).toBe(true);
    expect(validAnswer(s, { k: 0, text: "x".repeat(161) })).toBe(false);
    expect(validAnswer(s, { k: 0, text: "   " })).toBe(false);
    expect(validAnswer(s, { k: 0, text: 42 })).toBe(false);
    expect(validAnswer(s, { k: 0.5, text: "fine" })).toBe(false);
    expect(validAnswer(s, { k: -1, text: "fine" })).toBe(false);
    expect(validAnswer(s, null)).toBe(false);
    expect(validAnswer(s, { k: 0, a: 1 })).toBe(false);
  });
  it("shows three answers per term, newest first, and counts who finished all three", () => {
    let room = roomAt("explain", ["a", "b", "c", "d"]);
    for (const p of ["a", "b", "c", "d"]) room = answer(room, p, "explain", { k: 0, text: `meaning from ${p}` });
    for (const k of [1, 2]) room = answer(room, "a", "explain", { k, text: "done" });
    const r = screenView(room, Date.now()).results;
    expect(r.items[0].samples.map((x) => x.text)).toEqual(["meaning from d", "meaning from c", "meaning from b"]);
    expect(r.items[0].n).toBe(4);
    expect([r.done, r.people]).toEqual([1, 4]);
  });
  it("marks a phone's own question and its upvote, and breaks vote ties by age", () => {
    let room = roomAt("felt");
    room = answer(room, "a", "_ask", "Older question");
    room = answer(room, "b", "_ask", "Newer question");
    const v = phoneView(room, room.phones.get("a")).questions;
    expect(v.map((q) => q.text)).toEqual(["Older question", "Newer question"]);
    expect(v[0]).toMatchObject({ own: true, mine: true });
    expect(v[1].own).toBeUndefined();
    expect(v[1].mine).toBeUndefined();
  });
  it("reports zero pulse for a step nobody marked", () => {
    expect(screenView(roomAt("felt"), Date.now()).pulse).toEqual({ lost: 0, ok: 0 });
  });
});
