# Headlines and taglines

People read a slide in the second before they look back at you. So the screen carries a few words;
the explanation is spoken, from the speaker notes.

## The models

- **Assertion–evidence** (Michael Alley): a slide's headline is the takeaway, written as a claim.
  The evidence is the live demo on the room's phones, never a bullet list.
- **Question, then answer**: a poll opens on a question, which opens a curiosity gap. On reveal,
  the headline becomes the answer, as a claim. The relay swaps it (`takeaway` in `scenes.mjs`).
- **And, But, Therefore** (Randy Olson): each workshop's big idea, said out loud in the intro.
  Signals: _your service is up, **and** the dashboards are green, **but** users still wait,
  **therefore** we measure what they feel._
- **What is, what could be** (Nancy Duarte): open on a wait the room felt on its own phones, close
  on what they'll check on Monday.

## The rules

| Level              | Shape                                         | Max words | Example                                 |
| ------------------ | --------------------------------------------- | --------- | --------------------------------------- |
| Workshop name      | A noun people can repeat                      | 3         | Signals                                 |
| Tagline            | What the room gains, in their words; no period | 8         | See what your users feel                |
| Chapter            | A verb and "it"                               | 3         | Find it                                 |
| Demo headline      | What to do, or what's on the phone            | 10        | Find your slowest message               |
| Question headline  | One question, concrete numbers                | 10        | 98 took 50 ms, 2 took 5 s. The average? |
| Takeaway headline  | The answer as a claim; no period              | 8         | The average describes nobody            |
| Subline            | The evidence or the why, one sentence         | 12        | Two people waited 5 s, and it hid them  |
| Phone line, item   | One instruction or one check                  | 12 / 8    | Keep these three                        |
| Everything else    | Speaker notes                                 | —         | —                                       |

Also: sentence case; digits for numbers; people before systems ("two people waited", not "tail
latency increased"); one idea per headline.

`relay/test.mjs` enforces the limits on every workshop's name and tagline, the series, and the
Signals path. When another workshop's scenes are rewritten, add its path to the check.
