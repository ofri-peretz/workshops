# Design — `Relay: every message is a real trace`

**Status:** accepted by Ofri with the defaults (2026-10-26) · built in edition 4.1 · **Intent:** [intent.md](intent.md)

## Requirements

- **R1 Every message is a trace.** Each `POST /send` produces one trace: a root span plus child
  spans, each with a measured start and duration:

  ```text
  POST /send                    root, server            http.route=/send, http.response.status_code
  ├─ session.lookup             cookie → phone          relay.group
  ├─ relay.deliver              the phone's group wait  (0.1 / 1 / 3 / 7 s)
  ├─ (gap)                      message rendering, ~80 ms, no span until "Add span"
  └─ db.append                  the Supabase insert     db.system=postgresql
  ```

- **R2 The gap is real.** Relay does about 80 ms of uninstrumented work per message (rendering
  the message). It appears as a gap in the trace. The presenter's **Add span** control
  instruments it: later messages show a `message.render` span, earlier ones keep their gap.
- **R3 Context propagation.** The phone sends a W3C `traceparent` header with a fresh trace id;
  the server continues that trace (its root span's parent is the phone's span). The response
  carries a `Server-Timing` header with the server's spans.
- **R4 The phone's part.** The phone adds its own client span (`relay.send`, the full wait) and,
  from the browser's Resource Timing entry for that request, the connection phases (DNS, connect,
  TLS, request sent, time to first byte, download), plus the `Server-Timing` spans. The phone
  sends the finished trace back once, as an event of kind `trace`.
- **R5 "Your message, as a trace"** (phone). A Gantt of the phone's last message with its trace
  id (the first 8 hex characters shown). Tapping a span shows its name, duration, parent and
  attributes.
- **R6 "The room's traces"** (projector). The slowest and the typical (median) message side by
  side, on the same time axis, with the gap marked. Also a count of traces and of traces that
  have the gap. **Add span** lives in the presenter bar.
- **R7 Teach the anatomy.** New concepts and glossary terms, carried by scenes:
  - trace anatomy: a tree of spans sharing one trace id;
  - span anatomy: name, start, duration, parent, attributes, status;
  - context propagation (`traceparent`);
  - sampling: head vs tail, keep the slow and failed ones;
  - exemplars: from a point on a latency chart to the trace behind it;
  - span status: a failed span is marked as an error;
  - browser timing: what the phone itself measured.
- **R8 Workshop 4 — "Follow one request: traces and spans"**, 30 minutes:

  | Min   | Scene                    | Type                                                                                             |
  | ----- | ------------------------ | ------------------------------------------------------------------------------------------------ |
  | 0–1   | Who I am                 | intro                                                                                            |
  | 1–3   | Meet Relay               | chat (collects traces)                                                                           |
  | 3–5   | Where did the time go?   | journey                                                                                          |
  | 5–6   | Which signal?            | poll                                                                                             |
  | 6–9   | Your message, as a trace | trace (new)                                                                                      |
  | 9–11  | What's in a span?        | poll (new)                                                                                       |
  | 11–13 | Same trace, two services | poll (new): `traceparent`                                                                        |
  | 13–16 | The time nobody owns     | trace (new): the room finds the gap, presenter adds the span, the room sends again               |
  | 16–18 | Keep the slow ones       | poll (new): tail sampling                                                                        |
  | 18–19 | From a chart to a trace  | poll (new): exemplars                                                                            |
  | 19–22 | **Fork**                 | Inside one GraphQL request · When a span fails (break Relay; red spans) · Your own service, live |
  | 22–24 | Your phone measured this | trace (new): DNS, TLS, TTFB from the browser; preview of the browser workshop                    |
  | 24–25 | Monday                   | takeaway                                                                                         |
  | 25–26 | Next: the browser        | next                                                                                             |
  | 26–30 | Questions                | qa                                                                                               |

- **R9 The other workshops get the real thing too.** Workshop 2's and Workshop 3's `gantt` scene
  shows the room's own slowest trace once one exists, and falls back to the fixed drawing.

## Design

- **Spans are measured in the handler**, around the code they name, with `performance.now()`.
  `message.render` is a short, real CPU-bound step; its span is wrapped only when the room's
  `instrumented` flag is set (control op `instrument`, an event, so every instance agrees).
- **Ids:** 16-byte trace id from the phone's `traceparent` (or generated if missing or invalid);
  8-byte span ids from `crypto.getRandomValues`. Ids are random, never derived from the phone id.
- **Event `trace`** = `{ traceId, spans: [{ id, parent, name, start, dur, attrs }] }`. Starts are
  relative to the root span; at most 16 spans; checked < 2 KB before append. The reducer keeps the
  last trace per phone and a ring of the room's last 200 traces.
- **Resource Timing:** same-origin requests expose `domainLookup*`, `connect*`,
  `secureConnectionStart`, `requestStart`, `responseStart`, `responseEnd` and `serverTiming`.
  Missing values (cached connection, an older browser) become absent spans, not zeros.
- **Supabase:** migration adds `trace` to `relay_events_kind_check`; `schema.sql` updated; the
  4.0 check (handler kinds ⊆ schema kinds) keeps it honest.

## Verification

`node relay/test.mjs` adds:

1. A message's spans: every child starts at or after its parent and ends at or before it.
   `relay.deliver` is about the phone's group time.
2. Before Add span, the server spans don't cover the root (gap ≥ 50 ms at scale 1). After it,
   a `message.render` span covers the gap.
3. `traceparent` in → the same trace id out in the stored trace; a malformed header gets a fresh
   id.
4. Span names come from one allowed list; attributes hold no phone id.
5. Mutation: removing the `relay.deliver` span from the handler fails check 1.
6. Workshop 4 is 30 minutes on every fork choice; every new concept has a scene and every new
   term is in the glossary (the existing 4.0 checks).

Live check with 4+ simulated phones on the hosted room, plus one real phone for the Resource
Timing phases.

## Open decisions (default in brackets)

- **Where traces live:** [a dedicated Workshop 4, plus real traces in Workshop 2's and 3's
  `gantt` scene. Workshop 2 keeps its time budget.]
- **The gap:** [real, uninstrumented rendering work (~80 ms) that the presenter instruments
  live. A fake sleep would teach the wrong lesson.]
- **Edition:** [4.1. A new workshop and a new scene type; the way the workshop runs is the same.]
- **Browser phases on the phone:** [shown when the browser exposes them, labelled "your phone
  measured this". It's the bridge to the browser workshop, which is a separate intent.]

## Rejected alternatives

- **OpenTelemetry SDK + a hosted backend (Jaeger, Tempo):** a dependency, a hosted service and
  a login for the room. The concepts and names are the same without it; one slide names the tools.
- **Drawn traces with made-up numbers:** what 4.0 already has; it doesn't show the attendee their
  own request.

## Out of scope

Browser performance (Core Web Vitals, RUM): its own workshop
([`relay-browser-perf`](../relay-browser-perf/intent.md)). Distributed traces across more than
Relay's own spans; trace storage beyond the session.

## Build notes (2026-10-26)

Decisions made while building, each reversible:

- **No new event kind, no migration.** Server spans ride back with the phone's existing `rtt`
  event (shape-checked by `validSpans`/`validPhases`), and the trace id rides on `send`. The
  4.0 schema check still guards event kinds.
- **The gap is a modeled 80 ms wait for a database connection** (`db.pool.acquire`), measured
  like every other span. Real CPU work would block the shared serverless instance and distort
  every phone's latency, and pool waits are the most common untraced time in real services.
- **The gap scene shows the fastest message**, where 80 ms is visible. The traces scene keeps the
  slowest and typical messages on one time axis.
- **The three-track series** (Backend, Frontend, AI/LLM) is on every intro, on the projector and
  phones, from `SERIES` in `workshops.mjs` (Ofri, 2026-10-26).
- **Live**, the hosted traces show real Supabase time in `db.append` (31–87 ms) and the store
  sync in `session.lookup` (up to 149 ms on a cold instance), which is itself a lesson.
