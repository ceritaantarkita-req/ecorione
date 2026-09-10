import { createServer } from "./server.js";
import {
  OperationalMetrics,
  currentRequestTrace,
  outgoingTraceHeaders,
  requestTraceContext,
} from "./observability.js";
import { afterEach, describe, expect, it } from "vitest";

const servers: ReturnType<typeof createServer>[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(async (server) => server.close()));
});

describe("OperationalMetrics", () => {
  it("mencatat counter dan bounded percentile tanpa payload sensitif", () => {
    const metrics = new OperationalMetrics("test");
    metrics.addCounter("ecorione_test_total", 2, { outcome: "ok" });
    for (const value of [10, 20, 30, 40, 50]) metrics.observe("ecorione_test_ms", value);
    const snapshot = metrics.snapshot("2026-09-10T00:00:00.000Z");
    expect(snapshot.counters[0]?.value).toBe(2);
    expect(snapshot.histograms[0]).toMatchObject({ count: 5, p50: 30, p95: 50 });
    expect(metrics.prometheus()).toContain("ecorione_test_ms_p95 50");
  });

  it("menolak traceparent invalid dan mempertahankan trace id valid", () => {
    const valid = requestTraceContext(
      "00-0123456789abcdef0123456789abcdef-0123456789abcdef-01",
      "req-1",
    );
    expect(valid.traceId).toBe("0123456789abcdef0123456789abcdef");
    const invalid = requestTraceContext(
      "00-00000000000000000000000000000000-0000000000000000-01",
      "req-2",
    );
    expect(invalid.traceId).toMatch(/^[a-f0-9]{32}$/);
    expect(invalid.traceId).not.toBe("00000000000000000000000000000000");
  });
});

describe("shared server observability", () => {
  it("melindungi metrics, memberi trace header, dan merekam request", async () => {
    const app = createServer({ name: "observed", token: "internal-secret" });
    servers.push(app);
    app.get("/v1/probe", async () => ({ trace: currentRequestTrace()?.traceId ?? null }));

    const unauthorized = await app.inject({ method: "GET", url: "/metrics" });
    expect(unauthorized.statusCode).toBe(401);

    const probe = await app.inject({
      method: "GET",
      url: "/v1/probe",
      headers: {
        authorization: "Bearer internal-secret",
        traceparent: "00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01",
        "x-request-id": "request-probe",
      },
    });
    expect(probe.statusCode).toBe(200);
    expect(probe.headers["x-ecorione-trace-id"]).toBe("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(probe.json()).toEqual({ trace: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" });

    const snapshot = await app.inject({
      method: "GET",
      url: "/v1/ops/observability",
      headers: { authorization: "Bearer internal-secret" },
    });
    expect(snapshot.statusCode).toBe(200);
    const body = snapshot.json() as {
      recentRequests: Array<{ route: string; traceId: string }>;
    };
    expect(body.recentRequests).toContainEqual(
      expect.objectContaining({ route: "/v1/probe", traceId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }),
    );
  });

  it("tidak mengekspos endpoint ops bila server tidak memakai token", async () => {
    const app = createServer({ name: "public-boundary" });
    servers.push(app);
    expect((await app.inject({ method: "GET", url: "/metrics" })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: "/healthz" })).statusCode).toBe(200);
  });

  it("membuat child trace headers hanya di dalam request context", async () => {
    expect(outgoingTraceHeaders()).toEqual({});
    const app = createServer({ name: "trace-source" });
    servers.push(app);
    app.get("/child", async () => outgoingTraceHeaders());
    const response = await app.inject({
      method: "GET",
      url: "/child",
      headers: {
        traceparent: "00-cccccccccccccccccccccccccccccccc-dddddddddddddddd-01",
        "x-request-id": "request-child",
      },
    });
    const child = response.json() as Record<string, string>;
    expect(child["x-request-id"]).toBe("request-child");
    expect(child.traceparent).toMatch(/^00-cccccccccccccccccccccccccccccccc-[a-f0-9]{16}-01$/);
  });
});