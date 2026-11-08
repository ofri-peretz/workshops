# How the relay is specified

Four layers, each run by `npm run verify` and in CI:

| Layer | File | What it pins |
| --- | --- | --- |
| Behaviour model | [relay.qnt](relay.qnt) | The room's access rules as a Quint state machine: codes, Go live, New code, Sign everyone out, Close, when answers count. Invariants: the right code always gets in (shared venue Wi-Fi), an old code never does, a closed room admits nobody, no answer counts after the reveal, signed-out phones hold no session, the room locks only after enough wrong codes. `relayOldOrder` flips one rule back to the old order and the checker finds the venue lockout, so the invariants aren't hollow. |
| API contract | [../openapi.yaml](../openapi.yaml) | Every route, who may call it (phone session, presenter token, signed link), its body and every response. `relay/test.mjs` fails if the handler and the contract list different routes. Ready for `apicontract diff/check` once it ships. |
| Unit tests | [../core.test.mjs](../core.test.mjs) | The modelled rules in code: joining order and limits, term answers, scoring, leaderboard moves, nobody named on the screen. |
| Mutation score | [../../stryker.config.json](../../stryker.config.json) | oxmutate changes those exact lines (337 mutants) and the unit tests must notice: 89.6% today, CI breaks under 85%. The survivors left are the option-shuffle hash (any fixed order is correct) and a 1 ms boundary on expiry. |

The end-to-end layer is separate: `relay/test.mjs` (the whole relay over HTTP) and `e2e/` (Playwright, five widths). Load: `node scripts/load.mjs <relay> <code> 50 60`; on production, 50 phones: 0 errors, every presenter action delivered to every phone, check-in p95 270 ms.
