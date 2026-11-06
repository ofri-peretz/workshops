# Design — `Signals: the first workshop of a monitoring and performance series`

**Status:** proposed (2026-11-06) · **Intent:** [intent.md](intent.md)

## The hour, part by part

Every part has one question, one sentence to remember, one analogy, one business case from an app
everyone uses, and one thing each person does on their phone. A Go deeper card holds the senior
detail; nobody needs it to follow.

### 1. Feel it + the series — 6:00 · "Who's waiting?"

- **Phones:** everyone chats on Relay. Each phone is secretly in a group: replies in 0.1 s, 1 s, 3 s
  or 7 s.
- **Big screen:** "Raise your hand if Relay feels slow." Half the room does. "Your team's dashboard
  would say everything is fine. In the next hour you'll learn to see what they feel."
- **The series:** the four workshops, Signals highlighted (Ofri explains live, 1 minute).
- **Opener incident:** AWS S3, 2017-02-28: the status page couldn't show the outage because it ran
  on the service that was down. Monitoring has to see what users see.

### 2. Metrics — 13:00 · "Are users OK?"

- **Remember:** _Metrics are numbers over time. They tell you something is wrong, fast and cheap,
  but not who or why._
- **Analogy:** the car's dashboard. The odometer only counts up (a **counter**: messages sent); the
  fuel gauge goes up and down (a **gauge**: phones online); "95% of pizzas within 30 minutes" is a
  **percentile**, and it's the promise customers feel, not the average.
- **Business case:** a ride app. The average pickup time looks fine all day, while 1 rider in 20
  waits long enough to switch apps. Only the p95 shows them.
- **Try it (phones):** send 10 messages; watch your own count go up by 10 and your own p95 land next
  to the room's. Question on the phone: "Is your p95 above or below the room's?"
- **Together:** the room's dashboard on the big screen: rate, errors, average vs p95. The average
  says fine; the p95 points at the 7-second group.
- **Wrap up:** "Watch the p95 and the error rate, not the average."
- **Go deeper:** `rate()` over a counter; a percentile is estimated inside a histogram bucket; you
  can't average percentiles across instances.

### 3. Logs — 12:00 · "Who exactly?"

- **Remember:** _A log is one line per event. It tells you exactly what happened to one request, if
  you can find it._
- **Analogy:** a bank statement: one line per transaction, each with an id you can quote.
- **Business case:** a customer calls the bank: "my transfer failed at 14:02". With the transaction
  id support finds it in seconds; without it, someone scrolls a million lines.
- **Try it (phones):** your messages appear as log lines in the room's stream; find your slowest one
  using your own id. Question: "How long did your slowest message take?"
- **Together:** the room's stream on the big screen. "Find the room's slowest message by scrolling."
  Nobody can; filtering by id and status takes a second.
- **Wrap up:** "Every log line carries a request id and a trace id, or it can't be found."
- **Where your line goes (Together, 1 minute):** your line was written to stdout; the platform wrote
  it to a file; a shipper (Fluent Bit, Filebeat, the CloudWatch agent or the OpenTelemetry
  Collector) sent it to a store (CloudWatch Logs, Elasticsearch with Kibana, Loki, Splunk). The demo
  shows the line's three timestamps: written, shipped, searchable.
- **Go deeper:** stack traces split into many events; logs arrive late (alert on metrics); lines
  lost on crash or under pressure; cost per GB; secrets in logs; structured vs free text; logging
  every request is slower and costlier than the metric that answers the same question.

### 4. Traces — 13:00 · "Where did the time go?"

- **Remember:** _A trace is one request's journey, split into spans. It tells you where the time
  went._
- **Analogy:** parcel tracking. The tracking number is the trace id; each scan at a hub is a span;
  "in transit" with no scan is time nobody owns.
- **Business case:** online checkout is slow. The trace shows whether the time went to payment,
  inventory or the database, so you call one team instead of all of them.
- **Try it (phones):** your last message as a trace; tap the longest span. Question: "What happened
  in the gap?"
- **Together (the wow moment):** the room's slowest trace on the big screen has 80 ms with no span.
  Ofri (or a volunteer) taps **Add span**; the next message on every phone shows `db.pool.acquire`
  where the gap was.
- **Wrap up:** "If time has no span, nobody owns it. Add the span."
- **Go deeper:** the `traceparent` header across services; a dropped header shows as "root span not
  received"; sampling keeps the slow and failed ones.

- **Web, API and database in one picture:** the phone's trace already shows the browser's part (DNS,
  connect, TLS, first byte, download) in green and Relay's part in orange, with the database span
  inside it. One sentence each: "this part is web performance, workshop 3; this part is API
  performance, workshop 2; this span is the database, and whether it's fast depends on whether the
  query is selective enough to use an index."
- **OpenTelemetry, one slide:** the trace you just saw is OpenTelemetry's model; instrument once,
  send to any backend.

### 5. The outage — 10:00 · "What broke?"

- **Big screen:** Ofri breaks Relay (part of the sends fail). Every phone gets an alert: "Error rate
  above 5%".
- **Phones, in pairs:** the incident page walks three steps: metrics (what and since when?), logs
  (which messages, which error?), trace (which span failed?). Each step has one tap-to- answer
  question.
- **Together:** a volunteer drives the big screen through the same three steps; the room's answers
  appear; Ofri fixes Relay and the error rate drops back.
- **Wrap up:** "Metrics tell you that, logs tell you who, traces tell you where."
- **Story to close the part:** Knight Capital, 2012-08-01: warning emails arrived before the market
  opened and nobody acted on them; about 45 minutes of trading cost the firm about $440 million. An
  alert nobody watches is not monitoring.

### 6. Your card, Monday, Q&A — 6:00

- **Phones:** a personal card: messages sent, your p95, your slowest trace, the room's verdict on
  the outage. Screenshot-ready.
- **Big screen, three questions for Monday:** Do we see the p95 and the error rate for each service?
  Can we find one request from its id? Does every request have a trace with no gaps?
- **Next:** workshops 2–4 of the series. Q&A.

## Every term has a flow

Ofri, 2026-11-06: "each term or concept should be demonstrated through a self-engaging app/flow".
Each term taught in Signals has a flow on the phone that takes under a minute, in the part's Try it
window; the self-check fails if a Signals term has no flow.

| Term                    | Flow on the phone                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| Counter                 | Tap Send; your counter climbs. Tap Restart; it drops to 0, the rate line doesn't              |
| Gauge                   | Toggle Online; the room's gauge moves with you                                                |
| Histogram               | Your sends drop into buckets as you watch                                                     |
| Percentile vs mean      | Ofri drops one 30-second message; the mean jumps, the p50 doesn't move                        |
| Label and cardinality   | Tap Label me; the series count rises by one per phone                                         |
| Log and structured log  | Find all 503s: once in free text, once with a filter; see which is faster                     |
| Request id and trace id | Paste your id; get your line, then tap through to its trace                                   |
| stdout to store         | Follow your line through written, shipped, searchable; Ofri stops the shipper and lines queue |
| Trace and span          | Your message as a trace; tap the longest span                                                 |
| The gap                 | Spot the gap; after Add span, send again and see it filled                                    |
| `traceparent`           | Send through two services; Ofri drops the header and your trace breaks in two                 |
| Alert                   | Set your own threshold; in the outage see whether yours fired, too early or too late          |

## Requirements

- **R1 Series.** `SERIES` in `workshops.mjs` lists the four workshops; part 1 shows them.
- **R2 Path.** `WORKSHOPS.signals` is the six parts above, 60:00; the self-check sums it.
- **R3 Guided phones.** Phones follow the big screen's current part (the existing scene sync); the
  part's address is where the phone goes, so a phone that reloads lands in the right place.
- **R4 Hosts.** `vercel.json` routes each `*.signals.workshop.ofriperetz.dev` host to its part.
- **R5 Metrics.** `GET /metrics` returns Prometheus text for `relay_messages_total` (counter),
  `relay_phones_connected` (gauge) and `relay_send_duration_seconds` (histogram) from the room's
  events; the metrics page draws the phone's numbers and the room's.
- **R6 Logs.** Relay's existing events rendered as structured lines with `trace_id`; filter by the
  phone's own id; no new event kind.
- **R7 Traces.** Relay 4.1's trace view and Add span, unchanged.
- **R8 Outage.** Break (B) raises the error rate, writes error log lines and marks the failing span;
  the incident page's three answers are checked against what Relay recorded.
- **R9 Card.** Per phone, from its own events only; no names.
- **R12 Flows.** Every term in the table above has its flow; the self-check fails otherwise.
- **R10 English only.** The self-check fails on Hebrew characters.
- **R11 Facts.** The two incidents are checked against their public postmortems before the dry run,
  with the source in the scene's notes.

## Open decisions (default taken)

- The outage in pairs or alone. **Default: pairs**, so juniors aren't stuck and people talk.
- Personal card. **Default: yes**; it is what people show their team the next day.
