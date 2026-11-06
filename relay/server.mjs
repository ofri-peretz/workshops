// Run Relay locally: node server.mjs   (PORT, PRESENTER_TOKEN; SUPABASE_URL + SUPABASE_KEY to use
// the hosted database instead of memory). Same routes as vercel.json.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createHandler } from "./handler.mjs";
import { memoryStore, supabaseStore } from "./store.mjs";

const PAGES = { "/": "phone.html", "/status": "status.html", "/screen": "screen.html" };

export function createServer({ store = memoryStore(), token = randomBytes(6).toString("hex"), scale = 1, random } = {}) {
  const handle = createHandler({ store, token, scale, random });
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (req.method === "GET" && PAGES[url.pathname]) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      return res.end(await readFile(new URL(`./public/${PAGES[url.pathname]}`, import.meta.url)));
    }
    if (!url.pathname.startsWith("/api/")) { res.writeHead(404); return res.end(); }
    const body = req.method === "GET" ? undefined : Readable.toWeb(req);
    const response = await handle(new Request(url, { method: req.method, headers: req.headers, body, duplex: "half" }));
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  });
  return { server, token, store };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = +process.env.PORT || 8080;
  const store = process.env.SUPABASE_URL ? supabaseStore({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_KEY }) : memoryStore();
  const { server, token } = createServer({ store, token: process.env.PRESENTER_TOKEN || undefined });
  server.listen(port, process.env.HOST || "127.0.0.1", () => {
    console.log(`Phones:     http://localhost:${port}/`);
    console.log(`Projector:  http://localhost:${port}/screen?t=${token}   (keep this link to yourself)`);
    console.log(`Status:     http://localhost:${port}/status`);
  });
}
