# Intent — `Relay in the browser: measure what each phone felt`

**Status:** proposed (intent only; spec after the traces workshop) · **Opened:** `2026-10-26` ·
**Owner:** `@ofri-peretz`

---

## What is wanted

The **Frontend** track of the series: a separate 30-minute workshop on performance as the browser measures it. Each attendee's phone
measures its own experience of a Relay page: how fast the main content appeared, how fast a tap
answered, whether the layout jumped. The projector shows the room's distribution the way field
data (real-user monitoring) does, next to a lab measurement of the same page.

## Why now

- Ofri, 2026-10-26: "we want to do the same with performance measurements over browsers BUT that
  will be a different workshop."
- The traces workshop ends at "your phone measured this" (DNS, TLS, time to first byte). This
  workshop picks up from there: what happens after the bytes arrive.
- Track C (performance) has no browser module. Track D's "Frontend truth" covers errors and CSP,
  not speed.

## Affected users and systems

- A new Relay page built to be measured: a large hero image (LCP), a slow tap handler (INP) and
  late-loading content that shifts the layout (CLS), each with a fixed version the presenter can
  switch to live.
- `phone.html`: `PerformanceObserver` for `largest-contentful-paint`, `event` (INP),
  `layout-shift`, `long-animation-frame`; results sent as events.
- The projector: the room's distribution and p75 per metric, before and after the fix.
- Supabase: a new event kind (migration + `schema.sql`, enforced by the existing check).

## Constraints

- The browser's own APIs only; no analytics vendor or library.
- Thresholds and definitions are cited from web.dev, with the date. Support differs by browser:
  phones that can't measure a metric say so instead of reporting zero.
- Anonymous like the rest of Relay. The only device detail allowed is a coarse class (phone or
  tablet, browser family) to explain spread.
- 30 minutes net; concepts and terms go through `concepts.mjs` like every other workshop.

## Success criteria (to refine in the spec)

- On real phones in the room, each phone shows its own LCP, INP and CLS, and the projector
  shows the room's p75 for each.
- Switching to the fixed version moves the room's p75 measurably within the session.
- The self-check covers the metric events and the 30-minute paths.

## Open questions

- Lab tool on the projector: Lighthouse run live, or a recorded run? Default: a recorded run
  plus one live run if the network allows.
- Which slow-tap cause to show: a long task on the main thread, or a heavy re-render? Default:
  a long task, since it's the most common cause and the easiest to see in the
  `long-animation-frame` entry.
- Workshop number and catalog slot: default C6 in Track C, next to Relay (C5).
