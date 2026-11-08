// Pins oxmutate to the rules specs/relay.qnt models, found by markers in the code (line numbers drift as code grows).
// npm run mutate runs this first.
import { readFileSync, writeFileSync } from "node:fs";
const lines = (f) => readFileSync(f, "utf8").split("\n");
const at = (f, needle, from = 0) => { const i = lines(f).findIndex((l, k) => k >= from && l.includes(needle)); if (i < 0) throw new Error(`${f}: marker not found: ${needle}`); return i + 1; };
const store = "relay/store.mjs", core = "relay/core.mjs";
const join = at(store, "async tryJoin(hmac, ip) {"), joinEnd = at(store, 'return "wrong";', join);
const ranges = [
  `${store}:${join}-${joinEnd + 1}`,
  `${core}:${at(core, 'SCENE[d.scene]?.type === "explain"')}-${at(core, 'SCENE[d.scene]?.type === "termcheck"')}`,
  `${core}:${at(core, 'if (op === "close")')}-${at(core, 'if (op === "hideq") {')}`,
  `${core}:${at(core, 'if (s.type === "explain") return')}-${at(core, 'if (s.type === "termcheck") return')}`,
  `${core}:${at(core, "const qh = (x) =>")}-${at(core, "const rankOf = ") - 1}`,
];
const cfg = JSON.parse(readFileSync("stryker.config.json", "utf8"));
cfg.mutate = ranges;
writeFileSync("stryker.config.json", JSON.stringify(cfg, null, 2) + "\n");
console.log("oxmutate ranges:", ranges.join(" "));
