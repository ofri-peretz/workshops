// Workshops are paths through the scene library: a spine of scene ids with forks. At a fork the room
// votes between detours of exactly the slot's length, so every path fits the workshop (30 minutes unless it sets `minutes`; self-checked).
// `after` lists the spine scenes a detour goes deeper on: their "Go deeper" taps order the options.
// Longer formats (half-day, full day) are longer spines over the same library.

const fork = (id, detours, dflt = 0) => ({ fork: id, slot: 3, title: "What next? You choose.", detours, default: dflt });

// Every intro shows the series: three tracks on performance you can see, the current one marked.
export const SERIES = [
  { track: "1 · Signals", what: "Metrics, logs and traces: what each one is, how it works, and how to use them in an outage", status: "Today", w: [5] },
  { track: "2 · API performance", what: "Latency the way users feel it, percentiles, N+1 and unselective queries, GraphQL, load tests", status: "Next", w: [1, 3] },
  { track: "3 · Web performance", what: "What the browser felt: LCP, INP and CLS at the room's p75", status: "Coming", w: [] },
  { track: "4 · Before users notice", what: "SLOs and the nines, error budgets, alerts on what users feel, status pages", status: "Coming", w: [2] },
];

export const WORKSHOPS = {
  5: {
    title: "Signals — metrics, logs and traces, live",
    minutes: 60,
    promise: "In 60 minutes: run metrics, logs and traces on your own phone, then use all three to find a live outage.",
    spine: ["intro", "join", "felt", "signals",
      "sig-metrics", "two", "dots", "mean", "histogram", "impact",
      "sig-logs",
      "yourtrace", "spanparts", "gap", "propagate", "browser",
      "outage", "first", "update", "spike", "exemplar",
      "sig-monday", "next4", "qa"],
  },
  1: {
    title: "Relay is slow — feel it, measure it",
    promise: "In 30 minutes: feel latency on your own phone, measure it the way SRE teams do, and set a target you can defend.",
    spine: ["intro", "join", "felt", "timeout", "journey", "two", "mean", "dots",
      fork("w1", [
        { title: "The tail reaches everyone", scenes: ["fanout", "histogram"], after: ["dots", "mean"] },
        { title: "What a slow tail costs", scenes: ["again", "impact"], after: ["felt", "journey"] },
        { title: "Numbers the business and every tool understand", scenes: ["business", "roadmap", "names"], after: ["timeout", "two"] },
      ]),
      "requests", "aws", "nines", "slo", "monday1", "next1", "qa"],
  },
  2: {
    title: "Relay breaks — find it, prove it",
    promise: "In 30 minutes: break Relay live, find the failure with status pages, metrics and traces, and prove it with a load test from your phones.",
    spine: ["intro", "join2", "two2", "outage", "first", "update", "spike", "signals", "gantt",
      fork("w2", [
        { title: "GraphQL: 200 OK with errors inside", scenes: ["graphql"], after: ["first", "update", "spike"] },
        { title: "Inside one GraphQL request", scenes: ["phases", "n1"], after: ["gantt", "signals"] },
        { title: "Your own service, live", scenes: ["flagship"], after: ["spike", "two2"] },
      ]),
      "closed", "open", "monday", "qa"],
  },
  3: {
    title: "GraphQL measured — per operation, per consumer",
    promise: "In 30 minutes: see why one endpoint hides every slow query, measure GraphQL per operation and per consumer, and load-test the real mix.",
    spine: ["intro", "join", "two2", "blend", "operation", "graphql", "errors", "phases", "gantt",
      fork("w3", [
        { title: "Count the calls, measure the cost", scenes: ["n1", "cost"], after: ["gantt", "phases"] },
        { title: "Who's calling? Per consumer, by name", scenes: ["perconsumer", "names"], after: ["operation", "blend"] },
        { title: "Your own service, live", scenes: ["flagship"], after: ["graphql", "errors"] },
      ]),
      "loadop", "open", "monday3", "qa"],
  },
  4: {
    title: "Follow one request — traces and spans",
    promise: "In 30 minutes: see your own message as a trace, read every span in it, find the time nobody owns and fix it live, and keep the traces that matter.",
    spine: ["intro", "join", "journey", "signals", "yourtrace", "spanparts", "propagate", "gap", "sampling", "exemplar",
      fork("w4", [
        { title: "Inside one GraphQL request", scenes: ["phases", "n1"], after: ["gap", "yourtrace"] },
        { title: "When a span fails", scenes: ["spanerror"], after: ["spanparts", "sampling"] },
        { title: "Your own service, live", scenes: ["flagship"], after: ["propagate", "exemplar"] },
      ]),
      "browser", "monday4", "next4", "qa"],
  },
};
