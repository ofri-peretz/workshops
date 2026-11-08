// Workshops are paths through the scene library: a spine of scene ids with forks. At a fork the room
// votes between detours of exactly the slot's length, so every path fits the workshop (30 minutes unless it sets `minutes`; self-checked).
// `after` lists the spine scenes a detour goes deeper on: their "Go deeper" taps order the options.
// Longer formats (half-day, full day) are longer spines over the same library.

const fork = (id, detours, dflt = 0) => ({ fork: id, slot: 3, title: "What next? You choose.", detours, default: dflt });

// Every intro shows the series: three tracks on performance you can see, the current one marked.
export const SERIES = [
  { track: "1 · Signals", what: "See what your users feel", status: "Today", w: [5] },
  { track: "2 · API performance", what: "Find the query behind the slow tail", status: "Next", w: [1, 3] },
  { track: "3 · Web performance", what: "Fast on the phone in their hand", status: "Coming", w: [] },
  { track: "4 · Before users notice", what: "Hear it break before users do", status: "Coming", w: [2] },
];

// A chapter is one part of a workshop, told the same way every time: a question; a hook (it opens on a
// question, a case, or the room doing something); the room trying it on their phones; a real case;
// and one line to remember, shown on its last scene. "What we'll cover" lists each part's concept, its key
// terms, and the business question (`asks`) the concept answers. Its key terms add up to "Today". Scenes run in
// order (forks included), so a chapter has its own minutes. A chapter with a question is a part on "Today" and names the scenes' header; one
// without (the bookends) isn't listed. Workshops are lists of chapters; the console can compose any
// list (core.mjs validates it), so a chapter is the unit you mix, reorder and remember per group.
export const CHAPTERS = {
  // The host is on the waiting screen while he talks; Begin opens on what we'll cover, then why it
  // matters. The "intro" slide stays in the library for a stage without a waiting screen.
  welcome: { name: "Welcome", scenes: ["intro", "series", "today", "scan"] }, // who I am, the series, today, the one QR

  "sig-feel": { name: "Feel it", q: "Who's waiting?", hook: "Feel six different waits", concept: "What users actually feel", asks: "How many customers are waiting right now?", remember: "Dashboards say fine. Users still wait", terms: ["latency", "uptime"], scenes: ["join", "felt", "why", "step-request", "sig-basics", "step-signals"] },
  "sig-metrics": { name: "Metrics", q: "Are users OK?", hook: "One number says something's wrong", concept: "Percentiles, not averages", asks: "Are we keeping our promise to customers?", remember: "Watch the p95, not the average", terms: ["latency", "percentile"], scenes: ["step-metric", "sig-metrics", "mean", "step-percentile", "p95-guess", "sig-spread", "sig-histogram", "sig-metrics-room"] }, // dashboard, least-to-record, histogram, impact: library detours
  "sig-logs": { name: "Logs", q: "Who exactly?", hook: "Find your message, then follow it", concept: "One id on every line", asks: "What happened to this customer's request?", remember: "Every log line carries a trace id", terms: ["structured log", "log shipper"], scenes: ["step-log", "step-anatomy", "step-severity", "sev-quiz", "sig-logs", "step-stdout", "step-ship", "step-async", "sig-road", "step-cost", "step-habits"] }, // the bank-statement slide is a library detour
  "sig-traces": { name: "Traces", q: "Where did the time go?", hook: "See where the time went", concept: "Where one request's time went", asks: "Which team owns this slowdown?", remember: "If time has no span, nobody owns it", terms: ["trace", "span", "OpenTelemetry"], scenes: ["step-journey", "step-span", "yourtrace", "step-code", "gap", "propagate", "sig-otel", "sig-trace-road"] },
  "sig-outage": { name: "The outage", q: "What broke?", hook: "Break it live, then fix it", concept: "Signals together in an outage", asks: "What broke, for whom, and since when?", remember: "Metrics say that, logs who, traces where", terms: ["SLO", "uptime", "error rate"], scenes: ["outage", "first", "step-slo", "spike"] },
  "sig-close": { name: "Wrap up", scenes: ["mean-again", "cases", "sig-monday", "qa", "outro"] },

  "slow-feel": { name: "Feel it", q: "Who's waiting?", hook: "Feel the wait, then the timeout", concept: "Waits and timeouts", asks: "When does slow become broken for customers?", remember: "A late answer is a failed one", terms: ["latency", "timeout"], scenes: ["join", "felt", "why", "timeout", "journey"] },
  "slow-measure": { name: "Measure it", q: "What do users feel?", hook: "Measure what users feel", concept: "The tail, not the average", asks: "How many customers had a bad experience today?", remember: "Measure the tail, not the average", terms: ["percentile", "p99"], scenes: ["two", "mean", "dots",
    fork("w1", [
      { title: "The tail reaches everyone", scenes: ["fanout", "histogram"], after: ["dots", "mean"] },
      { title: "What a slow tail costs", scenes: ["again", "impact"], after: ["felt", "journey"] },
      { title: "Numbers the business and every tool understand", scenes: ["business", "roadmap", "names"], after: ["timeout", "two"] },
    ]),
    "requests"] },
  "slow-promise": { name: "Promise it", q: "How fast, how often?", hook: "Write the promise you can keep", concept: "A target in one sentence", asks: "What can we promise, and what does it cost?", remember: "Promise what %, how fast, over how long", terms: ["SLA", "SLO", "error budget"], scenes: ["aws", "nines", "slo"] },
  "slow-close": { name: "Wrap up", scenes: ["cases", "monday1", "qa", "outro"] },

  "breaks-break": { name: "Break it", q: "What do users see?", hook: "Watch it break, tell users", concept: "Incidents users can see", asks: "What do customers see, and what do we tell them?", remember: "Tell users what they see, and when", terms: ["incident", "status page", "error rate"], scenes: ["join2", "why", "two2", "outage", "first", "update", "spike"] },
  "breaks-find": { name: "Find it", q: "Where did it break?", hook: "Find the broken step", concept: "Following the failure", asks: "Where exactly did it break?", remember: "Every gap is time nobody owns", terms: ["trace", "span"], scenes: ["signals", "gantt",
    fork("w2", [
      { title: "GraphQL: 200 OK with errors inside", scenes: ["graphql"], after: ["first", "update", "spike"] },
      { title: "Inside one GraphQL request", scenes: ["phases", "n1"], after: ["gantt", "signals"] },
      { title: "Your own service, live", scenes: ["flagship"], after: ["spike", "two2"] },
    ])] },
  "breaks-prove": { name: "Prove it", q: "Will the fix hold?", hook: "Prove the fix holds", concept: "Testing at real load", asks: "Will the fix hold on our busiest day?", remember: "Test at a fixed rate, not fixed users", terms: ["open model", "Little's Law"], scenes: ["closed", "open"] },
  "breaks-close": { name: "Wrap up", scenes: ["cases", "monday", "qa", "outro"] },

  "gql-endpoint": { name: "One endpoint", q: "What does a 200 hide?", hook: "See what one endpoint hides", concept: "The operation is the unit", asks: "Which customer-facing query is slow?", remember: "Measure the operation, not the endpoint", terms: ["GraphQL", "operation", "blended percentile", "parse"], scenes: ["join", "why", "two2", "blend", "operation", "graphql", "errors", "phases"] },
  "gql-find": { name: "Find it", q: "Which query is slow?", hook: "Count the hidden calls", concept: "Counting the calls", asks: "Why does this one screen cost so much?", remember: "Count the calls behind one request", terms: ["span"], scenes: ["gantt",
    fork("w3", [
      { title: "Count the calls, measure the cost", scenes: ["n1", "cost"], after: ["gantt", "phases"] },
      { title: "Who's calling? Per consumer, by name", scenes: ["perconsumer", "names"], after: ["operation", "blend"] },
      { title: "Your own service, live", scenes: ["flagship"], after: ["graphql", "errors"] },
    ])] },
  "gql-prove": { name: "Prove it", q: "Will it hold under load?", hook: "Load-test like production", concept: "Load like production", asks: "Will it hold when traffic doubles?", remember: "Load-test the real mix of operations", terms: ["open model"], scenes: ["loadop", "open"] },
  "gql-close": { name: "Wrap up", scenes: ["cases", "monday3", "qa", "outro"] },

  "follow-follow": { name: "Follow it", q: "Where did the time go?", hook: "Follow your own request", concept: "One request, end to end", asks: "Where did this customer's wait come from?", remember: "One trace id follows the request", terms: ["trace", "span", "root span", "traceparent"], scenes: ["join", "why", "journey", "signals", "yourtrace", "spanparts", "propagate"] },
  "follow-find": { name: "Find it", q: "Which span is slow?", hook: "Find the time nobody owns", concept: "Time nobody owns", asks: "Which team should fix this first?", remember: "Every gap is time nobody owns", terms: ["TTFB"], scenes: ["gap",
    fork("w4", [
      { title: "Inside one GraphQL request", scenes: ["phases", "n1"], after: ["gap", "yourtrace"] },
      { title: "When a span fails", scenes: ["spanerror"], after: ["spanparts", "sampling"] },
      { title: "Your own service, live", scenes: ["flagship"], after: ["propagate", "exemplar"] },
    ]),
    "browser"] },
  "follow-keep": { name: "Keep it", q: "Which traces do we keep?", hook: "Keep the traces that matter", concept: "Keeping the traces that matter", asks: "Can we find any slow request from a chart?", remember: "Keep the slow and failed traces", terms: ["sampling", "exemplar"], scenes: ["sampling", "exemplar"] },
  "follow-close": { name: "Wrap up", scenes: ["cases", "monday4", "qa", "outro"] },
};

// The spine and the parts follow from the chapters; nothing lists scenes twice.
export const spineOf = (chapters) => chapters.flatMap((c) => CHAPTERS[c].scenes);
export const partsOf = (chapters) => chapters.filter((c) => CHAPTERS[c].q).map((c) => [CHAPTERS[c].name, CHAPTERS[c].q]);
export const termsOf = (chapters) => [...new Set(chapters.flatMap((c) => CHAPTERS[c].terms ?? []))];
const workshop = (w) => ({ ...w, spine: spineOf(w.chapters), parts: partsOf(w.chapters), terms: termsOf(w.chapters) });

export const WORKSHOPS = {
  5: workshop({ why: { title: "Your dashboards are green. Users still wait", lead: "You just felt it: one app, six different waits.", case: "google-2009",
      abt: "Your service is up, and the dashboards are green, but users still wait, therefore we measure what they feel." },
    studies: ["cloudflare-2025", "au-census-2016", "roblox-2021", "911-2014"], title: "Signals", minutes: 60, buffer: 3, promise: "See what your users feel",
    answers: ["sig-metrics", "sig-traces", "sig-outage"], // the 3 business questions the close says you can now answer
    chapters: ["welcome", "sig-feel", "sig-metrics", "sig-logs", "sig-traces", "sig-outage", "sig-close"] }),
  1: workshop({ minutes: 34, why: { title: "Slow is the new down", lead: "Amazon promises its slowest 1 in 1,000, not its average.", case: "amazon-dynamo-2007",
      abt: "Relay answers, and most messages are fast, but some people wait seconds, therefore we turn the wait into a target." },
    studies: ["gcp-2025", "us-ui-2020", "azul-2013"], title: "Relay is slow", promise: "Turn a wait into a target",
    chapters: ["welcome", "slow-feel", "slow-measure", "slow-promise", "slow-close"] }),
  2: workshop({ minutes: 34, why: { title: "Everything breaks. Trust breaks on how you answer", lead: "Some Atlassian customers waited 14 days. Updates came late.", case: "atlassian-2022",
      abt: "Relay will fail, and users will notice first, but the fix starts with what you see and say, therefore we find it, say it, prove it." },
    studies: ["aws-dynamodb-dns-2025", "hawaii-2018", "knight-2012", "centurylink-2018"], title: "Relay breaks", promise: "Find the break, prove the fix",
    chapters: ["welcome", "breaks-break", "breaks-find", "breaks-prove", "breaks-close"] }),
  3: workshop({ minutes: 35, why: { title: "One endpoint hides every slow query", lead: "A GraphQL 200 OK can still carry errors.", case: "shopify-graphql-200",
      abt: "GraphQL gives one endpoint, and its numbers look fine, but each operation is its own service, therefore we measure per operation." },
    studies: ["cloudflare-2019", "irs-2018", "wrk2"], title: "GraphQL measured", promise: "One endpoint hides every slow query",
    chapters: ["welcome", "gql-endpoint", "gql-find", "gql-prove", "gql-close"] }),
  4: workshop({ minutes: 32, why: { title: "One slow request crosses five teams", lead: "Google traced its requests as trees of timed steps.", case: "dapper-2010",
      abt: "A request crosses many services, and each team sees only its part, but users feel the whole, therefore we follow one request end to end." },
    studies: ["state-dept-2023", "twitter-2018", "tail-at-scale-2013"], title: "Follow one request", promise: "Follow one request end to end",
    chapters: ["welcome", "follow-follow", "follow-find", "follow-keep", "follow-close"] }),
};
