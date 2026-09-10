import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";

export type MetricLabels = Readonly<Record<string, string>>;

export interface CounterSnapshot {
  readonly name: string;
  readonly labels: MetricLabels;
  readonly value: number;
}

export interface HistogramSnapshot {
  readonly name: string;
  readonly labels: MetricLabels;
  readonly count: number;
  readonly sum: number;
  readonly min: number;
  readonly max: number;
  readonly p50: number;
  readonly p95: number;
}

export interface RecentRequestSpan {
  readonly traceId: string;
  readonly spanId: string;
  readonly requestId: string;
  readonly service: string;
  readonly method: string;
  readonly route: string;
  readonly statusCode: number;
  readonly durationMs: number;
  readonly startedAt: string;
}

export interface OperationalSnapshot {
  readonly service: string;
  readonly generatedAt: string;
  readonly counters: readonly CounterSnapshot[];
  readonly histograms: readonly HistogramSnapshot[];
  readonly recentRequests: readonly RecentRequestSpan[];
}

interface HistogramSeries {
  readonly name: string;
  readonly labels: MetricLabels;
  readonly samples: number[];
  count: number;
  sum: number;
  min: number;
  max: number;
}

interface CounterSeries {
  readonly name: string;
  readonly labels: MetricLabels;
  value: number;
}

const MAX_SERIES = 2_048;
const MAX_HISTOGRAM_SAMPLES = 512;
const MAX_RECENT_REQUESTS = 256;

function normalizedLabels(labels: MetricLabels): MetricLabels {
  const result: Record<string, string> = {};
  for (const [key, raw] of Object.entries(labels).sort(([a], [b]) => a.localeCompare(b))) {
    const safeKey = key.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 64);
    const safeValue = raw.replace(/[\r\n\u0000-\u001f\u007f]/g, "_").slice(0, 128);
    result[safeKey] = safeValue;
  }
  return result;
}

function seriesKey(name: string, labels: MetricLabels): string {
  return `${name}|${JSON.stringify(normalizedLabels(labels))}`;
}

function percentile(values: readonly number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1));
  return sorted[index] ?? 0;
}

function metricName(name: string): string {
  if (!/^[a-zA-Z_:][a-zA-Z0-9_:]*$/.test(name)) {
    throw new Error(`Nama metric tidak valid: ${name}`);
  }
  return name;
}

export class OperationalMetrics {
  readonly #counters = new Map<string, CounterSeries>();
  readonly #histograms = new Map<string, HistogramSeries>();
  readonly #recentRequests: RecentRequestSpan[] = [];

  constructor(readonly service: string) {}

  addCounter(name: string, value = 1, labels: MetricLabels = {}): void {
    if (!Number.isFinite(value) || value < 0) throw new Error("Counter increment harus finite >= 0.");
    const safeName = metricName(name);
    const safeLabels = normalizedLabels(labels);
    const key = seriesKey(safeName, safeLabels);
    let series = this.#counters.get(key);
    if (series === undefined) {
      if (this.#counters.size + this.#histograms.size >= MAX_SERIES) return;
      series = { name: safeName, labels: safeLabels, value: 0 };
      this.#counters.set(key, series);
    }
    series.value += value;
  }

  observe(name: string, value: number, labels: MetricLabels = {}): void {
    if (!Number.isFinite(value) || value < 0) return;
    const safeName = metricName(name);
    const safeLabels = normalizedLabels(labels);
    const key = seriesKey(safeName, safeLabels);
    let series = this.#histograms.get(key);
    if (series === undefined) {
      if (this.#counters.size + this.#histograms.size >= MAX_SERIES) return;
      series = {
        name: safeName,
        labels: safeLabels,
        samples: [],
        count: 0,
        sum: 0,
        min: value,
        max: value,
      };
      this.#histograms.set(key, series);
    }
    series.count += 1;
    series.sum += value;
    series.min = Math.min(series.min, value);
    series.max = Math.max(series.max, value);
    if (series.samples.length >= MAX_HISTOGRAM_SAMPLES) series.samples.shift();
    series.samples.push(value);
  }

  recordRequest(span: RecentRequestSpan): void {
    if (this.#recentRequests.length >= MAX_RECENT_REQUESTS) this.#recentRequests.shift();
    this.#recentRequests.push(span);
  }

  snapshot(now = new Date().toISOString()): OperationalSnapshot {
    return {
      service: this.service,
      generatedAt: now,
      counters: [...this.#counters.values()].map((series) => ({
        name: series.name,
        labels: series.labels,
        value: series.value,
      })),
      histograms: [...this.#histograms.values()].map((series) => ({
        name: series.name,
        labels: series.labels,
        count: series.count,
        sum: series.sum,
        min: series.min,
        max: series.max,
        p50: percentile(series.samples, 0.5),
        p95: percentile(series.samples, 0.95),
      })),
      recentRequests: [...this.#recentRequests],
    };
  }

  prometheus(): string {
    const snapshot = this.snapshot();
    const lines: string[] = [];
    for (const counter of snapshot.counters) {
      lines.push(`${counter.name}${formatLabels(counter.labels)} ${counter.value}`);
    }
    for (const histogram of snapshot.histograms) {
      const labels = formatLabels(histogram.labels);
      lines.push(`${histogram.name}_count${labels} ${histogram.count}`);
      lines.push(`${histogram.name}_sum${labels} ${histogram.sum}`);
      lines.push(`${histogram.name}_min${labels} ${histogram.min}`);
      lines.push(`${histogram.name}_max${labels} ${histogram.max}`);
      lines.push(`${histogram.name}_p50${labels} ${histogram.p50}`);
      lines.push(`${histogram.name}_p95${labels} ${histogram.p95}`);
    }
    return `${lines.join("\n")}\n`;
  }
}

function formatLabels(labels: MetricLabels): string {
  const entries = Object.entries(labels);
  if (entries.length === 0) return "";
  return `{${entries
    .map(([key, value]) => `${key}="${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`)
    .join(",")}}`;
}

const appMetrics = new WeakMap<FastifyInstance, OperationalMetrics>();

export function attachOperationalMetrics(app: FastifyInstance, metrics: OperationalMetrics): void {
  appMetrics.set(app, metrics);
}

export function observabilityFor(app: FastifyInstance): OperationalMetrics {
  const metrics = appMetrics.get(app);
  if (metrics === undefined) throw new Error("Operational metrics belum terpasang pada server.");
  return metrics;
}

export interface RequestTraceContext {
  readonly traceId: string;
  readonly spanId: string;
  readonly flags: string;
  readonly requestId: string;
}

const traceStorage = new AsyncLocalStorage<RequestTraceContext>();
const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;

function randomHex(bytes: number): string {
  return randomBytes(bytes).toString("hex");
}

export function requestTraceContext(
  traceparent: string | undefined,
  requestId: string,
): RequestTraceContext {
  const match = traceparent?.trim().toLowerCase().match(TRACEPARENT);
  const valid =
    match !== null && match !== undefined && !/^0+$/.test(match[1] ?? "") && !/^0+$/.test(match[2] ?? "");
  return {
    traceId: valid ? (match?.[1] ?? randomHex(16)) : randomHex(16),
    spanId: randomHex(8),
    flags: valid ? (match?.[3] ?? "01") : "01",
    requestId,
  };
}

export function runWithRequestTrace<T>(context: RequestTraceContext, callback: () => T): T {
  return traceStorage.run(context, callback);
}

export function currentRequestTrace(): RequestTraceContext | undefined {
  return traceStorage.getStore();
}

export function traceparentFor(context: Pick<RequestTraceContext, "traceId" | "spanId" | "flags">): string {
  return `00-${context.traceId}-${context.spanId}-${context.flags}`;
}

export function outgoingTraceHeaders(): Record<string, string> {
  const current = currentRequestTrace();
  if (current === undefined) return {};
  return {
    "x-request-id": current.requestId,
    traceparent: traceparentFor({ ...current, spanId: randomHex(8) }),
  };
}
