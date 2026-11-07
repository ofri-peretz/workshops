# Intent — `A workshop people play, not watch`

**Status:** in progress (2026-11-07) · **Owner:** `@ofri-peretz` · **Builds on:** [relay-signals](../relay-signals/intent.md), [docs/signals-60-brief.md](../../../docs/signals-60-brief.md)

## What is wanted

Make the room feel like a live game (Kahoot-like), run by the presenter, and measure it: who came,
who stayed, who learned what, who came back. It has to scale to big rooms and work on any phone.

## Sources (newest wins where they disagree)

- The 60-minute brief, R1–R10 (docs/signals-60-brief.md).
- Ofri, 2026-11-07 (this session), in order:
  - Opening: who I am → the series (animated cards, today's part) → what we'll cover today → the
    one QR. Nothing else carries the series position.
  - Phones follow the presenter instantly; connectivity must be excellent; no second QR, ever.
  - Names: the presenter chooses **anonymous** or **named** per session, and whether the room sees
    who voted for what.
  - Kahoot-like: points, speed, a leaderboard, a game feel on the phone.
  - PostHog tracks engagement; a vision for measuring learning and engagement; churn rate and
    reconnection rate (device-based where possible); local storage with a TTL that offers a
    returning phone its previous session.
  - Built AI-native (intent → spec with acceptance checks → tests → build → verify in Chrome), and
    big: people super engaged.

## Where the brief and later instructions differ

| Topic | Brief | Later instruction | Built |
|---|---|---|---|
| Opening order | series+promise, hook, who I am | who I am, series, today, scan | later |
| Opening slide content | three columns incl. p95, histogram | plain terms, questions at the end | later |
| Names | devices only, never names | presenter picks anonymous or named | later (default **anonymous**) |
| QR on the outro | yes | one QR only | later |
