import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { env } from "@/lib/env";
import { readChapters, readImpact, readRoom, readRunReport, readStage } from "@/lib/room";
import { RunReportCard } from "./run-report";
import { readGroups } from "@/lib/groups";
import { Compose } from "./compose";
import { accessToken } from "@/lib/session";
import { beginAction, closeAction, goLiveAction, newCodeAction, signOutAction, signOutAllAction } from "./actions";
import { Countdown } from "./countdown";
import { ConfirmClose, ConfirmSignOut } from "./confirm-close";
import { Mark } from "./mark";
import { Refresh } from "./refresh";

export const dynamic = "force-dynamic";

const WORKSHOPS = [
  // Mirrors relay/workshops.mjs SERIES: where each workshop sits in the monitoring series.
  { id: "5", part: "Part 1 · Signals (intro to monitoring)", title: "Signals", minutes: 60, summary: "See what your users feel" },
  { id: "1", part: "Part 2 · API performance", title: "Relay is slow", minutes: 32, summary: "Turn a wait into a target" },
  { id: "3", part: "Part 2 · API performance", title: "GraphQL measured", minutes: 33, summary: "One endpoint hides every slow query" },
  { id: "2", part: "Part 4 · Before users notice", title: "Relay breaks", minutes: 33, summary: "Find the break, prove the fix" },
  { id: "4", part: "Extra", title: "Follow one request", minutes: 32, summary: "Follow one request end to end" },
];

// Mirrors relay/scenes.mjs INTROS and AUDIENCES; the relay refuses anything else.
const INTROS = [
  { id: "first", label: "First time", detail: "Who I am" },
  { id: "returning", label: "They know me", detail: "Welcome back" },
];
const NAMES = [
  { id: "named", label: "Named", detail: "Each phone picks any name for the leaderboard" },
  { id: "anonymous", label: "Anonymous", detail: "Players are numbers" },
];
const AUDIENCES = [
  { id: "tech", label: "Tech", detail: "Career, open source" },
  { id: "israeli-tech", label: "Israeli tech", detail: "+ 8200, big screen only" },
  { id: "jewish-community", label: "Jewish community", detail: "+ Amichai, 8200" },
];

/** The presenter's control room: open the workshop, share the code, run the big screen, close it. */
export default async function Console() {
  const jwt = await accessToken();
  if (!jwt) redirect("/signin");
  const room = await readRoom(jwt);
  const stage = room.status === "closed" ? null : await readStage();
  const waiting = stage?.begun === false;
  const impact = await readImpact();
  const report = await readRunReport();
  const [chapters, groups] = room.status === "closed" ? await Promise.all([readChapters(), readGroups()]) : [[], []];
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
            <h2 id="pick" className="text-lg font-semibold">The monitoring series: open one part</h2>
            <p className="text-sm text-muted-foreground">Going live opens the doors: phones join and wait until you press Begin. The room and its join code stay open 2 hours. Sign everyone out makes a new code.</p>
          </div>
          <form action={goLiveAction} className="grid gap-4">
          <Card data-testid="intro-settings">
            <CardHeader>
              <CardTitle>The intro</CardTitle>
              <CardDescription>Opens and closes with your links.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              <Choice legend="This group" name="intro" options={INTROS} />
              <Choice legend="Who's in the room" name="audience" options={AUDIENCES} />
              <Choice legend="Names" name="names" options={NAMES} />
              <Label className="flex items-start gap-3 font-normal">
                <Checkbox data-testid="voters" name="voters" className="mt-0.5" />
                <span className="grid gap-0.5"><span className="font-medium">Show who voted what</span><span className="text-sm text-muted-foreground">Named sessions only, big screen only</span></span>
              </Label>
            </CardContent>
          </Card>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {WORKSHOPS.map((w) => (
              <li key={w.id} className={w.id === "5" ? "sm:col-span-2" : undefined}>
                <Card data-testid={`workshop-${w.id}`} className="h-full">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <div className="grid gap-1">
                        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{w.part}</span>
                        <CardTitle>{w.title}</CardTitle>
                      </div>
                      <Badge data-testid={`workshop-${w.id}-minutes`} variant="secondary">{w.minutes} min</Badge>
                    </div>
                    <CardDescription>{w.summary}</CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto">
                    <Button data-testid={`go-live-${w.id}`} type="submit" name="workshop" value={w.id} className="w-full" aria-label={`Go live with ${w.title}`}>Go live</Button>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
          <Compose chapters={chapters} groups={groups} />
          </form>
        </section>
      ) : (
        <Card data-testid="live-card">
          <CardHeader>
            <CardTitle>{room.status === "locked" ? "Too many wrong codes: joining is paused" : waiting ? "Doors open: phones are waiting" : "The workshop is running"}</CardTitle>
            <CardDescription>
              {stage?.title ? <span data-testid="running-title" className="block text-base font-medium text-foreground">Running: {stage.title} · to run a different part, Close the room, then pick one and Go live</span> : null}
              Room closes <Countdown until={room.liveUntil} /> · code stops admitting new phones <Countdown until={room.joinUntil} />
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt={`QR code that opens ${joinLink}`} width={200} height={200} className="rounded-md bg-white p-2" />
            ) : null}
            <div className="grid gap-3">
              {waiting ? (
                <div className="flex flex-wrap items-center gap-3">
                  <Refresh every={5000} />
                  <span data-testid="waiting-count" className="text-lg font-semibold tabular-nums">{stage.people} waiting</span>
                  <form action={beginAction}><Button data-testid="begin" type="submit" size="lg">Begin</Button></form>
                </div>
              ) : null}
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
                <ConfirmSignOut action={signOutAllAction} />
                <ConfirmClose action={closeAction} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {report ? <RunReportCard report={report} /> : null}

      {impact ? (
        <Card data-testid="impact-card">
          <CardHeader>
            <CardTitle>Impact</CardTitle>
            <CardDescription>Each phone picks one thing to do this week; a week later its follow-up link asks if they did.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-8">
            <Stat label="Picked one thing" value={impact.picked} testId="impact-picked" />
            <Stat label="Answered the follow-up" value={impact.followedUp} testId="impact-followed" />
            <Stat label="Did it" value={impact.followedUp ? `${Math.round((100 * impact.did) / impact.followedUp)}%` : "—"} testId="impact-did" />
          </CardContent>
          {impact.questions.length ? (
            <CardContent className="grid gap-2">
              <span className="text-sm text-muted-foreground">Hardest questions, across every session (% right)</span>
              <ul data-testid="impact-questions" className="grid gap-1">
                {impact.questions.slice(0, 5).map((x) => (
                  <li key={x.id} className="flex justify-between gap-4"><span>{x.q}</span><b className="tabular-nums">{Math.round((100 * x.right) / x.total)}% of {x.total}</b></li>
                ))}
              </ul>
            </CardContent>
          ) : null}
        </Card>
      ) : null}

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

/** One labelled set of radios; the first option is the default. */
function Choice({ legend, name, options }: { legend: string; name: string; options: { id: string; label: string; detail: string }[] }) {
  return (
    <fieldset className="grid content-start gap-3">
      <legend className="mb-3 text-sm font-medium text-muted-foreground">{legend}</legend>
      <RadioGroup name={name} defaultValue={options[0].id} data-testid={`${name}-choice`} className="content-start gap-3">
        {options.map((o) => (
          <Label key={o.id} className="flex items-start gap-3 font-normal">
            <RadioGroupItem value={o.id} data-testid={`${name}-${o.id}`} className="mt-0.5" />
            <span className="grid gap-0.5">
              <span className="font-medium">{o.label}</span>
              <span className="text-sm text-muted-foreground">{o.detail}</span>
            </span>
          </Label>
        ))}
      </RadioGroup>
    </fieldset>
  );
}

/** One number with its label. */
function Stat({ label, value, testId }: { label: string; value: number | string; testId: string }) {
  return (
    <div className="grid gap-1">
      <span data-testid={testId} className="text-3xl font-semibold tabular-nums">{value}</span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}
