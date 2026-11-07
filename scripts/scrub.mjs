// Fails if a tracked file holds a secret, a private name, or Hebrew. Run by `npm test` and the pre-commit hook.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const RULES = [
  [/\b(gil|asher|galileo|mamdas|galaxia|masmer|snappy)\b/i, "private name"],
  [/[֐-׿]/, "Hebrew (workshops are English only)"],
  [/sb_secret_[A-Za-z0-9_-]{10,}|service_role/, "Supabase service key"],
  [/eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}/, "JWT"],
  [/\bphx_[A-Za-z0-9]{20,}|\bsk_(live|test)_[A-Za-z0-9]{10,}|\bre_[A-Za-z0-9]{20,}/, "API key"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "private key"],
  [/[A-Za-z0-9._%+-]+@gmail\.com/i, "personal email"],
];
const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" }).split("\n").filter(Boolean);
const self = "scripts/scrub.mjs";
// The presenter's public job title (on LinkedIn and interlace.tools/brand.json) may name the employer,
// only in the generated brand file and only as that title. Everything else about work stays out.
const PUBLIC_TITLE = { "relay/brand.json": /Engineering Manager at Snappy\b/ };
const hits = [];
for (const f of files) {
  if (f === self) continue;
  if (/(^|\/)\.env(\.|$)/.test(f) && !f.endsWith(".env.example")) { hits.push(`${f}: env file must not be committed`); continue; }
  if (/\.(jpe?g|png|gif|webp|ico|pdf|woff2?)$/i.test(f)) continue; // binary: no text to leak, and its bytes read as noise
  let text;
  try { text = readFileSync(f, "utf8"); } catch { continue; }
  text.split("\n").forEach((line, i) => {
    const titled = PUBLIC_TITLE[f]?.test(line);
    for (const [re, why] of RULES) if (re.test(titled ? line.replace(PUBLIC_TITLE[f], "") : line)) hits.push(`${f}:${i + 1}: ${why}`);
  });
}
if (hits.length) { console.error(hits.join("\n")); process.exit(1); }
console.log(`scrub: ${files.length} files clean`);
