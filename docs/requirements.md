# Workshop requirements

The product requirements for the workshops, as the presenter set them. Each line says whether it's
built (✅), partly built (◐) or still open (☐). Change this file when a requirement changes.

## Running a workshop

- ✅ The admin (console, on the presenter's laptop) holds a bank of workshops and chooses which one
  everyone sees. Workshops are labelled with their part of the series. Compose builds a session from
  chapters of any workshop.
- ✅ The big screen and every phone follow the presenter. Next pushes to all phones at once
  (Server-Sent Events, `/api/stream`); a 1.5 s check-in is the fallback; a phone that loses its
  session rejoins with its saved code. A live dot shows the connection (amber while reconnecting).
- ✅ 30–50 phones on one hosted app (Vercel + Supabase). No phone ever scans more than one QR.
- ✅ The presenter can end any vote at any time (R); the majority wins. Every choice shows
  "N of M chose", so the presenter sees who hasn't chosen.
- ✅ Keyboard shortcuts on the big screen (`?` lists them). The control bar hides when the mouse rests.
- ✅ Every step has a deep link: the address shows it (`#<step>`); `/screen?t=…&go=<step>` jumps there. A stale tab never moves the room.
- ✅ Environments: on localhost the screen shows localhost; through `npm run tunnel` (practice with
  real phones over a Cloudflare tunnel) the tunnel; anywhere else the real domain. Recap and
  follow-up links use the address the phone came in on.
- ✅ Workshop switching lives only in the admin; the big screen has no "start workshop" buttons.

## The arc of every workshop

1. ✅ **Who I am:** the presenter's photo, name, one line and highlights (tech version on phones).
2. ✅ **The series:** one slide, four cards that animate in, each saying what that part is about;
   today's part is highlighted. This is the only place the series position appears.
3. ✅ **What we'll cover today:** the parts as a path; each part has a short hook (what you'll do) and
   plain term chips (latency, percentile, uptime, error rate, SLO), never jargon such as p95.
4. ✅ **Scan to join:** the one and only QR of the workshop, with a live "N joined" count.
5. ✅ **Hands-on chapters,** each told the same way: a question, a hook, the room trying it on their
   phones, a real case, one line to remember on its last slide, its key terms.
   - ✅ Every hands-on step has a countdown on the big screen and every phone.
   - ✅ **Why it matters** comes right after the room's first hands-on moment, not at the start.
6. ✅ **Business use cases:** cards with live votes; the room picks which one to take apart; Reveal
   tells it in three beats (what happened, why, the lesson).
7. ✅ **Monday:** each phone picks one thing to do this week; a week later a signed link asks "did you?".
8. ✅ **Questions:** shows how the room learned (% right per question).
9. ✅ **Outro:** "Now you can answer" (three business questions), the next part as a tease, and
   follow, track, review: LinkedIn, dev.to, GitHub, the blog, the recap.

## Content

- ✅ Few words per slide, one idea per slide (docs/storytelling.md, enforced by relay/test.mjs).
- ✅ Junior to senior: plain words first; jargon taught inside the demo.
- ✅ Latency explained with percentiles ("what the slowest 5% waited"); uptime, error rate and SLO in
  the outage.
- ✅ Logs and traces shown as a road on each phone: your own message's log line (and its spans)
  travelling written → shipped → stored → searchable, with the room's counts on the big screen.
- ✅ A case bank (relay/cases.mjs) of real, verified, safe-to-say cases: company, government,
  research; recent and older; each with its source. The room chooses among them.
- ✗ Cases from the presenter's own workplace: dropped (Ofri, 2026-11-08). The workshops use
  public, sourced cases only; the employer is never named, not even in the presenter's title.
- ◐ Recent research on performance and revenue (Vodafone 2021, Rakuten 2022, Bing 2014, New Relic
  2025, Splunk 2026, Uptime Institute 2025, DORA 2024) is verified but not on slides yet.

## Look and feel

- ✅ Interlace design, dark theme, responsive: phone first, works on a laptop and a TV.
- ✅ The audience app looks modern: glass header, bold type, chips, soft cards, a gentle entrance per
  step, a pressed state, a light tap on lock-in, progress bar, countdown and score.
- ✅ Gentle animation only: once per slide, never looping, off for reduced motion.
- ✅ The presenter's photo on the intro, waiting page and home page; brand logos on the link buttons.

## The game (spec: .sdlc/intents/relay-engagement)

- ✅ Anonymous or named per session (console); named phones give a first name; the presenter can show
  who voted what (big screen only).
- ✅ Points like a quiz (right + fast), a top-5 leaderboard after each reveal, each phone's points and
  rank; Eyes up (E) pauses phones; Close & continue (Enter) reveals, holds 3 s, moves on.
- ✅ A returning phone is offered its last session for 3 hours; device marks give a reconnection rate.
- ◐ PostHog: wired on phones (scan, join, rejoin, step_view, answer, vote, cta_click, leave), off until
  `POSTHOG_KEY` is set in the Vercel project.

## Data and learning

- ✅ Every answer is stored; the room's learning curve, each person's score, the hardest questions
  across sessions (console), picks and follow-through (console Impact).
- ✅ A recap page per session at workshop.ofriperetz.dev/recap.
- ✅ A run report per session (console): scanned, joined, presence over time, churn, reconnection,
  answered per poll, learning before/after (the average question asked twice), weakest concepts,
  clicks.

## Constraints

- No IDF unit or system names; nothing tying the presenter to reserve duty; English only.
- No secrets in the repo; the personal Vercel account only.
- No material from the presenter's employer, and the employer is never named (Ofri, 2026-11-08).
