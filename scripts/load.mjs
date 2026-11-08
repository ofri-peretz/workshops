// Load test: N phones join, hold the push stream open, check in, chat and answer, like a real room.
// node scripts/load.mjs <base url> <join code> [phones=50] [seconds=60]
// Prints p50/p95/max per call and every non-2xx. Uses only the public phone API; never the presenter token.
const [base, code, n = "50", secs = "60"] = process.argv.slice(2);
if (!base || !/^\d{6}$/.test(code || "")) { console.error("usage: node scripts/load.mjs <base url> <6-digit code> [phones] [seconds]"); process.exit(2); }
const PHONES = Number(n), END = Date.now() + Number(secs) * 1000, api = base.replace(/\/$/, "") + "/api";
const lat = {}, bad = {}, streams = { open: 0, steps: 0, errors: 0 };
const note = (k, ms, status) => { (lat[k] ??= []).push(ms); if (status >= 300 && status !== 409 && status !== 429) bad[`${k} ${status}`] = (bad[`${k} ${status}`] || 0) + 1; };
const call = async (k, path, cookie, body) => {
  const t0 = performance.now();
  try {
    const r = await fetch(api + path, { method: body ? "POST" : "GET", headers: { cookie, "content-type": "application/json" }, body: body && JSON.stringify(body) });
    note(k, performance.now() - t0, r.status);
    return r;
  } catch { note(k, performance.now() - t0, 599); return null; }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (ms) => ms * (0.6 + Math.random() * 0.8);

async function phone(i) {
  await sleep(i * 120); // people scan over a few seconds, not in the same millisecond
  const t0 = performance.now();
  const j = await fetch(api + "/join", { method: "POST", body: JSON.stringify({ code }) }).catch(() => null);
  note("join", performance.now() - t0, j?.status ?? 599);
  const cookie = j?.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) return;
  (async () => { // the push stream: reconnect whenever the server closes it, like EventSource
    while (Date.now() < END) {
      const r = await fetch(api + "/stream", { headers: { cookie } }).catch(() => null);
      if (!r?.ok || !r.body) { streams.errors++; await sleep(1000); continue; }
      streams.open++;
      const rd = r.body.getReader(), dec = new TextDecoder();
      try { for (;;) { const { done, value } = await rd.read(); if (done || Date.now() > END) break; streams.steps += (dec.decode(value).match(/event: step/g) || []).length; } } catch { streams.errors++; }
      rd.cancel().catch(() => {});
    }
  })();
  while (Date.now() < END) { // check in, chat, answer whatever is open
    const r = await call("view", "/view", cookie);
    const v = r?.ok ? await r.json().catch(() => null) : null;
    if (v?.type === "chat" || Math.random() < 0.3) await call("send", "/send", cookie, {});
    if (v?.options && v.mine === undefined && !v.shown) await call("answer", "/answer", cookie, { value: Math.floor(Math.random() * v.options.length) });
    if (v?.type === "termcheck" && v.quiz) await call("answer", "/answer", cookie, { value: { k: Math.floor(Math.random() * v.quiz.length), a: Math.floor(Math.random() * 4) } });
    await sleep(jitter(6000));
  }
}

const q = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s.length ? Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))]) : 0; };
console.log(`${PHONES} phones against ${base} for ${secs} s…`);
await Promise.all(Array.from({ length: PHONES }, (_, i) => phone(i)));
await sleep(500);
console.log("call      n      p50 ms  p95 ms  max ms");
for (const [k, xs] of Object.entries(lat)) console.log(k.padEnd(8), String(xs.length).padStart(5), String(q(xs, 0.5)).padStart(8), String(q(xs, 0.95)).padStart(7), String(Math.round(Math.max(...xs))).padStart(7));
console.log("push streams opened", streams.open, "· step events", streams.steps, "· stream errors", streams.errors);
console.log(Object.keys(bad).length ? "errors: " + JSON.stringify(bad) : "errors: none");
process.exit(Object.keys(bad).length ? 1 : 0);
