# Design — `Relay: a library of workshops that follows the room`

**Status:** accepted by Ofri with the defaults (2026-10-26) · built in edition 4.0 · **Intent:** [intent.md](intent.md)

## Requirements

- **R1 Concept inventory.** `concepts.mjs` lists every concept taught in editions 2.x–3.3, each
  with an id, a one-line claim and the edition it came from. Every concept has at least one scene.
- **R2 Glossary.** `GLOSSARY` defines every term once: a plain definition plus one example from
  Relay. Each scene lists the `terms` it teaches. A term is used only after the scene that defines
  it, or with its definition shown inline.
- **R3 Terms on the phone.** Each phone has a "Terms" tab that grows as the session goes,
  holding every term taught so far. It stays after the session so attendees keep a glossary.
- **R4 Spine and detours.** A workshop is a **spine**: a fixed list of scenes with fixed time.
  It contains **forks**. Each fork offers 2–3 **detours** of exactly the slot's length, so every
  path takes the same time. A detour is a run of library scenes and returns to the spine after
  the fork.
- **R5 The room steers.** At a fork, phones vote "what next?" between the detours. The projector
  shows the vote live; Reveal takes the winner. The presenter can override by picking any detour,
  or "Stay on the spine", which runs that fork's default detour.
- **R6 Curiosity signal.** Every phone scene has a **"Go deeper"** tap, one per phone per scene.
  The projector shows the count next to the scene. The fork's detour options are ordered by the
  curiosity their concepts drew earlier in the session.
- **R7 Free jump.** Under Notes, the projector has a **Library** menu listing every scene by
  concept. Picking a scene plays it as a detour and returns to the spine. The clock shows the time
  over budget, and the spine marks which `flex` scenes to skip to recover it.
- **R8 Time holds.** Every workshop's spine plus any detour choice totals exactly 30:00,
  questions included. The self-check enumerates every branch.
- **R9 Paths are data.** A workshop is `{ id, title, promise, spine: [sceneId | {fork}] }` in
  `workshops.mjs`. Workshops 1 and 2 keep today's spines. **Workshop 3, "GraphQL measured"**, is
  built from the 13 recovered concepts. Longer formats (half-day, full day) are longer spines over
  the same library.

## Design

```text
concepts.mjs   CONCEPTS: id → { claim, from }         GLOSSARY: term → { def, example }
scenes.mjs     SCENES: id → { type, …, concepts: [], terms: [], flex? }   (unchanged shape + 3 keys)
workshops.mjs  WORKSHOPS: [{ id, title, promise, spine: [id | { fork, slot, detours: [[id…]…], default }] }]
core.mjs       room.path = flattened scene ids for the chosen branch; fork votes are answers;
               new events: curious, choose (fork → detour), detour (library jump)
```

- **The reducer stays deterministic.** `choose` and `detour` are control events, so every
  serverless instance builds the same path from the same log.
- **Fork vote:** a poll whose options are the detour titles. Reveal writes `choose` with the
  winner, or the presenter override.
- **Curiosity:** `curious` events are capped at one per phone per scene. A count per concept feeds
  the order of detours at a fork.
- **Terms:** `phoneView` returns the terms of every scene already shown on this path. The phone
  keeps them in `localStorage` (convenience only; the server stays the source).
- **Recovered concepts (R1, from the 2.x deck):**
  - latency as a business number;
  - affected requests = volume × (1 − percentile);
  - store histograms, since percentiles can't be averaged;
  - the standard names (`http.server.request.duration`);
  - nines as a roadmap decision;
  - one endpoint gives one meaningless p99;
  - the operation is the unit;
  - which GraphQL errors count;
  - parse → validate → execute;
  - N+1;
  - measure cost, not requests;
  - measure per consumer;
  - load-test by operation;
  - "the host's flagship service, live" (a slot the presenter fills from the delivery log).

## Verification

`node relay/test.mjs` adds:

1. Every `CONCEPTS` id is carried by at least one scene. Mutation: drop the only scene carrying
   `percentile-impact` and the test must fail.
2. Every `terms` entry is in `GLOSSARY`, and every glossary term is taught by some scene.
3. Every workshop, over every combination of fork choices, totals 30.
4. Through the handler: four phones vote at a fork; Reveal; the path goes through the winning
   detour and back to the spine; a library jump returns too; the clock shows the overrun.
5. `node brand/check-palette.mjs` stays green on the new projector and phone UI.

Live check on the hosted room with 4+ simulated phones, the same as the 3.1 smoke test.

## Open decisions (default in brackets)

- **Slot length:** [3 min. Long enough for one interactive scene plus its reveal.]
- **Who decides at a fork:** [the room's vote, with a presenter override.]
- **Terms tab on phones:** [yes. Terms are generic and public, so the privacy boundary holds.]
- **Edition:** [4.0. Forks change how the workshop is run, not only its content.]

## Rejected alternatives

- **Free-form "choose any scene" without forks:** the time can't be guaranteed, and the presenter
  improvises under pressure. A free jump exists (R7) but comes with a visible time cost.
- **A separate deck per audience:** content forks and dies; one library with paths keeps every
  concept alive and checked.
- **AI-generated detours on the fly:** unreviewed claims in front of a paying room. Detours stay
  authored and checked.

## Out of scope

Free-text questions from phones; per-attendee accounts; analytics beyond the session's event log.
