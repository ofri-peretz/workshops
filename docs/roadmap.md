# Roadmap: Signals, ready to present

Everything the presenter asked for, and everything the 2026-11-08 review found, in one list. Status:
✅ done · ◐ partly · ☐ open. Each block links the intent that owns it.

## P0: nobody gets lost ([signals-clarity](../.sdlc/intents/signals-clarity/intent.md))

- ✅ A concept ladder: every idea gets one step, one picture, before it is used (`type: "step"`).
- ✅ Requests and latency: the room's own last request on the phone.
- ✅ Metrics: counter, gauge, histogram, then percentiles as a line-up where the average sits on nobody.
- ✅ Logs: what a log is, your own line field by field, severity with the room's counts, stdout, the
  shipper, sync vs async flush, what it costs (verified prices), habits.
- ✅ Traces: one request across services, a span, your own trace, a span in code.
- ✅ Standards and OpenTelemetry: why standards exist, what OTel is.
- ✅ "How it works": one line on every hands-on step saying what the room is about to see.
- ☐ Order: no term appears in a title, lead, phone line or "how" before the step that teaches it
  (a test enforces it).
- ☐ Metrics order: what a metric is, the room's counter, the average question, the line-up, the room's
  spread, the room's own histogram, the room's numbers.
- ☐ "Four waits" → six groups everywhere.
- ☐ Explainer spans match Relay's real spans (`session.lookup`, `relay.deliver`, `db.pool.acquire`,
  `db.append`).
- ☐ `span.end()` in `finally`; Grafana/Kibana named as UIs, not stores.
- ☐ Histogram: the room's real buckets; "an estimate, as good as your buckets".
- ☐ The outage teaches SLO, error rate and error budget on a step that is never skipped, and cues
  Fix Relay.
- ☐ The "why" dashboard shows the room's real numbers, not a fake average.
- ☐ Fit 60 minutes at a real speaking pace: cut repeats (`signals` quiz), merge standards + OTel.

## P0: the room plays, not watches ([signals-engagement](../.sdlc/intents/signals-engagement/intent.md))

- ✅ Dana types back; what she says depends on your group's wait.
- ✅ Six latency groups (0.1, 0.3, 0.5, 1, 3, 7 s).
- ☐ A scored question at least every 3 minutes: severity ("3.2 s, succeeded: which level?"),
  cost, the room's p95 prediction, the gap in the trace.
- ☐ The learning check asks the average question again with new numbers (understanding, not memory).

## P1: cases that land ([signals-cases](../.sdlc/intents/signals-cases/intent.md))

- ◐ Every case says why it relates to what the room just did (a bridge).
- ☐ Every case shown also says its business impact in one line (`impact`), verified.
- ☐ Cases sit where they teach: Twitter's password log on the habits step.

## P1: the phone looks finished ([phone-ux](../.sdlc/intents/phone-ux/intent.md))

- ☐ Top bar: one line, the chapter, the timer, score; terms behind a clear button.
- ☐ "Go deeper" says what it does, and the room sees its effect.
- ☐ Step visuals sized for a 360 px phone.

## P2: the other workshops

- ☐ Workshops 1–4 get the same treatment (steps, short titles, cases with impact) after Signals ships.
- ☐ Series mapping: workshop 4 belongs to a series track; track 3 has a workshop.
