# Intent — `Relay: the presenter opens and closes the room from a console on their laptop`

**Status:** accepted (2026-11-06) · **Owner:** `@ofri-peretz`

## What is wanted

Every workshop address is closed by default. The presenter runs a console on their own laptop,
signs in with a one-time code sent to their email, and presses **Go live**: the room opens and a
6-digit join code appears with its QR. The code admits new phones for 60 minutes. **Close** shuts
everything at once. Guessing is blocked. Nothing public can control the room.

## Architecture

```text
Presenter's laptop                         Cloud
Console (Next.js, localhost:4180)          Supabase
  sign-in: email code (Supabase Auth)  ──▶  relay_access  live?, code hash, expiry, attempts
  Go live / Close / run the workshop   ──▶  relay_events  the room's log (Relay replays it)
  big screen, rehearsal drill               RLS: only the owner's user id may write either
        │ HDMI                                         ▲ reads
        ▼                                  Vercel (phones only, no admin routes)
   the room's screen                         *.signals.workshop.ofriperetz.dev
                                             closed page unless relay_access says live
                                           PostHog: how the workshop went (anonymous)
```

## Controls

| Threat                              | Control                                                                 |
| ----------------------------------- | ----------------------------------------------------------------------- |
| Someone else opens the room         | Only the owner's Supabase user may write `relay_access` (RLS); sign-ups off |
| Taking over the console             | Email one-time code (Supabase Auth); the console listens on localhost only |
| Guessing the join code (1 in 10⁶)   | 5 wrong tries per IP per 10 minutes, then 429                           |
| Many IPs guessing together          | 30 wrong tries room-wide in 10 minutes locks joining until the presenter reopens |
| A leaked database row               | The code is stored as an HMAC (`CODE_SECRET`), compared in constant time |
| Reaching it after the workshop      | Code dies at 60 minutes; sessions die on Close or 2 hours after Go live |
| Counters per serverless instance    | Attempt counters live in Supabase                                       |
| Secrets in this public repo         | Service key, `CODE_SECRET`, tokens and the owner's email only in env; `scripts/scrub.mjs` blocks them |

## Success criteria

- `node relay/test.mjs` exits 0, and exits non-zero when any control above is removed:
  closed → 403 on every phone route; wrong code → 401; 6th wrong try → 429; 30th room-wide →
  locked; code at minute 61 → refused; session after Close → refused.
- The anon key alone cannot update `relay_access`; the signed-in owner can.
- Dry run: Go live in the console, a phone scans in, Close ends its session.

## Decisions

- Phones already in when the code expires keep working until Close or the 2-hour cap.
- Passkey sign-in comes after the first delivery; the email code covers it.
- PostHog gets anonymous events only: random phone id, no person profiles, no autocapture or
  recording, never the code or an IP.
