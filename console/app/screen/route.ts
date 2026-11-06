import { readFile } from "node:fs/promises";
import { redirect } from "next/navigation";
import { accessToken } from "@/lib/session";

// Relay's big screen, unchanged, served from the console so its controls go through /api (above).
export async function GET() {
  if (!(await accessToken())) redirect("/signin");
  const html = await readFile(new URL("../../../relay/public/screen.html", import.meta.url), "utf8");
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
