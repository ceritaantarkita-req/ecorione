import { describe, expect, it } from "vitest";
import {
  assertObservabilityReport,
  counterDelta,
  percentile,
  spansForRun,
  summarizeNumbers,
  summarizeProcessResources,
} from "../scripts/local-observability-evidence-lib.mjs";

function processSnapshot(pid, rss, heap, user, system) {
  return {
    service: "svc",
    process: {
      pid,
      uptimeSeconds: 10,
      rssBytes: rss,
      heapUsedBytes: heap,
      heapTotalBytes: heap * 2,
      externalBytes: 100,
      arrayBuffersBytes: 50,
      cpuUserMicros: user,
      cpuSystemMicros: system,
    },
    counters: [],
    histograms: [],
    recentRequests: [],
  };
}

describe("local observability evidence helpers", () => {
  it("summarizes bounded latency samples deterministically", () => {
    expect(percentile([50, 10, 40, 20, 30], 0.5)).toBe(30);
    expect(percentile([50, 10, 40, 20, 30], 0.95)).toBe(50);
    expect(summarizeNumbers([10, 20, 30, 40])).toEqual({
      count: 4,
      min: 10,
      max: 40,
      mean: 25,
      p50: 20,
      p95: 40,
    });
  });

  it("computes label-subset counter deltas and run-scoped spans", () => {
    const before = {
      counters: [
        {
          name: "ecorione_model_calls_total",
          labels: { target: "local", cache: "miss", model: "a" },
          value: 2,
        },
      ],
    };
    const after = {
      counters: [
        {
          name: "ecorione_model_calls_total",
          labels: { target: "local", cache: "miss", model: "a" },
          value: 5,
        },
      ],
      recentRequests: [
        { requestId: "obs-run-model-0", startedAt: "2026-09-11T00:00:00.000Z" },
        { requestId: "other", startedAt: "2026-09-11T00:00:01.000Z" },
      ],
    };
    expect(counterDelta(before, after, "ecorione_model_calls_total", { cache: "miss" })).toBe(
      3,
    );
    expect(spansForRun({ connect: after }, "obs-run")).toHaveLength(1);
  });

  it("summarizes process resource deltas without pretending they are peaks", () => {
    const resources = summarizeProcessResources(
      { hub: processSnapshot(1, 1000, 500, 100, 50) },
      { hub: processSnapshot(1, 1300, 650, 160, 70) },
    );
    expect(resources.hub).toMatchObject({
      pid: 1,
      rssBytes: { before: 1000, after: 1300, delta: 300 },
      heapUsedBytes: { before: 500, after: 650, delta: 150 },
      cpuUserMicrosDelta: 60,
      cpuSystemMicrosDelta: 20,
    });
  });

  it("accepts a bounded all-pass report and rejects cached model samples", () => {
    const ownerSamples = Array.from({ length: 3 }, () => ({ ok: true }));
    const modelSamples = Array.from({ length: 3 }, () => ({
      ok: true,
      pass: true,
      target: "local",
      cacheHit: false,
      provider: "local",
      model: "model-a",
    }));
    const resources = Object.fromEntries(
      ["hub", "context"].map((service, index) => [
        service,
        {
          pid: index + 1,
          uptimeSeconds: 1,
          rssBytes: { before: 1, after: 2, delta: 1 },
          heapUsedBytes: { before: 1, after: 2, delta: 1 },
          cpuUserMicrosDelta: 1,
          cpuSystemMicrosDelta: 1,
        },
      ]),
    );
    const report = {
      phase: "measured",
      revision: "abcdef123456",
      requiredServices: ["hub", "context"],
      sampleConfig: { ownerReads: 3, ecx: 3, model: 3 },
      workloads: {
        ownerReads: {
          hub: ownerSamples,
          context: ownerSamples,
          artifact: ownerSamples,
          flow: ownerSamples,
        },
        ecx: Array.from({ length: 3 }, () => ({ ok: true })),
        model: modelSamples,
      },
      summary: {
        workloadErrors: 0,
        traceCoverage: { ecxHydrationsWithArtifactSpan: 3 },
        processResources: resources,
      },
    };
    expect(assertObservabilityReport(report)).toBe(report);
    report.workloads.model[0].cacheHit = true;
    expect(() => assertObservabilityReport(report)).toThrow(/uncached/u);
  });
});
