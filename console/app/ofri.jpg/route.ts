import { readFile } from "node:fs/promises";

// The big screen served from the console asks for /ofri.jpg; serve Relay's copy (one file, one source).
export async function GET() {
  const img = await readFile(new URL("../../../relay/public/ofri.jpg", import.meta.url));
  return new Response(img, { headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=86400" } });
}
