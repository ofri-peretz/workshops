// Terms the Signals series adds beyond Relay 4.1's glossary, and where every term sits in the series.
export const EXTRA = {
  counter: {
    def: "A number that only goes up, until the process restarts. You read how fast it grows, not its value.",
    example: "relay_messages_total 1204; rate() over 1 min = 3.1 msg/s",
  },
  gauge: {
    def: "A number that goes up and down. You read its current value.",
    example: "Phones connected: 37. Free DB connections: 4.",
  },
  label: {
    def: "A key=value pair that splits one metric into several series.",
    example: 'http_requests_total{route="/send", status="503"}',
  },
  cardinality: {
    def: "How many series a metric has: one per combination of label values. Every label multiplies it.",
    example:
      "5 routes × 4 statuses × 50 clients = 1,000 series. Add user_id and it's millions.",
  },
  scrape: {
    def: "Prometheus pulling a service's /metrics page on a schedule (pull), instead of the service pushing numbers out.",
    example: "Every 15 s Prometheus GETs /actuator/prometheus.",
  },
  "structured log": {
    def: "A log line made of named fields (usually JSON) instead of free text, so a machine can filter and group it.",
    example:
      '{"level":"error","route":"/send","status":503,"ms":3012,"trace_id":"4bf92f…"}',
  },
  "request id": {
    def: "A unique id per request, written on every log line and returned to the caller, so one request can be found from a support ticket.",
    example: "X-Request-Id: 7f3a…",
  },
  "log level": {
    def: "How serious a line is: DEBUG, INFO, WARN, ERROR. Production usually keeps INFO and above; DEBUG costs money.",
    example: "WARN pool 90% used",
  },
  stdout: {
    def: "The process's standard output stream. In containers and serverless, apps write logs there and the platform ships them; the app doesn't manage files.",
    example: "console.log / System.out / a logback ConsoleAppender",
  },
  "log shipper": {
    def: "An agent that reads log streams or files and sends them to a store, adding metadata (pod, host, service).",
    example:
      "Fluent Bit, Fluentd, Filebeat, the CloudWatch agent, the OpenTelemetry Collector",
  },
  OpenTelemetry: {
    def: "The open standard (CNCF) for producing traces, metrics and logs: one API and SDK per language, one wire protocol, any backend. It merged OpenTracing and OpenCensus in 2019.",
    example: "Instrument once, send to Tempo, Jaeger, Datadog or CloudWatch.",
  },
  OTLP: {
    def: "The OpenTelemetry Protocol: how SDKs and collectors send traces, metrics and logs, over gRPC or HTTP.",
    example: "Port 4317 (gRPC), 4318 (HTTP)",
  },
  "OTel Collector": {
    def: "A standalone service that receives telemetry, processes it (batch, filter, sample, redact) and exports it to one or more backends.",
    example: "App → OTLP → Collector → Tempo + Prometheus + Loki",
  },
  "auto-instrumentation": {
    def: "An agent or library that creates spans and metrics for common frameworks without code changes.",
    example:
      "The OpenTelemetry Java agent: -javaagent:opentelemetry-javaagent.jar",
  },
  alert: {
    def: "A rule that notifies a person when a signal crosses a threshold for long enough. Good alerts fire on what users feel.",
    example: "Error rate > 5% for 5 minutes → page on-call",
  },
  index: {
    def: "A sorted structure the database keeps on one or more columns, so it can find rows without reading the whole table.",
    example: "CREATE INDEX ON messages (room_id, sent_at)",
  },
  selectivity: {
    def: "The share of rows a condition matches. A selective condition matches few rows, so an index on it pays off; an unselective one doesn't.",
    example:
      "user_id = 42 matches 0.001% (use the index); status = 'active' matches 90% (a full scan is cheaper)",
  },
  "full table scan": {
    def: "The database reads every row because no index helps, or because the condition matches most rows anyway.",
    example: "EXPLAIN shows Seq Scan / COLLSCAN",
  },
  "query plan": {
    def: "The steps the database chose for a query. EXPLAIN shows it: which index, how many rows read vs returned.",
    example: "rows examined 1,000,000 → returned 10: a selectivity problem",
  },
  "connection pool": {
    def: "A fixed set of open database connections shared by requests. When all are busy, requests wait, and that wait is invisible unless measured.",
    example: "HikariCP max 10; pending 37",
  },
  "Core Web Vitals": {
    def: "Google's three user-experience metrics for web pages: LCP, INP and CLS, judged at the 75th percentile of real visits.",
    example: "web.dev/vitals",
  },
  LCP: {
    def: "Largest Contentful Paint: when the largest visible element finished rendering. Good is 2.5 s or less.",
    example: "The hero image appeared at 3.1 s: needs improvement",
  },
  INP: {
    def: "Interaction to Next Paint: how long the page takes to visibly respond to taps, clicks and keys, near the worst of the visit. Good is 200 ms or less.",
    example: "Send button repainted after 480 ms: poor",
  },
  CLS: {
    def: "Cumulative Layout Shift: how much visible content moves unexpectedly. Good is 0.1 or less.",
    example: "An ad loads and pushes the button down",
  },
  p75: {
    def: "The value 75% of visits are at or under. Web vitals are judged at p75 of real visits.",
    example: "LCP p75 = 2.3 s: good",
  },
  RUM: {
    def: "Real user monitoring: measuring in real users' browsers (field data), as opposed to a lab test on one machine.",
    example: "The phones' own timings in Relay are RUM.",
  },
  "synthetic probe": {
    def: "A scheduled request from outside the service that checks it answers correctly. It measures uptime the service can't report about itself.",
    example: "Every minute, from 3 regions: GET /health → 200 in < 1 s",
  },
  "burn rate": {
    def: "How fast the error budget is being spent compared with the pace that would use it up exactly at the end of the window.",
    example: "Burn rate 14 for 1 hour = 2% of a 30-day budget gone",
  },
  "on-call": {
    def: "The person who gets paged when an alert fires and owns the first response.",
    example: "Rotates weekly; acknowledges within 5 minutes",
  },
};

// Older standards the audience may still run.
export const OLDER = [
  {
    name: "syslog",
    what: "The classic Unix log protocol and line format (RFC 3164, then RFC 5424).",
    now: "Still common on VMs and network gear; containers log to stdout instead.",
    spot: "/var/log/messages, port 514, <134>Oct 11 22:14:15 host app: …",
  },
  {
    name: "ELK / Elastic Stack",
    what: "Elasticsearch stores and searches logs, Logstash parses them, Kibana shows them; Beats (Filebeat) ship them.",
    now: "Widely used; OpenSearch is the open fork.",
    spot: "Kibana Discover, index patterns like logs-*",
  },
  {
    name: "Fluentd / Fluent Bit",
    what: "CNCF log shippers. Fluent Bit is the light one, often a DaemonSet on every Kubernetes node.",
    now: "Current. The OTel Collector can do the same job.",
    spot: "fluent-bit.conf, [INPUT] tail /var/log/containers/*.log",
  },
  {
    name: "StatsD",
    what: "Push metrics over UDP: counters, gauges, timers (Etsy, 2011). Fire-and-forget, so packets can drop.",
    now: "Legacy; Prometheus and OTel metrics replaced it in most new systems.",
    spot: "app.send.count:1|c on port 8125",
  },
  {
    name: "Graphite",
    what: "A time-series store with dotted metric names and no labels.",
    now: "Legacy; labels (Prometheus) replaced dotted names.",
    spot: "servers.web01.cpu.load",
  },
  {
    name: "JMX",
    what: "Java Management Extensions: the JVM exposes metrics as MBeans.",
    now: "Still inside every JVM; usually exported via Micrometer or the Prometheus JMX exporter.",
    spot: "jconsole, java.lang:type=Memory",
  },
  {
    name: "Micrometer",
    what: "The JVM metrics facade Spring Boot uses; one API, many backends (Prometheus, CloudWatch…). Micrometer Tracing replaced Spring Cloud Sleuth in Spring Boot 3.",
    now: "Current on the JVM; bridges to OpenTelemetry.",
    spot: "/actuator/prometheus, http_server_requests_seconds",
  },
  {
    name: "Prometheus format / OpenMetrics",
    what: "The text format a /metrics page uses; OpenMetrics is its standardized version.",
    now: "Current. OTel can export to it.",
    spot: "# TYPE http_requests_total counter",
  },
  {
    name: "Zipkin and B3",
    what: "An early open-source tracer (Twitter) and its propagation headers.",
    now: "Still seen; W3C traceparent is the standard (a W3C Recommendation since 2020).",
    spot: "X-B3-TraceId, X-B3-SpanId",
  },
  {
    name: "Jaeger",
    what: "A CNCF tracing backend from Uber. Its own client libraries are retired in favour of OpenTelemetry SDKs.",
    now: "The backend is current; it accepts OTLP.",
    spot: "uber-trace-id header, Jaeger UI",
  },
  {
    name: "OpenTracing / OpenCensus",
    what: "Two earlier open tracing/metrics APIs.",
    now: "Merged into OpenTelemetry in 2019; both are archived.",
    spot: "io.opentracing imports, opencensus packages",
  },
  {
    name: "AWS X-Ray",
    what: "AWS's tracing service with its own header and SDK.",
    now: "Current; also takes OTel through the AWS distro (ADOT).",
    spot: "X-Amzn-Trace-Id: Root=1-…",
  },
];

// Where each glossary term is taught in the series.
export const WORKSHOP_OF = {
  1: [
    "log",
    "metric",
    "trace",
    "span",
    "histogram",
    "mean",
    "percentile",
    "p50",
    "p95",
    "p99",
    "error rate",
    "trace id",
    "root span",
    "parent span",
    "attribute",
    "counter",
    "gauge",
    "label",
    "cardinality",
    "scrape",
    "structured log",
    "request id",
    "log level",
    "stdout",
    "log shipper",
    "OpenTelemetry",
    "OTLP",
    "OTel Collector",
    "auto-instrumentation",
    "alert",
  ],
  3: [
    "Resource Timing",
    "TTFB",
    "Core Web Vitals",
    "LCP",
    "INP",
    "CLS",
    "p75",
    "RUM",
  ],
  4: [
    "uptime",
    "SLA",
    "nines",
    "downtime",
    "SLI",
    "SLO",
    "error budget",
    "incident",
    "status page",
    "incident update",
    "affected requests",
    "synthetic probe",
    "burn rate",
    "on-call",
  ],
};
