// Refreshes relay/brand.json from the published Interlace brand, which already has every count
// filled in. Run: npm run sync:brand. The daily brand-sync workflow runs it and commits to main,
// so a brand or number change needs no PR here. Never hand-edit relay/brand.json.
import { writeFileSync } from "node:fs";

const SOURCE = process.env.BRAND_URL ?? "https://interlace.tools/brand.json";
const r = await fetch(SOURCE);
if (!r.ok) throw new Error(`${SOURCE}: HTTP ${r.status}`);
const m = await r.json();
if (!m.author?.facts?.length || /\{[\w.]+\}/.test(JSON.stringify(m))) throw new Error("brand: author lines missing, or a placeholder left unfilled");

const brand = {
  source: SOURCE,
  syncedAt: new Date().toISOString().slice(0, 10),
  name: m.name,
  hub: m.links.hub,
  // What Interlace does, in the brand's words, cut to fit a slide line.
  does: m.headline.replace(/\.$/, "").replace("your coding agents", "coding agents"),
  // Who's presenting: role, tenure, experience, the team, the open-source work.
  author: { lead: m.author.lead, facts: m.author.facts },
};
writeFileSync(new URL("../relay/brand.json", import.meta.url), JSON.stringify(brand, null, 2) + "\n");
console.log(brand);
