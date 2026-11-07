# Signals (Step 1): 60-minute product brief

**Who's in the room:** developers, junior to senior. They came to learn something they can use on Monday, have fun doing it, and leave knowing who taught it.

**What a good session means:** they can answer four business questions with metrics, logs and traces. Most of them stay all 60 minutes. Most answer every poll. Some follow, star or reach out afterwards.

## Requirements

| # | Requirement | Today | Change |
|---|---|---|---|
| R1 | The big screen reads like a presentation | Content sits top-left under a heavy header | Centre each slide in a 16:9 safe area. Shrink the header to a thin bar with the join code. Show the big QR only on join slides |
| R2 | Every line makes sense to someone who missed the setup | "CASE Google, 2009 · Small search delays cut searches" | No bare labels. Tell it as a sentence: "Google once slowed search by under half a second. People searched less for weeks." |
| R3 | The hook is something they *see* | Text only | A dashboard with all tiles green (avg latency 120 ms ✓, errors 0.1% ✓, CPU 40% ✓) beside a phone stuck on "Sending… 4.8 s". Caption: "Your dashboards are green. Users still wait." |
| R4 | They know where this session sits | "Start workshop 1, 2, 3, 4" | "This is a 4-step series. Today is Step 1: Signals, 60 minutes." Show the four steps as a row, with today highlighted |
| R5 | The opening promises value, not cases | Real cases on the first slide | Three columns. **You'll be able to answer:** Are users OK right now? Which user had a bad time, and why? Where did the time go in one slow request? What broke, and what do we tell customers? **Concepts:** the three signals (metrics, logs, traces); the tail (p95) vs the average. **Terms:** metric, log, trace, p95, histogram, structured log, span, trace id |
| R6 | The presenter drives the room | Next/prev already moves every phone. Reveal (R) already closes a poll early on the current majority | Add **Eyes up (E)**: every phone shows "Look at the screen" and pauses input until it's toggled off. Add **Close & continue (Enter)**: reveal, hold 3 s, then next, so the room never waits on stragglers |
| R7 | It fits 60 minutes | 29 scenes, exactly 60:00, no buffer | The 20-scene agenda below, with a 4-minute buffer |
| R8 | Analytics: learning, engagement, churn | Per-question right/total and follow-up exist | See *Measurement* below |
| R9 | A good ending with clear CTAs | Outro with links | One primary CTA plus two secondary, and a "talk to me" path (below) |
| R10 | The speaker intro matches the brand | Hand-typed lines | Done in #1: lines come from the brand file |

## Agenda (60 min)

| Min | Part | Scenes (what the room does) |
|---|---|---|
| 0–5 | Welcome | Series + today's promise (R4, R5) 2 · Hook: green dashboard, waiting user (R3) 2 · Who I am 1 |
| 5–10 | Feel it | Join and send messages to Dana 3 · "How did sending feel?" 2 |
| 10–21 | Metrics: *Are users OK?* | Your counter climbs 3 · The room's p95 3 · "98 took 50 ms, 2 took 5 s. The average?" 2 · Find your slowest dot 3 |
| 21–30 | Logs: *Who exactly?* | Find your slowest line 3 · The room's slowest: filter by id 3 · Poll 2 · (one-line analogy, no separate slide) 1 |
| 30–40 | Traces: *Where did the time go?* | Your message as a trace 3 · The time nobody owns 3 · Your phone measured this 2 · Poll 2 |
| 40–50 | The outage: *What broke?* | Relay breaks live 3 · "Where do you look first?" 2 · What the metrics saw 2 · "What do we tell users?" 3 |
| 50–56 | Wrap up | Re-ask the average question (learning check) 1 · Pick one thing for Monday 1 · Q&A 3 · CTAs 1 |
| 56–60 | Buffer | Overruns, or one detour if the room asks |

**Off the spine, as presenter-chosen detours:** car dashboard, "least to record", histogram, impact maths, bank statement, log road, span parts, propagation, exemplars, the case vote. They stay in the library for longer sessions and senior-heavy rooms.

## Measurement

Events go into the existing event log. One report per run, at `/impact?run=`.

| Signal | Event | Report |
|---|---|---|
| Reach | `scan`: the join page loads, before a code is entered | scanned |
| Join | `join` (exists) | joined / scanned |
| Presence | `beat` every 30 s while the page is visible | present at minutes 0, 15, 30, 45 and 60: the churn curve |
| Engagement | `answer` (exists) | answered / present, per poll |
| Learning | `answer` on questions with a right answer (exists) | % right per question; the average question asked at minute 12 and again at 50, as the before/after |
| Conversion | `cta`: {target} on every outro and recap link | clicks per target / finished |
| Follow-through | `followup` (exists) | did / picked |

Count only devices, never names, so the phone page stays anonymous.

## Ending and CTAs

- **Primary:** Follow on LinkedIn. One big button, plus the QR on the screen.
- **Secondary:** Star Interlace on GitHub · Read the dev.to series.
- **Talk to me:** "Stuck on something at work? Ask me after, or message me on LinkedIn." Plus a one-tap "What should Step 2 cover?" poll, which feeds the next session.
- **Recap:** each phone keeps its own results, the terms and the Monday pick, with links back.

## Open decisions (defaults in bold)

1. Primary follow target: **Ofri on LinkedIn**, or the Interlace OSS page.
2. "Talk to me": **LinkedIn message**, or a booking link (none exists yet).
3. Ask the before/after learning question twice: **yes** (costs 1 minute).
