import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const PORT_TO_SERVICE: Record<string, string> = {
  "17021": "rnd",
  "17022": "context",
  "17023": "connect",
  "17024": "hub",
  "17025": "artifact",
  "17026": "sandbox",
  "17027": "space",
  "17028": "flow",
  "17011": "sync",
};

let originalToken: string | undefined;

function serviceFor(url: string): string {
  return PORT_TO_SERVICE[new URL(url).port] ?? "unknown";
}

function observability(service: string) {
  return {
    service,
    generatedAt: "2026-09-12T00:00:00.000Z",
    process: {
      pid: 1,
      uptimeSeconds: 1,
      rssBytes: 1,
      heapUsedBytes: 1,
      heapTotalBytes: 1,
      externalBytes: 0,
      arrayBuffersBytes: 0,
      cpuUserMicros: 0,
      cpuSystemMicros: 0,
    },
    counters: [],
    histograms: [],
    recentRequests: [],
  };
}

beforeEach(() => {
  originalToken = process.env.ECORIONE_INTERNAL_TOKEN;
  process.env.ECORIONE_INTERNAL_TOKEN = "ops-test-token";
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalToken === undefined) delete process.env.ECORIONE_INTERNAL_TOKEN;
  else process.env.ECORIONE_INTERNAL_TOKEN = originalToken;
});

describe("GET /api/ops", () => {
  it("mengagregasi owner dengan no-store, redirect error, dan bearer hanya untuk observability", async () => {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
        const url = String(input);
        calls.push({ url, init });
        if (url.endsWith("/healthz")) {
          return Response.json({ status: "ok", service: serviceFor(url) });
        }
        if (url.endsWith("/v1/ops/observability")) {
          return Response.json(observability(serviceFor(url)));
        }
        return new Response("not found", { status: 404 });
      }),
    );

    const response = await GET();
    const body = (await response.json()) as {
      healthy: boolean;
      services: Array<{ name: string; required: boolean; healthy: boolean }>;
    };

    expect(response.status).toBe(200);
    expect(body.healthy).toBe(true);
    expect(body.services).toHaveLength(9);
    expect(body.services.every((service) => service.healthy)).toBe(true);
    expect(body.services.find((service) => service.name === "sync")?.required).toBe(false);
    expect(
      body.services
        .filter((service) => service.name !== "sync")
        .every((service) => service.required),
    ).toBe(true);
    expect(calls.filter((call) => call.url.endsWith("/healthz"))).toHaveLength(9);
    expect(calls.filter((call) => call.url.endsWith("/v1/ops/observability"))).toHaveLength(8);
    expect(calls.every((call) => call.init?.cache === "no-store")).toBe(true);
    expect(calls.every((call) => call.init?.redirect === "error")).toBe(true);

    for (const call of calls.filter((item) => item.url.endsWith("/v1/ops/observability"))) {
      expect((call.init?.headers as Record<string, string>).authorization).toBe(
        "Bearer ops-test-token",
      );
    }
    for (const call of calls.filter((item) => item.url.endsWith("/healthz"))) {
      expect(call.init?.headers).toEqual({});
    }
  });

  it("satu owner wajib gagal tetap menghasilkan snapshot eksplisit degraded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: Parameters<typeof fetch>[0]) => {
        const url = String(input);
        if (url.includes(":17027/healthz")) return new Response("down", { status: 503 });
        if (url.endsWith("/healthz")) {
          return Response.json({ status: "ok", service: serviceFor(url) });
        }
        if (url.endsWith("/v1/ops/observability")) {
          return Response.json(observability(serviceFor(url)));
        }
        return new Response("not found", { status: 404 });
      }),
    );

    const response = await GET();
    const body = (await response.json()) as {
      healthy: boolean;
      services: Array<{
        name: string;
        required: boolean;
        healthy: boolean;
        error: string | null;
      }>;
    };
    const space = body.services.find((service) => service.name === "space");

    expect(response.status).toBe(200);
    expect(body.healthy).toBe(false);
    expect(space?.required).toBe(true);
    expect(space?.healthy).toBe(false);
    expect(space?.error).toMatch(/HTTP 503/);
  });

  it("Sync lokal yang tidak dijalankan tetap terlihat tetapi tidak mendegradasi fleet Phase 4", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: Parameters<typeof fetch>[0]) => {
        const url = String(input);
        if (url.includes(":17011/healthz")) throw new TypeError("fetch failed");
        if (url.endsWith("/healthz")) {
          return Response.json({ status: "ok", service: serviceFor(url) });
        }
        if (url.endsWith("/v1/ops/observability")) {
          return Response.json(observability(serviceFor(url)));
        }
        return new Response("not found", { status: 404 });
      }),
    );

    const response = await GET();
    const body = (await response.json()) as {
      healthy: boolean;
      services: Array<{
        name: string;
        required: boolean;
        healthy: boolean;
        error: string | null;
      }>;
    };
    const sync = body.services.find((service) => service.name === "sync");

    expect(response.status).toBe(200);
    expect(body.healthy).toBe(true);
    expect(sync).toMatchObject({
      name: "sync",
      required: false,
      healthy: false,
    });
    expect(sync?.error).toMatch(/fetch failed/);
  });
});
