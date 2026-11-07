# Plan: Signals, one step at a time

Order of work; each line is one commit, tests green before the next.

1. ✅ `type: "step"` renderer on screen and phone: boxes that build up, one token that moves once,
   live examples (your request, your log line, levels, cost), sync/async, line-up, span waterfall.
2. ✅ Steps for request, signals, metric, percentile, log, anatomy, severity, stdout, shipper, async,
   cost, habits, journey, span, code; standards and OpenTelemetry.
3. ☐ Review fixes, correctness: six groups in every text; real span names; `finally`; UIs vs stores;
   p99 on the spread or not promised; histogram from the room's real buckets.
4. ☐ Metrics order: `step-metric` (live counter) → `sig-metrics` → `mean` → `step-percentile` →
   `sig-spread` → `sig-histogram` → `sig-metrics-room`.
5. ☐ Outage: SLO, error rate and error budget on a step that isn't `flex`; Fix Relay cue; the
   status-page question asked as a user.
6. ☐ `why`: the room's real p50 and slowest group instead of a fake average.
7. ☐ Time: cut the `signals` quiz, merge standards into the OTel step, trim notes so each 0.5-minute
   step is speakable in 30–40 s.
8. ☐ Test: term order along the path.
9. ☐ Chrome walk, both screens, every step; fix what looks wrong; deploy.
