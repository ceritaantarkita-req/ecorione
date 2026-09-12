type CounterSnapshot = {
  name: string;
  labels: Record<string, string>;
  value: number;
};
type HistogramSnapshot = {
  name: string;
  labels: Record<string, string>;
  count: number;
  sum: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
};
type ProcessResourceSnapshot = {
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
type RecentRequestSpan = {
  traceId: string;
  spanId: string;
  requestId: string;
  service: string;
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
  startedAt: string;
};
type OperationalSnapshot = {
  service: string;
  generatedAt: string;
  process: ProcessResourceSnapshot;
  counters: CounterSnapshot[];
  histograms: HistogramSnapshot[];
  recentRequests: RecentRequestSpan[];
};

type ServiceTarget = { name: string; url: string; metrics: boolean };

const targets: ServiceTarget[] = [
  { name: "rnd", url: process.env.ECORIONE_RND_URL ?? "http://127.0.0.1:17021", metrics: true },
  {
    name: "context",
    url: process.env.ECORIONE_CONTEXT_URL ?? "http://127.0.0.1:17022",
    metrics: true,
  },
  {
    name: "connect",
    url: process.env.ECORIONE_CONNECT_URL ?? "http://127.0.0.1:17023",
    metrics: true,
  },
  { name: "hub", url: process.env.ECORIONE_HUB_URL ?? "http://127.0.0.1:17024", metrics: true },
  {
    name: "artifact",
    url: process.env.ECORIONE_ARTIFACT_URL ?? "http://127.0.0.1:17025",
    metrics: true,
  },
  {
    name: "sandbox",
    url: process.env.ECORIONE_SANDBOX_URL ?? "http://127.0.0.1:17026",
    metrics: true,
  },
  {
    name: "space",
    url: process.env.ECORIONE_SPACE_URL ?? "http://127.0.0.1:17027",
    metrics: true,
  },
  {
    name: "flow",
    url: process.env.ECORIONE_FLOW_URL ?? "http://127.0.0.1:17028",
    metrics: true,
  },
  {
    name: "sync",
    url: process.env.ECORIONE_SYNC_URL ?? "http://127.0.0.1:17011",
    metrics: false,
  },
];

async function fetchJson(url: string, headers: HeadersInit = {}): Promise<unknown> {
  const response = await fetch(url, {
    headers,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(2_000),
  });
  if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
  return response.json() as Promise<unknown>;
}

async function inspect(target: ServiceTarget): Promise<{
  name: string;
  healthy: boolean;
  health: unknown | null;
  observability: OperationalSnapshot | null;
  error: string | null;
}> {
  try {
    const health = await fetchJson(`${target.url}/healthz`);
    let observability: OperationalSnapshot | null = null;
    if (target.metrics) {
      const token = process.env.ECORIONE_INTERNAL_TOKEN;
      if (token === undefined || token.length === 0) {
        throw new Error("ECORIONE_INTERNAL_TOKEN belum dikonfigurasi untuk ops aggregation");
      }
      observability = (await fetchJson(`${target.url}/v1/ops/observability`, {
        authorization: `Bearer ${token}`,
      })) as OperationalSnapshot;
    }
    return { name: target.name, healthy: true, health, observability, error: null };
  } catch (error) {
    return {
      name: target.name,
      healthy: false,
      health: null,
      observability: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function GET(): Promise<Response> {
  const services = await Promise.all(targets.map(inspect));
  const traces = new Map<string, RecentRequestSpan[]>();
  for (const service of services) {
    for (const span of service.observability?.recentRequests ?? []) {
      const existing = traces.get(span.traceId) ?? [];
      existing.push(span);
      traces.set(span.traceId, existing);
    }
  }
  const recentTraces = [...traces.entries()]
    .map(([traceId, spans]) => ({
      traceId,
      spans: spans.sort((a, b) => a.startedAt.localeCompare(b.startedAt)),
    }))
    .sort((a, b) => {
      const aa = a.spans.at(-1)?.startedAt ?? "";
      const bb = b.spans.at(-1)?.startedAt ?? "";
      return bb.localeCompare(aa);
    })
    .slice(0, 50);

  return Response.json({
    generatedAt: new Date().toISOString(),
    healthy: services.every((service) => service.healthy),
    services,
    recentTraces,
  });
}
