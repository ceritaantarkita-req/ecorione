"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./OpsDashboard.module.css";

type Counter = { name: string; labels: Record<string, string>; value: number };
type Histogram = {
  name: string;
  labels: Record<string, string>;
  count: number;
  p50: number;
  p95: number;
};
type ProcessResource = {
  pid: number;
  uptimeSeconds: number;
  rssBytes: number;
  heapUsedBytes: number;
  heapTotalBytes: number;
  externalBytes: number;
  arrayBuffersBytes: number;
  cpuUserMicros: number;
  cpuSystemMicros: number;
};
type Span = {
  traceId: string;
  service: string;
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
  startedAt: string;
};
type Service = {
  name: string;
  required: boolean;
  healthy: boolean;
  error: string | null;
  observability: null | {
    process: ProcessResource;
    counters: Counter[];
    histograms: Histogram[];
  };
};
type OpsResponse = {
  generatedAt: string;
  healthy: boolean;
  services: Service[];
  recentTraces: Array<{ traceId: string; spans: Span[] }>;
};

function sum(counters: Counter[], name: string): number {
  return counters
    .filter((counter) => counter.name === name)
    .reduce((n, counter) => n + counter.value, 0);
}
function latency(histograms: Histogram[]): { p50: number; p95: number } {
  const values = histograms.filter((item) => item.name === "ecorione_http_request_duration_ms");
  if (values.length === 0) return { p50: 0, p95: 0 };
  return {
    p50: Math.max(...values.map((item) => item.p50)),
    p95: Math.max(...values.map((item) => item.p95)),
  };
}
function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(4);
}
function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 MB";
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export default function OpsPage() {
  const [data, setData] = useState<OpsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [auto, setAuto] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const refreshInFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    setRefreshing(true);
    try {
      const response = await fetch("/api/ops", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
      setData((await response.json()) as OpsResponse);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      refreshInFlight.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!auto) return;
    const timer = window.setInterval(() => void refresh(), 5_000);
    return () => window.clearInterval(timer);
  }, [auto, refresh]);

  const totals = useMemo(() => {
    const counters =
      data?.services.flatMap((service) => service.observability?.counters ?? []) ?? [];
    const rssBytes =
      data?.services.reduce(
        (total, service) => total + (service.observability?.process.rssBytes ?? 0),
        0,
      ) ?? 0;
    return {
      requests: sum(counters, "ecorione_http_requests_total"),
      errors: sum(counters, "ecorione_http_errors_total"),
      modelCalls: sum(counters, "ecorione_model_calls_total"),
      inputTokens: sum(counters, "ecorione_model_input_tokens_total"),
      outputTokens: sum(counters, "ecorione_model_output_tokens_total"),
      costUsd: sum(counters, "ecorione_model_cost_usd_total"),
      mcpCalls: sum(counters, "ecorione_mcp_tool_calls_total"),
      flowRuns: sum(counters, "ecorione_flow_runs_total"),
      ecxPackets: sum(counters, "ecorione_ecx_packets_total"),
      ecxBytes: sum(counters, "ecorione_ecx_hydration_bytes_total"),
      rssBytes,
    };
  }, [data]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Runtime health & telemetry</h1>
          <p className={styles.subtle}>
            Process-lifetime operational metrics. Long-term retention belongs in an external
            scraper.
          </p>
        </div>
        <div className={styles.actions}>
          <label>
            <input
              type="checkbox"
              checked={auto}
              onChange={(event) => setAuto(event.target.checked)}
            />{" "}
            Auto 5s
          </label>
          <button type="button" disabled={refreshing} onClick={() => void refresh()}>
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      {error !== null ? (
        <p className={styles.error} role="alert">
          Ops fetch failed: {error}
        </p>
      ) : null}
      <section className={styles.summary} aria-busy={data === null || refreshing}>
        <div>
          <span>Fleet</span>
          <strong className={data === null ? undefined : data.healthy ? styles.ok : styles.bad}>
            {data === null ? "Loading" : data.healthy ? "Healthy" : "Degraded"}
          </strong>
        </div>
        <div>
          <span>Fleet RSS</span>
          <strong>{data === null ? "—" : formatBytes(totals.rssBytes)}</strong>
        </div>
        <div>
          <span>Requests</span>
          <strong>{data === null ? "—" : formatNumber(totals.requests)}</strong>
        </div>
        <div>
          <span>Errors</span>
          <strong>{data === null ? "—" : formatNumber(totals.errors)}</strong>
        </div>
        <div>
          <span>Model calls</span>
          <strong>{data === null ? "—" : formatNumber(totals.modelCalls)}</strong>
        </div>
        <div>
          <span>Tokens in / out</span>
          <strong>
            {data === null
              ? "—"
              : `${formatNumber(totals.inputTokens)} / ${formatNumber(totals.outputTokens)}`}
          </strong>
        </div>
        <div>
          <span>Model cost</span>
          <strong>{data === null ? "—" : `$${totals.costUsd.toFixed(6)}`}</strong>
        </div>
        <div>
          <span>MCP calls</span>
          <strong>{data === null ? "—" : formatNumber(totals.mcpCalls)}</strong>
        </div>
        <div>
          <span>Flow runs</span>
          <strong>{data === null ? "—" : formatNumber(totals.flowRuns)}</strong>
        </div>
        <div>
          <span>ECX packets</span>
          <strong>{data === null ? "—" : formatNumber(totals.ecxPackets)}</strong>
        </div>
        <div>
          <span>ECX hydrated bytes</span>
          <strong>{data === null ? "—" : formatNumber(totals.ecxBytes)}</strong>
        </div>
      </section>

      <section>
        <h2>Services</h2>
        <div className={styles.grid}>
          {data !== null && data.services.length === 0 ? (
            <p className={styles.empty}>
              No owner services were returned by the Ops aggregator.
            </p>
          ) : null}
          {(data?.services ?? []).map((service) => {
            const counters = service.observability?.counters ?? [];
            const requestCount = sum(counters, "ecorione_http_requests_total");
            const errorCount = sum(counters, "ecorione_http_errors_total");
            const timing = latency(service.observability?.histograms ?? []);
            const resources = service.observability?.process;
            const optionalDown = !service.healthy && !service.required;
            return (
              <article className={styles.card} key={service.name}>
                <div className={styles.cardTitle}>
                  <strong>{service.name}</strong>
                  <span
                    className={service.healthy ? styles.ok : optionalDown ? styles.subtle : styles.bad}
                  >
                    {service.healthy ? "UP" : optionalDown ? "OPTIONAL DOWN" : "DOWN"}
                  </span>
                </div>
                <dl>
                  <div>
                    <dt>requests</dt>
                    <dd>{formatNumber(requestCount)}</dd>
                  </div>
                  <div>
                    <dt>errors</dt>
                    <dd>{formatNumber(errorCount)}</dd>
                  </div>
                  <div>
                    <dt>p50</dt>
                    <dd>{timing.p50.toFixed(1)} ms</dd>
                  </div>
                  <div>
                    <dt>p95</dt>
                    <dd>{timing.p95.toFixed(1)} ms</dd>
                  </div>
                  <div>
                    <dt>RSS</dt>
                    <dd>{formatBytes(resources?.rssBytes ?? 0)}</dd>
                  </div>
                  <div>
                    <dt>heap</dt>
                    <dd>{formatBytes(resources?.heapUsedBytes ?? 0)}</dd>
                  </div>
                </dl>
                {service.error !== null ? (
                  <p className={styles.error}>{service.error}</p>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <section>
        <h2>Recent distributed traces</h2>
        <div className={styles.traces}>
          {data !== null && data.recentTraces.length === 0 ? (
            <p className={styles.empty}>
              No recent distributed traces in this process lifetime.
            </p>
          ) : null}
          {(data?.recentTraces ?? []).slice(0, 20).map((trace) => (
            <article className={styles.trace} key={trace.traceId}>
              <code>{trace.traceId}</code>
              <div>
                {trace.spans.map((span, index) => (
                  <span key={`${span.service}-${span.startedAt}-${String(index)}`}>
                    {span.service} {span.method} {span.route} · {span.statusCode} ·{" "}
                    {span.durationMs.toFixed(1)}ms
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer className={styles.footer}>
        Last snapshot: {data?.generatedAt ?? "—"}. ECX metrics are traffic facts, not a savings
        claim.
      </footer>
    </main>
  );
}
