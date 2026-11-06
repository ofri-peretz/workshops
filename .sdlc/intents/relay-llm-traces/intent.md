# Intent — `Relay's assistant: an LLM session, traced`

**Status:** proposed (intent only) · **Opened:** `2026-10-26` · **Owner:** `@ofri-peretz`

---

## What is wanted

The third track of the series, **AI / LLM**, as its own 30-minute workshop. Relay gets an
assistant that suggests replies to Dana. Every suggestion is a model call, and each attendee sees
their own call as a trace: time to first token, tokens per second, input and output tokens, cost,
a tool call, and a retry after a rate limit. The projector compares the room's calls the way
platform dashboards do for teams that use LLMs through API keys.

## Why now

- Ofri, 2026-10-26: "split it into Backend, Frontend and AI/LLM sessions traces which companies
  such as openai, anthropic, vercel offer for people using their LLMs through API keys … 3
  different workshops, but we can present on the beginning of each one that we have all 3."
- Backend (Workshops 1–4, Relay 4.1) and Frontend (`relay-browser-perf`) are in place or
  specified; AI/LLM has nothing yet. Every intro already shows it as "Coming next".
- Track D's D1 "Observability for LLM features" is in the catalog with no material behind it.

## Affected users and systems

- A new assistant feature in Relay (phone and projector), and its spans in `handler.mjs` and
  `core.mjs`.
- OpenTelemetry GenAI semantic conventions (`gen_ai.*` attributes) for span names and attributes.
- The series in `workshops.mjs`, the scene library, concepts and glossary.

## Constraints

- No API key in the room by default: the model is simulated with measured, realistic behavior
  (time to first token, streaming rate, token counts from the real prompt text, 429 then retry).
  The presenter can switch one call to a real provider, with the key only in Vercel's
  environment.
- Vendor features are described only after they are checked against the vendors' own docs on the
  day the spec is written, with the date. Nothing is claimed from memory.
- No prompt or completion text from attendees is stored. Attendees pick preset messages, as in
  the rest of Relay.
- 30 minutes net; the concepts and terms go through `concepts.mjs`, and the existing checks apply.

## Success criteria (to refine in the spec)

- Each phone shows its own assistant call as a trace with tokens, cost and time to first token.
- The projector shows the room's p50/p99 time to first token and the cost of the session.
- A forced rate limit shows up as a retry span; a tool call shows up as a child span.

## Open questions

- **Real provider or simulated:** [simulated by default; one live call optional.]
- **Which vendor views to show:** OpenAI, Anthropic and Vercel. [Check each one's current trace,
  log and usage views before the spec; show the concepts on Relay and one screenshot per vendor.]
- **Catalog slot:** [D1 in Track D.]
