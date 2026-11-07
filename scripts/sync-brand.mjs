// Refreshes relay/brand.json from the Interlace brand sources, so the workshops never hand-type a
// number or a line about Interlace. Run: npm run sync:brand. Never hand-edit relay/brand.json.
// - words: interlace repo, apps/landing/src/data/brand-messages.json (private: read from the local
//   checkout at ../interlace-brand, or BRAND_MESSAGES=<path>)
// - counts: the eslint repo's generated numbers manifest (public)
// - downloads: the milestone the profile README carries (public), floored and never decreasing
import { readFileSync, writeFileSync } from "node:fs";

const MESSAGES = process.env.BRAND_MESSAGES ?? new URL("../../interlace-brand/apps/landing/src/data/brand-messages.json", import.meta.url).pathname;
const NUMBERS = "https://raw.githubusercontent.com/ofri-peretz/eslint/main/apps/docs/src/data/interlace-numbers.json";
const README = "https://raw.githubusercontent.com/ofri-peretz/ofri-peretz/main/README.md";

const get = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`); return r.text(); };
const messages = JSON.parse(readFileSync(MESSAGES, "utf8"));
const numbers = JSON.parse(await get(NUMBERS));
const downloads = (await get(README)).match(/(\d+(?:\.\d+)?[KM]\+) npm downloads/)?.[1];
if (!Number.isInteger(numbers.rules?.total) || !Number.isInteger(numbers.plugins?.total) || !downloads) throw new Error("brand: a number is missing");

const brand = {
  source: "interlace brand-messages.json + eslint interlace-numbers.json + profile README (scripts/sync-brand.mjs)",
  syncedAt: new Date().toISOString().slice(0, 10),
  name: messages.name,
  hub: messages.links.hub,
  // What Interlace does, in the brand's words, cut to fit a slide line.
  does: messages.headline.replace(/\.$/, "").replace("your coding agents", "coding agents"),
  rules: numbers.rules.total,
  plugins: numbers.plugins.total,
  downloads,
};
writeFileSync(new URL("../relay/brand.json", import.meta.url), JSON.stringify(brand, null, 2) + "\n");
console.log(brand);
