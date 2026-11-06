# Intent — `Signals: the first workshop of a monitoring and performance series`

**Status:** proposed (2026-11-06) · **Opened:** `2026-11-06` · **Owner:** `@ofri-peretz`

---

## What is wanted

A **monitoring and performance series of four workshops**. The 60-minute pilot runs the first one,
**Signals**, and shows all four at the start. Signals is **simple and guided** and leaves a **strong
impression**: one app, one story, three signals, one live outage the room solves together. Juniors
and seniors follow the same path; seniors get a Go deeper card.

## Why now

- The host wants his teams trained, in 60 minutes, into monitoring, proactiveness and
  performance. The pilot is on 2026-11-08.
- Ofri, 2026-11-06: a series of 4 with the first one delivered; each person runs the demo on their
  own phone through QR codes while Ofri walks the room, then one run together on the big screen,
  then wrap up and move on; real-life business cases; addresses as
  `[sub-slug].[workshop-slug].workshop.ofriperetz.dev`; and: "people need things to remain simple,
  they need to be guided, we have only 60 minutes; we need to leave a SUPER strong impression".

## The series

| #   | Workshop                                                                                                   | Slug        |
| --- | ---------------------------------------------------------------------------------------------------------- | ----------- |
| 1   | **Signals** — metrics, logs and traces, and how to use them in an outage                                   | `signals`   |
| 2   | **API performance** — latency, percentiles, timeouts, N+1, DB selectivity and indexes, GraphQL, load tests | `api`       |
| 3   | **Web performance** — what the browser felt: LCP, INP, CLS at p75, network phases, real users vs lab       | `web`       |
| 4   | **Before users notice** — SLOs and nines, error budgets, burn rate, alerts, status pages                   | `proactive` |

Workshops 2–4 are shown, not delivered; they reuse Relay editions ≤ 4.1.

Ofri, 2026-11-06, also asked for: web and API performance; DB selectivity; how logs travel from
stdout to CloudWatch, Kibana and the like, with the challenges; OpenTelemetry; the older standards
teams may still run; and "each term or concept should be demonstrated through a self-engaging
app/flow". Signals touches web, API and DB once, inside the trace (part 4), and points to workshops
2 and 3 for the depth.

## Simple, by design

- **One scan.** One QR at the start. After that every phone follows the big screen by itself; nobody
  types an address or finds their place.
- **One app.** Relay, a chat everyone already understands. Every demo is "send a message and look at
  what it left behind".
- **One question per part,** asked the way a user would: Are users OK? Who exactly? Where did the
  time go? What broke?
- **Three signals, not twelve terms.** Counter, gauge, histogram and percentile live inside Metrics;
  labels, cardinality, scraping and sampling are Go deeper cards and later workshops.
- **One picture:** a car. Metrics are the dashboard, logs are the service book, a trace is the GPS
  replay of one trip.

## The strong impression

1. **They feel it** before any term: some phones get replies instantly, others wait 7 seconds.
2. **They see themselves:** their own line in the log, their own message as a trace.
3. **The room fixes something live:** a trace has 80 ms nobody owns; one tap adds the span and the
   gap disappears on every phone.
4. **The room solves an outage:** Ofri breaks Relay; phones get the alert; the room goes metrics →
   logs → trace and names the cause.
5. **They leave with something:** a personal card (your messages, your p95, your slowest trace) and
   three questions to ask their own dashboards on Monday.

## Signals — 60:00

| Part                   | Question           | Time  |
| ---------------------- | ------------------ | ----- |
| Feel it + the series   | Who's waiting?     | 6:00  |
| Metrics                | Are users OK?      | 13:00 |
| Logs                   | Who exactly?       | 12:00 |
| Traces                 | Where did time go? | 13:00 |
| The outage             | What broke?        | 10:00 |
| Your card, Monday, Q&A | What do I do now?  | 6:00  |

Each of Metrics, Logs and Traces is the same loop: explain on the big screen (2 min), try it on your
phone while Ofri walks the room (4–5 min), together on the big screen with the room's data (4 min),
wrap up in one sentence (2 min). Details in [spec.md](spec.md).

## Addresses

`[sub-slug].[workshop-slug].workshop.ofriperetz.dev`; phones are moved between them by the big
screen, so the addresses also work as bookmarks after the session (while the room is live).

| Address                                    | Part                       |
| ------------------------------------------ | -------------------------- |
| `signals.workshop.ofriperetz.dev`          | Join (the one QR) and chat |
| `metrics.signals.workshop.ofriperetz.dev`  | Metrics                    |
| `logs.signals.workshop.ofriperetz.dev`     | Logs                       |
| `traces.signals.workshop.ofriperetz.dev`   | Traces                     |
| `incident.signals.workshop.ofriperetz.dev` | The outage                 |
| `screen.signals.workshop.ofriperetz.dev`   | The big screen (presenter) |

## Constraints

- English only on every screen, phone and handout; a check fails on Hebrew characters.
- **No employer material** (ventures `AGENTS.md`): business cases from public apps and public
  postmortems. Ofri may tell his own experience out loud; it is never written down here.
- No unit, system, host or client names, and no client screenshots.
- Real measurements only, from events Relay already records.
- Nothing is reachable unless the room is live ([relay-access](../relay-access/intent.md)).
- Interlace palette (`brand/check-palette.mjs`).

## Success criteria

- `node relay/test.mjs` exits 0, and exits non-zero when:
  - the Signals path is not 60:00;
  - a part lacks its question, analogy, business case, try-it task or one-line wrap-up;
  - `/metrics` is not valid Prometheus text, or histogram buckets are not cumulative;
  - a log line lacks `trace_id`;
  - the outage leaves no trace of its cause in the metrics, logs and traces;
  - Hebrew appears in `relay/`, the handout, the README or the speaker intro.
- Dry run on 2026-11-07 with 4+ phones: one scan, every phone follows the big screen through all six
  parts, Add span clears the gap, the outage is findable from a phone, every phone gets its card.
- Ofri accepts this intent and the spec before the build starts.

## Open decisions (default taken)

- Series names and slugs as in the table. **Default: as written.**
- Fallback if Signals is not solid at the dry run: Relay Workshop 2 then 4 as built (60 min).
