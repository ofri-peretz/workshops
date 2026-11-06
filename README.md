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

## What's here

- [`relay/`](relay/): Relay, the chat app every demo measures. Phones, big screen, status page.
- `console/`: the presenter's console, run on the presenter's laptop (coming with Signals).
- [`.sdlc/intents/`](.sdlc/intents/): what each change is for and how it was designed.

## Run it locally

```bash
npm run relay        # http://localhost:8080 — phones at /, big screen at /screen
npm test             # self-checks, plus the scrub that keeps secrets out of this repo
```

Secrets (Supabase service key, PostHog and Vercel tokens, the presenter's email) live only in
environment variables. Never commit an `.env` file; `scripts/scrub.mjs` and the pre-commit hook
refuse it.

## License

Code: [MIT](LICENSE). Workshop content (scenes, concepts, specs): [CC BY 4.0](LICENSE-CONTENT).
