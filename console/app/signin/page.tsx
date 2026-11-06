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
          <Steps />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <Badge data-testid="room-live" variant={live ? "default" : "secondary"}>
            <span className={`mr-1.5 inline-block size-2 rounded-full ${live ? "bg-primary-foreground" : "bg-muted-foreground"}`} aria-hidden="true" />
            {live === null ? "Room status unavailable" : live ? "Room is live" : "Room is closed"}
          </Badge>
        </div>
      </section>
      <section className="grid place-items-center px-6 py-12 sm:px-12">
        <SignInCard email={mask(env.ownerEmail())} />
      </section>
    </main>
  );
}

/** How every workshop runs, whichever one you open: three steps, drawn in as the page arrives. */
function Steps() {
  const steps = [
    { n: "1", title: "Go live", detail: "Pick a workshop. The room opens for two hours." },
    { n: "2", title: "Share the code", detail: "The room scans the QR. The code admits phones for 60 minutes." },
    { n: "3", title: "Close", detail: "One press, and every phone is out." },
  ];
  return (
    <ol className="grid gap-3 pt-4 sm:grid-cols-3">
      {steps.map((s, i) => (
        <li key={s.n} className="signal-step grid content-start gap-2 rounded-xl border border-border bg-card p-4" style={{ animationDelay: `${i * 140}ms` }}>
          <span className="font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">Step {s.n}</span>
          <span className="text-base font-semibold">{s.title}</span>
          <span className="text-sm text-muted-foreground">{s.detail}</span>
        </li>
      ))}
    </ol>
  );
}
