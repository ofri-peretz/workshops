# Roadmap: Signals, ready to present

Everything the presenter asked for, and everything the 2026-11-08 review found, in one list. Status:
✅ done · ◐ partly · ☐ open. Each block links the intent that owns it.

## P0: nobody gets lost ([signals-clarity](../.sdlc/intents/signals-clarity/intent.md))

- ✅ A concept ladder: every idea gets one step, one picture, before it is used (`type: "step"`).
- ✅ Requests and latency: the room's own last request on the phone.
- ✅ Metrics in teaching order: what a metric is (the room's live counter and gauge), the room sends,
  the average question, the line-up where the average sits on nobody, the room's p95 guess, the
  room's spread, the room's own histogram (p95 from buckets next to the exact one), the room's numbers.
- ✅ Logs: what a log is, your own line field by field, severity with the room's counts and a quiz,
  filter by your id, stdout, the shipper, sync vs async flush, what it costs (verified prices: the room's
  bytes scaled to 1,000 req/s), habits (with Twitter's password log).
- ✅ Traces: one request across services (your trace id), a span (Relay's real span names), your
  own trace, a span in code (`finally`), the gap nobody owns, propagation, OpenTelemetry with why
  standards exist, your spans' road.
- ✅ Outage: the room breaks Relay, the status page as a user, the SLO with the room's own numbers
  (promise kept, error rate, error budget), the chart with the Fix Relay cue.
- ✅ "How it works": one line on every hands-on step saying what the room is about to see.
- ✅ Order: no jargon appears on a slide before the step that teaches it (`relay/test.mjs`).
- ✅ Six groups everywhere; the "why" slide shows the room's real numbers.
- ✅ 57 minutes of content plus a 3-minute buffer.
- ◐ Speaker notes on 0.5-minute steps run 60–90 words: say the first two sentences, skip the rest
  when short of time.

## P0: the room plays, not watches ([signals-engagement](../.sdlc/intents/signals-engagement/intent.md))

- ✅ Dana types back; what she says depends on your group's wait.
- ✅ Six latency groups (0.1, 0.3, 0.5, 1, 3, 7 s).
- ✅ New scored questions: severity, the room's p95; the learning check asks with new numbers.
- ☐ The gap in the trace as a vote ("where did 80 ms go?").

## P1: cases that land ([signals-cases](../.sdlc/intents/signals-cases/intent.md))

- ✅ Cases on the path and every study carry a bridge to what the room did and a one-line impact.
- ✅ Twitter's password log sits on the habits step; Cloudflare 2025 is told as a signal story.

## P1: the phone looks finished ([phone-ux](../.sdlc/intents/phone-ux/intent.md))

- ✅ Top bar: one line: mark, live dot, chapter, timer, score, Terms.
- ✅ "I want more on this"; after the tap, "Noted: the presenter sees it"; the screen counts "want more".
- ✅ Step visuals fit 360 px, light and dark.

## P2: the other workshops

- ☐ Workshops 1–4 get the same treatment (steps, short titles, cases with impact).
- ☐ Series mapping: workshop 4 belongs to a series track; track 3 has a workshop.
