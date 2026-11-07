# Spec — `A workshop people play, not watch`

Each requirement has an acceptance check; `relay/test.mjs` (T) or `e2e/` (E) holds it, or the
Chrome walk-through (C) shows it. Build order is top to bottom.

## A. The live game

| # | Requirement | Acceptance |
|---|---|---|
| A1 | The presenter picks **anonymous** or **named** at Go live (console), plus **show voters** on/off | T: start with `names: "named"` sets the room's mode; an unknown mode is refused |
| A2 | Named: after scanning, a phone asks for a first name (1–24 chars, letters, digits, space, `.-'`) before it continues; anonymous never asks | T: a name is stored and trimmed; an invalid one is refused; E: the prompt shows only when named |
| A3 | Points like a quiz: a right answer earns 500 + up to 500 for speed (time left on the step's countdown); a wrong one 0 | T: a fast right answer scores more than a slow one; a wrong one scores 0 |
| A4 | After a reveal, the big screen shows the top 5 (named: names; anonymous: "Player 12"); each phone shows its points and rank | T: the leaderboard orders by points; C |
| A5 | Show voters (named only): after a reveal, each option lists who chose it (first 6, then "+N") | T: voters appear only when named and on; never on phones |
| A6 | **Eyes up (E)**: every phone shows "Look at the screen" and pauses input until toggled off | T: answers are refused while eyes-up; C |
| A7 | **Close & continue (Enter)**: reveal, hold 3 s, next | C |

## B. Connectivity and coming back

| # | Requirement | Acceptance |
|---|---|---|
| B1 | Push on every presenter action (SSE), polling fallback, silent rejoin with the saved code (done) | T: Next reaches a phone in < 1 s (exists) |
| B2 | Local storage keeps `{code, run, name, until}` for 3 hours; a phone that opens the page without a code and with a fresh entry is offered "Rejoin <workshop> as <name>" | E: a stored entry shows the offer; an expired one doesn't |
| B3 | A device mark at join: HMAC of IP + user agent (never stored raw) | T: the join event carries `dev`, 16 hex chars, never the IP |
| B4 | Reconnection rate = joins in a run whose device mark joined earlier in that run, over joins | T: two joins from one device count one reconnection |

## C. Measurement

| # | Requirement | Acceptance |
|---|---|---|
| C1 | Events (all in the existing log; reserved `answer` scenes, since the table's kinds are fixed): `_scan` (join page loaded), `_beat` (every 30 s while visible), `_cta` {target}, `_name` | T: each is accepted and doesn't touch quiz answers |
| C2 | `/api/impact?run=<id>` (presenter): scanned → joined → present at minutes 0/15/30/45/60 (churn curve) → answered/present per poll → learning before/after (the average question asked twice) → concept mastery → CTA clicks → follow-through → reconnection rate | T: a scripted run produces the funnel |
| C3 | Churn rate = joined phones with no beat in the last 10 min of the run, over joined | T |
| C4 | PostHog: if `POSTHOG_KEY` is set, phones send `scan, join, rejoin, step_view, answer {right, ms}, vote, name_set (no name), cta_click {target}, eyes_up, leave`; distinct id = the phone id; never a name, never an IP | T: /api/config omits the key when unset; C |
| C5 | Console shows the run report | C |

## D. The brief's remaining items

| # | Requirement | Acceptance |
|---|---|---|
| D1 (R1) | The big screen reads like a presentation: content centred in a 16:9 safe area, a thin header | C |
| D2 (R2) | A case is told as a sentence (its `happened`), never a bare "who · what" | T: case lines render `happened` |
| D3 (R3) | The hook is something they see: green dashboard tiles beside a phone stuck on "Sending… 4.8 s" | C |
| D4 (R7) | Signals fits 60 minutes with a 4-minute buffer: deep-dives move to the library | T: Signals' spine sums to 56 |
| D5 (R9) | Ending: one primary CTA (Follow on LinkedIn), two secondary (Star Interlace on GitHub, the dev.to series), "Talk to me" and a one-tap "What should Step 2 cover?" poll | T: the outro carries them; CTA clicks are counted (C1) |
| D6 | Learning check: the average question asked again near the end | T: the before/after appears in C2 |

## Decisions (defaults in bold)

1. Names: **anonymous** by default; named is opt-in per session.
2. Show voters: **off** by default.
3. Primary follow target: **Ofri on LinkedIn**.
4. Points: **500 + 500 × time left**.
5. TTL for rejoin: **3 hours**.
6. PostHog: **off until `POSTHOG_KEY` is set** in Vercel (the personal project, never the employer's).
