import { readFileSync, writeFileSync } from "node:fs";
import { CONCEPTS, GLOSSARY } from "../concepts.mjs";
import { EXTRA, OLDER, WORKSHOP_OF } from "./extra.mjs";

const dir = new URL(".", import.meta.url).pathname;
const terms = { ...GLOSSARY, ...EXTRA };
const groupOf = (t) => {
  for (const [w, list] of Object.entries(WORKSHOP_OF))
    if (list.includes(t)) return "w" + w;
  return "w2";
};
const missing = Object.values(WORKSHOP_OF)
  .flat()
  .filter((t) => !terms[t]);
if (missing.length)
  throw new Error("mapped but undefined: " + missing.join(", "));

const humanize = (id) =>
  id.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
const items = [
  ...Object.entries(terms).map(([t, v]) => ({
    id: "t:" + t,
    kind: "term",
    group: groupOf(t),
    title: t,
    def: v.def,
    example: v.example,
  })),
  ...Object.entries(CONCEPTS).map(([id, v]) => ({
    id: "c:" + id,
    kind: "idea",
    group: "ideas",
    title: humanize(id),
    def: v.claim,
  })),
  ...OLDER.map((o) => ({
    id: "o:" + o.name,
    kind: "older",
    group: "older",
    title: o.name,
    ...o,
  })),
];
const series = [
  {
    n: 1,
    title: "Signals",
    what: "Metrics, logs and traces: what each one is, how it works, and how to use all three in an outage.",
  },
  {
    n: 2,
    title: "API performance",
    what: "Latency, percentiles, timeouts and retries, N+1 and DB selectivity, GraphQL per operation, load tests that tell the truth.",
  },
  {
    n: 3,
    title: "Web performance",
    what: "What the browser felt: LCP, INP and CLS at the room's p75, network phases, real users vs the lab.",
  },
  {
    n: 4,
    title: "Before users notice",
    what: "SLOs and the nines, error budgets and burn rate, alerts that page on what users feel, status pages and incident updates.",
  },
];
const html = readFileSync(dir + "template.html", "utf8").replace(
  "__DATA__",
  JSON.stringify({ items, older: OLDER, series }).replace(/</g, "\\u003c"),
);
writeFileSync(dir + "rehearsal.html", html); // Not under public/: Vercel would serve it to anyone. The admin route serves it after sign-in (relay-access).
const count = (g) => items.filter((i) => i.group === g).length;
console.log(
  "items",
  items.length,
  ["w1", "w2", "w3", "w4", "ideas", "older"]
    .map((g) => g + "=" + count(g))
    .join(" "),
);
