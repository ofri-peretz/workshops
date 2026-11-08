# Intent: `A room of 50 strangers, run calmly`

**Status:** open (2026-11-08) · **Owner:** `@ofri-peretz`

## What is wanted

Up to 50 people, strangers to the presenter, at every level of engagement, join without friction, play
without ever being exposed for not knowing, and leave with a recap. The presenter runs it from the
console without surprises. Every engagement signal is stored, per run, and readable later.

## Principles

- Nobody is exposed: the screen shows shares and only positive names (top 5, "+4"); names behind
  wrong answers live only in the presenter's report.
- The right code always gets in. Nothing a participant does by accident locks out the room.
- Every tap that matters is an event in `relay_events`, tagged with its run; the console can list,
  open and export any run.
- 50 phones: joins, the push stream and check-ins stay fast on Vercel + Supabase.
- The projector shows the room's content, never the presenter's controls or notes.

## Done when

- `node scripts/load.mjs` with 50 phones shows no errors and p95 check-in under 1 s, locally and on
  the deployed relay.
- The review's P0s are fixed and its P1s are fixed or recorded with a reason (plan.md).
- Relay tests and e2e pass; both Vercel projects are deployed.
