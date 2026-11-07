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

## Every workshop follows the same arc

1. **Who I am** (`intro`): the presenter for this audience, with the links.
2. **Why it matters** (`why`): one claim and one real number (`why` in `workshops.mjs`).
3. **What we'll cover** (`today`): the parts as questions, the key terms, the real cases.
4. **Hands-on chapters**: the room does it on their phones (below).
5. **Case studies** (`cases`): the room votes among real cases with different root causes, from
   the case bank (`relay/cases.mjs`); Reveal tells the winner in three beats: what happened, why,
   the lesson.
6. **Monday**: each phone picks one thing to do this week; a week later its link asks "did you?".
7. **Questions**, then the **outro** (`outro`): tease the next workshop, then follow, track and
   review: the series, your recap, the presenter's links. Leave it up while people leave.

Cases are real and verified against their primary source, safe to say (facts as the official
report states them; no blame, no politics, no casualties), and easy to explain in three beats.

## Every chapter is told the same way

A workshop is a list of chapters (`CHAPTERS` in `relay/workshops.mjs`). Each part chapter has:

1. **A question** it answers ("Who exactly?"), shown on Today and in the header.
2. **A hook:** it opens on a question, a case, or the room doing something on their phones.
3. **Hands on:** the room tries it on their phones, then sees the room's result together.
4. **Real cases:** at least one real, sourced case on its main line (company, year, what happened).
   A made-up story is allowed only labelled "Example".
5. **One line to remember,** 8 words at most, shown on its last scene.
6. **Up to 4 key terms,** each taught inside the chapter. They add up to Today's terms.

No scene runs longer than 3 minutes. `relay/test.mjs` checks all of it.

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
| Part               | A noun, then its question                     | 3 / 8     | Logs · Who exactly?                     |
| Case               | Who and when, then what happened              | 4 / 8     | AWS S3, 2017 · Its status page ran on S3 too |
| Everything else    | Speaker notes                                 | —         | —                                       |

Terms on "What we'll cover" are plain words a junior engineer already half-knows (latency, uptime,
error rate). Jargon such as p95 or traceparent is taught inside the demo, never promised up front.

Also: sentence case; digits for numbers; people before systems ("two people waited", not "tail
latency increased"); one idea per headline.

`relay/test.mjs` enforces the limits on every workshop's name and tagline, the series, and the
Signals path. When another workshop's scenes are rewritten, add its path to the check.
