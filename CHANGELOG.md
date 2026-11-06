# Changelog

## 5.0 — 2026-11-06

- **Signals**, workshop 1 of the monitoring and performance series (60 min, no forks): feel it,
  metrics, logs, traces, a live outage, three questions for Monday. Two new live demos driven by
  the room's own messages: **Metrics** (counter, gauge, histogram with p95 exact vs from buckets,
  and Relay's real `/api/metrics` in Prometheus text) and **Logs** (structured lines with client
  and trace id; each phone finds its own slowest line).
- **The room is closed unless the presenter opened it.** Join code (QR or typed), 5 wrong tries
  per network, 30 room-wide locks joining, code expiry, Close. Access in Supabase behind two
  functions; owner-only RLS.
- **Presenter console** (`console/`, Next.js on the Interlace DS), run on the presenter's laptop:
  sign in by emailed link, Go live, code + QR, big screen, rehearsal, Close.
- Public repo with fresh history; `scripts/scrub.mjs` and push protection keep secrets and
  private names out.

Earlier editions (1.x–4.1) were built privately; their concepts are all still in
`relay/concepts.mjs`.
