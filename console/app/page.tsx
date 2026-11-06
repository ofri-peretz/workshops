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
  { id: "5", title: "Signals", minutes: 60, summary: "Metrics, logs and traces on every phone, then a live outage the room solves." },
  { id: "1", title: "Relay is slow", minutes: 30, summary: "Feel latency on your own phone, measure it, set a target you can defend." },
  { id: "2", title: "Relay breaks", minutes: 30, summary: "Break Relay live, find it with status pages and signals, prove it with a load test." },
  { id: "3", title: "GraphQL measured", minutes: 30, summary: "Per operation and per consumer, N+1 and cost, and load-testing the real mix." },
  { id: "4", title: "Follow one request", minutes: 30, summary: "Your own message as a trace, the gap nobody owns, and which traces to keep." },
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
        <section data-testid="workshops" aria-labelledby="pick" className="grid gap-4">
          <div className="grid gap-1">
            <h2 id="pick" className="text-lg font-semibold">Open a workshop</h2>
            <p className="text-sm text-muted-foreground">Going live empties the room into that workshop, opens it for 2 hours, and makes a join code that works for 60 minutes.</p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {WORKSHOPS.map((w) => (
              <li key={w.id} className={w.id === "5" ? "sm:col-span-2" : undefined}>
                <Card data-testid={`workshop-${w.id}`} className="h-full">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle>{w.title}</CardTitle>
                      <Badge data-testid={`workshop-${w.id}-minutes`} variant="secondary">{w.minutes} min</Badge>
                    </div>
                    <CardDescription>{w.summary}</CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto">
                    <form action={goLiveAction}>
                      <input type="hidden" name="workshop" value={w.id} />
                      <Button data-testid={`go-live-${w.id}`} type="submit" className="w-full" aria-label={`Go live with ${w.title}`}>Go live</Button>
                    </form>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
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
