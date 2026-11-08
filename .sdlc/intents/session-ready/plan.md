# Plan: session-ready

Each step: what, and the proof. ✅ done · ☐ open · ✗ declined (reason).

## P0: would hurt the live session
1. ✅ Right code first, a venue shares one IP (store.mjs, migration 20261108). Proof: test "the right code still gets in"; `pg_proc` shows the new order.
2. ☐ Go live opens the waiting room (`wait: true`), so Begin and the waiting count appear. Proof: test; console shows Begin.
3. ☐ Reset leaves the projector: console-only, behind confirm + cancel. Proof: screen has no Reset; console test id.
4. ☐ Cold start replays from the latest `start` or `reset`, not only `reset`. Proof: test on the replay point.
5. ✅ Run reports read every page of events (was 5,000 max). Proof: store.events pages by 1,000.
6. ✅ Phones poll every 6 s while the push stream is up (was 1.5 s on top of it). Proof: load test.

## P1: below standard
7. ☐ No names behind negatives: leaderboard shows only ▲ moves; Most improved shows "+4". Remove the dead "Show who voted what" (console checkbox, `voters`, `votersOf`, screen renderer).
8. ☐ Phone feedback: 409/423/network on answers shows a short line; term answers roll back on failure; "Reconnecting…" strip after 2 failed checks.
9. ☐ Recap survives Close: the phone keeps the recap link and shows it on the closed page.
10. ☐ Phone header at 360 px: points/rank only after a reveal; buttons ≥ 44 px tall.
11. ☐ Projector clean: controls, clock and notes only with `?presenter=1` (the console's "Open the big screen" link keeps them on the laptop copy).
12. ☐ Keys: ignore `e.repeat` and keys typed into selects/inputs.
13. ☐ Legibility: header code pill ≥ 40 px.
14. ☐ Console live strip during the session: step i/n, present, answered/present, minutes vs plan.
15. ☐ Sign everyone out keeps scores: invalidate sessions, not phones (rejoin with the same name restores the player). Declined if too large; then the confirm says "Scores reset".
16. ☐ Console history: runs list, open any run's report, download its events (JSON).
17. ☐ Data: `close` event on Close; heartbeat carries step + visibility; recap/reminder clicks counted; recap opens logged.
18. ☐ Recap load: bound the read to the run (`until` next start).
19. ✗ Names to a separate purgeable table and service-role-only RLS: needs a schema change and key rotation; recorded for after the event.

## P2 / features
20. ☐ Unanswered terms show "—", not ✗; rank shown only in the top 10.
21. ☐ Extend 30 min button; group label stored in the start event.
22. ☐ Anonymous questions with upvotes at Q&A (top 5 on screen, all in the report).
23. ☐ "I'm lost" / "Got it" pulse into the console strip.

## Verification
- `npm test`, `npx playwright test`, `node scripts/load.mjs <relay> <code> 50 60` locally, then on the deployed relay during a rehearsal room (needs the presenter's go: it opens the production room).
