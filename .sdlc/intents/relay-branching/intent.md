# Intent — `Relay: a library of workshops that follows the room`

**Status:** built (edition 4.0, 2026-10-26) · **Opened:** `2026-10-26` · **Owner:** `@ofri-peretz`

---

## What is wanted

The API-performance workshops become a **set** built from one concept library. Nothing taught in
any edition is ever lost. Every term is defined and kept on the attendees' phones. During a
session the presenter can change direction based on what the room is curious about, without
going over the 30 minutes.

## Why now

- Ofri, 2026-10-26: "double down on terms and concepts, we should not drop things we've already
  did … a set of workshops, even in some way dynamic … change the trajectory … according to the
  audience curiosity/responses."
- Rebuilding the 2.x deck into Relay 3.0 (2026-10-20) dropped 13 concepts. Among them: percentile
  to impact, histograms, the standard metric names, and most of GraphQL (the operation as the
  unit, which errors count, parse/validate/execute, N+1, cost, per consumer, load-testing by
  operation), plus the host's flagship service shown live. Nothing checks for drops.

## Affected users and systems

- Attendees' phones (`phone.html`), the projector (`screen.html`), the room state (`core.mjs`,
  Supabase event log), and the run of show (`scenes.mjs`).
- Ofri as presenter. Future buyers of the talk, half-day and full-day formats.
- `interlace-llc/segments/workshops/materials/api-graphql-performance/`.

## Constraints

- Each workshop stays **30 minutes net**, whatever the room picks. Questions are included.
- Every concept from editions 2.x–3.3 stays in the library. A concept is removed only by an
  explicit, logged decision.
- The material stays generic and owned by the venture. Nothing about a host's systems goes into
  scenes; that lives in the delivery log.
- Phones stay anonymous, show no free text, and get only public content. The palette and AAA rules
  of `brand/check-palette.mjs` apply.
- Standard library only. Hosting stays on the existing Vercel + Supabase setup.

## Success criteria

- `node relay/test.mjs` exits 0. It must exit non-zero when:
  - a concept from the inventory has no scene;
  - a scene uses an undefined term;
  - any branch of a workshop goes past 30 minutes.
- Mutation check: deleting the only scene that carries a concept makes the test fail.
- In a live run with 4+ phones, a fork vote picks a detour, the room goes through it and returns
  to the spine, and the clock still ends at 30:00.
- Ofri accepts the spec before any build starts.

## Open questions

See `spec.md` § Open decisions, which lists a default for each.
