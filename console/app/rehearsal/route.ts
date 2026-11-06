import { readFile } from "node:fs/promises";
import { redirect } from "next/navigation";
import { accessToken } from "@/lib/session";

// The presenter's term drill: every term in the series, the log road, older standards.
// rehearsal.html is a page body; the parser puts its <title> and <style> where they belong.
export async function GET() {
  if (!(await accessToken())) redirect("/signin");
  const body = await readFile(new URL("../../../relay/rehearsal/rehearsal.html", import.meta.url), "utf8");
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">${body}`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
