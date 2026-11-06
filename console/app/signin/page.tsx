import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { env } from "@/lib/env";
import { accessToken } from "@/lib/session";
import { Mark } from "../mark";
import { SignInCard } from "./sign-in-card";

export const dynamic = "force-dynamic";

const mask = (email: string) => {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 2)}${"•".repeat(Math.max(3, user.length - 2))}@${domain}`;
};

/** Whether the room is live right now, from the same public function the phones use. Never the code. */
async function roomLive() {
  try {
    const r = await fetch(`${env.supabaseUrl()}/rest/v1/rpc/relay_gate`, {
      method: "POST",
      headers: { apikey: env.anonKey(), authorization: `Bearer ${env.anonKey()}`, "content-type": "application/json" },
      body: "{}",
      cache: "no-store",
    });
    const [g] = await r.json();
    return !!g?.live;
  } catch {
    return null;
  }
}

export default async function SignIn() {
  if (await accessToken()) redirect("/");
  const live = await roomLive();
  return (
    <main className="relative grid min-h-dvh overflow-hidden lg:grid-cols-[1.1fr_1fr]">
      <section className="relative grid content-between gap-12 border-b border-border px-6 py-10 sm:px-12 lg:border-b-0 lg:border-r lg:py-14">
        <div className="flex items-center gap-3">
          <Mark className="size-9" />
          <span className="font-mono text-sm tracking-[0.18em] text-muted-foreground uppercase">Workshops</span>
        </div>
        <div className="grid max-w-prose gap-6">
          <h1 className="text-5xl font-semibold tracking-tight text-balance sm:text-6xl">Run the room.</h1>
          <p className="text-lg text-muted-foreground text-pretty">
            Open the workshop, hand the room its code, drive the big screen, and close it when you're done. Nobody reaches it without you.
          </p>
          <Signals />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <Badge data-testid="room-live" variant={live ? "default" : "secondary"}>
            <span className={`mr-1.5 inline-block size-2 rounded-full ${live ? "animate-pulse bg-primary-foreground" : "bg-muted-foreground"}`} aria-hidden="true" />
            {live === null ? "Room status unavailable" : live ? "Room is live" : "Room is closed"}
          </Badge>
          <span>Signals · monitoring & performance series</span>
        </div>
      </section>
      <section className="grid place-items-center px-6 py-12 sm:px-12">
        <SignInCard email={mask(env.ownerEmail())} />
      </section>
    </main>
  );
}

/** The three signals the series teaches, drawn as a quiet, looping preview (decorative). */
function Signals() {
  const bars = [18, 30, 22, 44, 28, 62, 36, 24, 52, 30, 20, 40];
  return (
    <div aria-hidden="true" className="grid grid-cols-3 gap-4 pt-4">
      <figure className="grid gap-2 rounded-xl border border-border bg-card p-4">
        <figcaption className="font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">Metrics</figcaption>
        <div className="flex h-16 items-end gap-1">
          {bars.map((h, i) => (
            <span key={i} className="signal-bar flex-1 rounded-sm bg-[var(--chart-1)]" style={{ height: `${h}%`, animationDelay: `${i * 120}ms` }} />
          ))}
        </div>
      </figure>
      <figure className="grid gap-2 rounded-xl border border-border bg-card p-4">
        <figcaption className="font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">Logs</figcaption>
        <div className="grid h-16 content-end gap-1.5 overflow-hidden">
          {[72, 54, 88, 40, 66].map((w, i) => (
            <span key={i} className="signal-log h-1.5 rounded-full bg-muted-foreground/40" style={{ width: `${w}%`, animationDelay: `${i * 400}ms` }} />
          ))}
        </div>
      </figure>
      <figure className="grid gap-2 rounded-xl border border-border bg-card p-4">
        <figcaption className="font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">Traces</figcaption>
        <div className="grid h-16 content-center gap-1.5">
          {[[0, 100], [6, 22], [30, 58], [90, 10]].map(([l, w], i) => (
            <span key={i} className="signal-span h-2 rounded-full bg-[var(--chart-2)]" style={{ marginLeft: `${l}%`, width: `${w}%`, animationDelay: `${i * 250}ms` }} />
          ))}
        </div>
      </figure>
    </div>
  );
}
