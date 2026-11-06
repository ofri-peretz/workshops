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
- [`console/`](console/): the presenter's console (Next.js, Interlace DS), run on the presenter's laptop.
- [`.sdlc/intents/`](.sdlc/intents/): what each change is for and how it was designed.

## Run a workshop

1. `cd console && cp .env.example .env.local`, fill it in, then `npm install && npm run dev`.
2. Open http://localhost:4180, email yourself a sign-in link, open it on the same computer.
3. **Go live**: the room opens for 2 hours with a join code good for 60 minutes. Open the big
   screen (HDMI); the room scans the QR.
4. **Close the room** when you're done. Every phone is out at once.

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
