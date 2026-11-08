import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { RunReport } from "@/lib/room";

const pct = (x: number | null | undefined) => (x == null ? "—" : `${Math.round(100 * x)}%`);

/** The latest run, read top to bottom: who came, who stayed, who answered, who learned, who clicked. */
export function RunReportCard({ report: r }: { report: RunReport }) {
  const weakest = Object.entries(r.concepts).filter(([, c]) => c.total).sort(([, a], [, b]) => a.right / a.total - b.right / b.total).slice(0, 3);
  return (
    <Card data-testid="run-report">
      <CardHeader>
        <CardTitle>Session report: {r.title}</CardTitle>
        <CardDescription>Scanned {r.reach.scanned} · joined {r.reach.joined} · churn {pct(r.churnRate)} · reconnected {pct(r.reconnectionRate)}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <section className="grid gap-1">
          <span className="text-sm text-muted-foreground">Present, by minute</span>
          {r.presence.map((x) => <span key={x.minute} className="tabular-nums">{x.minute}′ · {x.present}</span>)}
        </section>
        <section className="grid gap-1">
          <span className="text-sm text-muted-foreground">Answered, of those present</span>
          {r.polls.map((x) => <span key={x.id} className="flex justify-between gap-3"><span className="truncate">{x.q}</span><b className="tabular-nums">{pct(x.rate)}</b></span>)}
        </section>
        <section className="grid gap-1">
          <span className="text-sm text-muted-foreground">Learning (the average question, before → after)</span>
          <span className="tabular-nums">{r.learning ? `${pct(r.learning.before)} → ${pct(r.learning.after)}` : "Not asked twice yet"}</span>
          <span className="text-sm text-muted-foreground">Weakest concepts</span>
          {weakest.map(([k, c]) => <span key={k} className="tabular-nums">{k} · {pct(c.right / c.total)}</span>)}
        </section>
        <section className="grid gap-1">
          <span className="text-sm text-muted-foreground">Clicks</span>
          {Object.entries(r.ctas).map(([k, n]) => <span key={k} className="tabular-nums">{k} · {n}</span>)}
          {r.terms ? <><span className="text-sm text-muted-foreground">Terms, start → end</span><span className="tabular-nums">{pct(r.terms.before)} → {pct(r.terms.after)} of {r.terms.n}</span></> : null}
        </section>
        {r.participants?.length ? (
          <section className="grid gap-1 sm:col-span-2" data-testid="participants">
            <span className="text-sm text-muted-foreground">Participants (only you see names)</span>
            <div className="overflow-x-auto">
              <table className="w-full text-sm tabular-nums">
                <thead><tr className="text-left text-muted-foreground"><th>Name</th><th>Points</th><th>Right</th><th>Terms</th><th>Msgs</th><th>Practice</th><th>Recap</th></tr></thead>
                <tbody>{r.participants.map((p, i) => <tr key={i}><td>{p.name}</td><td>{p.points}</td><td>{p.right}/{p.answered}</td><td>{p.terms ? `${p.terms.before} → ${p.terms.after}` : "—"}</td><td>{p.sends}</td><td>{p.practice}</td><td>{p.recapOpened ? "✓" : ""}</td></tr>)}</tbody>
              </table>
            </div>
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}
