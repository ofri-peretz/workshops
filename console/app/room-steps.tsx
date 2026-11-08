import { Button } from "@/components/ui/button";

type Props = { status: "closed" | "live" | "locked"; waiting: boolean; code: string | null };

const STEPS = [
  { title: "Go live", detail: "Pick a part below. The doors open with a new code." },
  { title: "Open the big screen", detail: "The code and QR show in its header. Phones scan and wait." },
  { title: "Begin", detail: "Phones leave the waiting room. Next and Prev drive the slides." },
];

/** Where the presenter is in the run, and what each room control needs: always visible, explained when it can't act yet. */
export function RoomSteps({ status, waiting, code }: Props) {
  const at = status === "closed" ? 0 : waiting ? 1 : 2;
  return (
    <section data-testid="room-steps" aria-label="Running a workshop" className="grid gap-4 rounded-xl border p-4">
      <ol className="grid gap-3 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title} aria-current={i === at ? "step" : undefined}
            className={`grid gap-1 rounded-lg border p-3 ${i === at ? "border-primary bg-primary/10" : i < at ? "opacity-70" : "opacity-50"}`}>
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{i < at ? "Done" : i === at ? "Now" : `Step ${i + 1}`}</span>
            <b>{i + 1}. {s.title}</b>
            <span className="text-sm text-muted-foreground">{s.detail}</span>
          </li>
        ))}
      </ol>
      {status === "closed" ? (
        <div className="flex flex-wrap items-center gap-2" data-testid="room-controls-closed">
          <Button variant="outline" disabled>New code</Button>
          <Button variant="outline" disabled>Sign everyone out</Button>
          <Button variant="outline" disabled>Kick everyone out</Button>
          <span className="text-sm text-muted-foreground">No room is open, so nobody is in it. Go live first; these controls appear on the live room card.</span>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {code ? <>Phones join with code <b className="font-mono text-foreground">{code}</b>.</> : <>No join code right now: press <b>New code</b>.</>} New code keeps phones in. Sign everyone out: a new code, everyone re-enters it. Kick everyone out: the room closes; phones show your page and tell people when you Go live again.
        </p>
      )}
    </section>
  );
}
