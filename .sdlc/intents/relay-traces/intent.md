# Intent — `Relay: every message is a real trace`

**Status:** built (edition 4.1, 2026-10-26) · **Opened:** `2026-10-26` · **Owner:** `@ofri-peretz`

---

## What is wanted

Attendees see their own message as a trace: the spans it went through, what each span means, and
where the time went. The room's traces come from Relay itself, not from a drawing. A workshop
on traces and spans teaches what they are, how they look and how to read them, using those
traces.

## Why now

- Ofri, 2026-10-26: "We want to talk about traces, spans, what they mean, how they look like … in
  our demo app … how the request or the experience they had looks like on traces."
- Today the only trace is a fixed drawing (`gantt`: 95 ms, 15 ms in the database, 80 ms with no
  span). Every other concept in Relay happens on the attendee's phone; traces don't.

## Affected users and systems

- Attendees' phones and the projector.
- `handler.mjs` (spans are measured where the work happens), `core.mjs` (traces in the room),
  `phone.html` (the W3C `traceparent` header out, Resource Timing and `Server-Timing` in).
- Supabase `relay_events`: a new event kind `trace`, so a migration and `schema.sql` change.
- The scene library, concepts and glossary; a fourth workshop.

## Constraints

- Real measurements only. Every span duration is measured; nothing is drawn to look right. The
  one deliberate exception is the work Relay does without a span (the gap), which is real work
  that is not instrumented until the presenter adds the span.
- Web standards, standard library only: W3C Trace Context (`traceparent`), `Server-Timing`,
  Resource Timing. OpenTelemetry names for spans and attributes. No tracing SDK and no vendor.
- Each trace event stays under the table's 2 KB data limit. There are no personal attributes: a
  trace says what the request did, never who sent it.
- Every workshop stays 30 minutes net, and nothing from editions ≤ 4.0 is dropped (the 4.0 checks
  keep applying).
- The colours are the Interlace palette (`brand/check-palette.mjs`).

## Success criteria

- `node relay/test.mjs` exits 0. It must exit non-zero when:
  - a message's spans do not add up inside their parent;
  - the uninstrumented gap is missing before "Add span" or still there after it;
  - a span name is not in the OpenTelemetry-style list;
  - the handler writes an event kind `schema.sql` doesn't allow.
- Mutation check: dropping the `relay.deliver` span makes the test fail.
- Live, with 4+ phones: each phone shows its last message as a trace with its trace id; the
  projector shows the room's slowest and typical traces; after "Add span" new traces show the
  missing span.
- Ofri accepts the spec before the build starts.

## Open questions

See `spec.md` § Open decisions, which lists a default for each.
