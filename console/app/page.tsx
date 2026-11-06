import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { env } from "@/lib/env";
import { readRoom } from "@/lib/room";
import { accessToken } from "@/lib/session";
import { closeAction, goLiveAction, newCodeAction, signOutAction } from "./actions";
import { Countdown } from "./countdown";
import { ConfirmClose } from "./confirm-close";
import { Mark } from "./mark";

export const dynamic = "force-dynamic";

const WORKSHOPS = [
  { id: "5", name: "Signals: metrics, logs and traces, live (60 min)" },
  { id: "1", name: "Relay is slow: feel it, measure it" },
  { id: "2", name: "Relay breaks: find it, prove it" },
  { id: "3", name: "GraphQL measured" },
  { id: "4", name: "Follow one request: traces and spans" },
];

/** The presenter's control room: open the workshop, share the code, run the big screen, close it. */
export default async function Console() {
  const jwt = await accessToken();
  if (!jwt) redirect("/signin");
  const room = await readRoom(jwt);
  const phone = env.phoneUrl();
  const joinLink = room.code ? `${phone}?c=${room.code}` : null;
  const qr = joinLink ? await QRCode.toDataURL(joinLink, { margin: 1, width: 320 }) : null;
  const screenHref = `/screen?join=${encodeURIComponent(phone)}${room.code ? `&c=${room.code}` : ""}`;
  const tone = room.status === "live" ? "default" : room.status === "locked" ? "destructive" : "secondary";

  return (
    <main className="mx-auto grid max-w-content gap-6 px-4 py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Mark className="size-8" />
          <h1 className="text-2xl font-semibold">Workshop console</h1>
          <Badge data-testid="room-status" variant={tone}>{room.status === "live" ? "Live" : room.status === "locked" ? "Joining locked" : "Closed"}</Badge>
        </div>
        <form action={signOutAction}><Button data-testid="sign-out" variant="ghost" size="sm" type="submit">Sign out</Button></form>
      </header>

      {room.status === "closed" ? (
        <Card data-testid="go-live-card">
          <CardHeader>
            <CardTitle>Open the room</CardTitle>
            <CardDescription>Empties the room into the workshop you pick, opens it for 2 hours, and makes a join code that works for 60 minutes.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={goLiveAction} className="flex flex-wrap items-end gap-3">
              <label className="grid gap-1 text-sm">
                <span className="text-muted-foreground">Workshop</span>
                <select id="workshop" name="workshop" className="h-9 rounded-md border border-border bg-background px-3">
                  {WORKSHOPS.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </label>
              <Button data-testid="go-live" type="submit">Go live</Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card data-testid="live-card">
          <CardHeader>
            <CardTitle>{room.status === "locked" ? "Too many wrong codes: joining is paused" : "The room is open"}</CardTitle>
            <CardDescription>
              Room closes <Countdown until={room.liveUntil} /> · code stops admitting new phones <Countdown until={room.joinUntil} />
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt={`QR code that opens ${joinLink}`} width={200} height={200} className="rounded-md bg-white p-2" />
            ) : null}
            <div className="grid gap-3">
              {room.code ? (
                <>
                  <span className="text-sm text-muted-foreground">Join code</span>
                  <span data-testid="join-code" className="font-mono text-5xl font-semibold tracking-[0.2em] tabular-nums">{room.code}</span>
                  <span className="break-all text-sm text-muted-foreground">{phone}</span>
                </>
              ) : (
                <p>No code is active on this console. Make a new one; phones already in stay in.</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button data-testid="open-screen" render={<a href={screenHref} target="_blank" rel="noreferrer" />}>Open the big screen</Button>
                <form action={newCodeAction}><Button data-testid="new-code" variant="outline" type="submit">New code</Button></form>
                <ConfirmClose action={closeAction} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card data-testid="prepare-card">
        <CardHeader>
          <CardTitle>Prepare</CardTitle>
          <CardDescription>Test yourself on every term in the series before you teach it.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button data-testid="open-rehearsal" variant="outline" render={<a href="/rehearsal" target="_blank" rel="noreferrer" />}>Open the rehearsal</Button>
        </CardContent>
      </Card>
    </main>
  );
}
