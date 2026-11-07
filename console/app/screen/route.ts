import { readFile } from "node:fs/promises";
import { redirect } from "next/navigation";
import { readRoom } from "@/lib/room";
import { accessToken } from "@/lib/session";

// Relay's big screen, unchanged, served from the console so its controls go through /api (above).
// The join code lives only in this console's memory; if the room has one and the address doesn't
// carry it, add it, so the scan slide and the header always show the code.
export async function GET(request: Request) {
  const jwt = await accessToken();
  if (!jwt) redirect("/signin");
  const url = new URL(request.url);
  if (!url.searchParams.get("c")) {
    const { code } = await readRoom(jwt);
    if (code) {
      url.searchParams.set("c", code);
      redirect(url.pathname + url.search);
    }
  }
  const html = await readFile(new URL("../../../relay/public/screen.html", import.meta.url), "utf8");
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
