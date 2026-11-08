# Workshops

Hands-on workshops on monitoring and performance by [Ofri Peretz](https://ofriperetz.dev). The room
learns by doing: everyone scans one QR code, runs each demo on their own phone, then we look at
the whole room's data together on the big screen.

## The series

| #   | Workshop                | What you'll be able to do                                          |
| --- | ----------------------- | ------------------------------------------------------------------ |
| 1   | **Signals**             | Tell metrics, logs and traces apart, and use all three in an outage |
| 2   | **API performance**     | Measure latency the way users feel it; find N+1 and unselective queries |
| 3   | **Web performance**     | Read what the browser felt: LCP, INP, CLS at p75                   |
| 4   | **Before users notice** | Set SLOs, spend error budgets, alert on what users feel            |

## Addresses

Every address follows `[part].[workshop].workshop.ofriperetz.dev`. The workshop's slug is its
series name (`signals` is workshop 1, named after OpenTelemetry's word for metrics, logs and
traces). Parts are rooms inside one workshop. One Vercel project, `workshop` (in `relay/`), serves
them all; DNS is A records to Vercel at the registrar.

| Address                                    | What it is                                        | Open           |
| ------------------------------------------ | ------------------------------------------------- | -------------- |
| `workshop.ofriperetz.dev`                  | The series and the presenter's links             | Always         |
| `signals.workshop.ofriperetz.dev`          | Signals: the one QR, phones join here             | While live     |
| `screen.signals.workshop.ofriperetz.dev`   | Signals: the big screen                           | Presenter only |
| `metrics.signals.workshop.ofriperetz.dev`  | Signals: metrics                                  | While live     |
| `logs.signals.workshop.ofriperetz.dev`     | Signals: logs                                     | While live     |
| `traces.signals.workshop.ofriperetz.dev`   | Signals: traces                                   | While live     |
| `incident.signals.workshop.ofriperetz.dev` | Signals: the live outage                          | While live     |
| `chat.`, `screen.`, `status.workshop.ofriperetz.dev` | Older Relay editions; retire when workshops 2–4 get their slugs | While live |

"While live" means the presenter opened the room from the console; otherwise the address answers
403. The console lives at `console.workshop.ofriperetz.dev` (Vercel project `workshop-console`, also `workshop-console-two.vercel.app`); only the owner's email can sign in. It also runs locally at `localhost:4180`.

## What's here

- [`relay/`](relay/): Relay, the chat app every demo measures. Phones, big screen, status page.
- [`console/`](console/): the presenter's console (Next.js, Interlace DS), on Vercel or the presenter's laptop.
- [`.sdlc/intents/`](.sdlc/intents/): what each change is for and how it was designed.
- [`docs/storytelling.md`](docs/storytelling.md): how headlines and taglines are written (checked by the tests).

## Run a workshop

1. `cd console && cp .env.example .env.local`, fill it in, then `npm install && npm run dev`.
2. Open http://localhost:4180, email yourself a sign-in link, open it on the same computer.
3. **Go live**: the room opens for 2 hours with a join code good for 60 minutes. Open the big
   screen (HDMI); the room scans the QR.
4. **Begin** in the console when the room is in: phones wait on "Starting soon" until then.
5. **Close the room** when you're done. Every phone is out at once.

**Compose** builds a session from chapters of any workshop (up to 3 hours). Type the group's name
and the console remembers which chapters it has seen, in `console/.groups.json` on your laptop
only. **Impact** counts the phones that picked one thing to do this week and, from the follow-up
link a week later, how many did it. After the session each phone keeps a recap link at
`workshop.ofriperetz.dev/recap`.

The hosted room is closed unless the console opened it. Phones need the code; 5 wrong tries per
network or 30 across the room stop guessing.

## Run Relay alone, locally

```bash
npm run relay        # http://localhost:8080 — phones at /, big screen at /screen
npm test             # self-checks, plus the scrub that keeps secrets out of this repo
```

Secrets (Supabase service key, PostHog and Vercel tokens, the presenter's email) live only in
environment variables. Never commit an `.env` file; `scripts/scrub.mjs` and the pre-commit hook
refuse it.

## License

Code: [MIT](LICENSE). Workshop content (scenes, concepts, specs): [CC BY 4.0](LICENSE-CONTENT).
