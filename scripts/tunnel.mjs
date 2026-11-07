// Practice with real phones: a local Relay behind a Cloudflare quick tunnel (a public https URL
// any phone can open). Run: npm run tunnel. Ctrl+C stops both. The room uses a fresh presenter
// token and join code each time; keep the screen link to yourself.
import { spawn } from "node:child_process";
import { randomBytes, randomInt } from "node:crypto";

const port = process.env.PORT || "8099";
const token = randomBytes(6).toString("hex"), code = String(randomInt(1e6)).padStart(6, "0");
const relay = spawn("node", ["relay/server.mjs"], { env: { ...process.env, PORT: port, PRESENTER_TOKEN: token, JOIN_CODE: code }, stdio: "ignore" });
const tunnel = spawn("cloudflared", ["tunnel", "--no-autoupdate", "--url", `http://localhost:${port}`]);
const stop = () => { relay.kill(); tunnel.kill(); process.exit(0); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
tunnel.on("error", () => { console.error("cloudflared isn't installed: brew install cloudflared"); stop(); });

let url;
tunnel.stderr.on("data", async (chunk) => {
  url ??= String(chunk).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)?.[0];
  if (!url || tunnel.started) return;
  tunnel.started = true;
  for (let i = 0; i < 30; i++) { // the tunnel's DNS takes a few seconds to answer
    try { if ((await fetch(`${url}/status`)).ok) break; } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  await fetch(`http://localhost:${port}/api/control?t=${token}`, { method: "POST", body: JSON.stringify({ op: "start", w: 5 }) });
  const screen = `${url}/screen?t=${token}&c=${code}`;
  console.log(`\nPhones:      ${url}/?c=${code}`);
  console.log(`Big screen:  ${screen}   (keep this one to yourself)`);
  console.log(`\nCtrl+C to stop.`);
  spawn("open", [screen], { stdio: "ignore" }).on("error", () => {});
});
