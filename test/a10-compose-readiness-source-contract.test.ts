import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const deploy = readFileSync("deploy/compose.yml", "utf8");
const desktop = readFileSync("desktop/compose.yml", "utf8");
const localTemporal = readFileSync("deploy/local-temporal.yml", "utf8");
const aiHealth = readFileSync("apps/ai/app/api/healthz/route.ts", "utf8");

function serviceBlock(source: string, name: string): string {
  const startMarker = `\n  ${name}:\n`;
  const start = source.indexOf(startMarker);
  expect(start, `missing service ${name}`).toBeGreaterThanOrEqual(0);
  const bodyStart = start + startMarker.length;
  const nextServiceOffset = source.slice(bodyStart).search(/\n {2}[A-Za-z0-9_-]+:\n/u);
  const nextService = nextServiceOffset >= 0 ? bodyStart + nextServiceOffset : source.length;
  const sectionBoundaries = ["\nnetworks:", "\nvolumes:"]
    .map((marker) => source.indexOf(marker, bodyStart))
    .filter((index) => index >= 0);
  const nextSection =
    sectionBoundaries.length > 0 ? Math.min(...sectionBoundaries) : source.length;
  return source.slice(start, Math.min(nextService, nextSection));
}

function expectHttpHealth(source: string, name: string, port: number, path = "/healthz"): void {
  const block = serviceBlock(source, name);
  expect(block).toContain("healthcheck:");
  expect(block).toContain(
    `fetch('http://127.0.0.1:${String(port)}${path}',{signal:AbortSignal.timeout(2000)})`,
  );
}

function expectHealthyDependency(source: string, service: string, dependency: string): void {
  const block = serviceBlock(source, service);
  expect(block).toContain(`      ${dependency}:\n        condition: service_healthy`);
}

describe("A-10 Compose readiness contract", () => {
  it("gates production owners on explicit HTTP readiness", () => {
    for (const [name, port, path] of [
      ["rnd", 17021, "/healthz"],
      ["context", 17022, "/healthz"],
      ["connect", 17023, "/healthz"],
      ["hub", 17024, "/healthz"],
      ["artifact", 17025, "/healthz"],
      ["sandbox", 17026, "/healthz"],
      ["space", 17027, "/healthz"],
      ["flow", 17028, "/healthz"],
      ["sync", 17011, "/healthz"],
      ["mcp", 17010, "/healthz"],
      ["ai", 3000, "/api/healthz"],
    ] as const) {
      expectHttpHealth(deploy, name, port, path);
    }
  });

  it("uses Temporal's canonical SERVING probe in every Temporal Compose surface", () => {
    for (const source of [deploy, desktop, localTemporal]) {
      const block = serviceBlock(source, "temporal");
      expect(block).toContain("temporal operator cluster health | grep -q SERVING");
      expect(block).toContain("TEMPORAL_ADDRESS=temporal:7233");
    }
  });

  it("waits for required production dependencies to become healthy", () => {
    const required: ReadonlyArray<readonly [string, string]> = [
      ["context", "connect"],
      ["hub", "context"],
      ["hub", "connect"],
      ["hub", "rnd"],
      ["artifact", "context"],
      ["sandbox", "hub"],
      ["flow", "temporal"],
      ["flow", "hub"],
      ["space", "context"],
      ["space", "artifact"],
      ["space", "flow"],
      ["flow-worker", "temporal"],
      ["flow-worker", "space"],
      ["mcp", "sync"],
      ["mcp", "hub"],
      ["ai", "hub"],
      ["ai", "space"],
      ["ai", "flow"],
      ["caddy", "ai"],
      ["caddy", "sync"],
      ["caddy", "mcp"],
    ];
    for (const [service, dependency] of required) {
      expectHealthyDependency(deploy, service, dependency);
    }
  });

  it("keeps desktop startup aligned with owner readiness", () => {
    for (const [name, port, path] of [
      ["rnd", 17021, "/healthz"],
      ["context", 17022, "/healthz"],
      ["connect", 17023, "/healthz"],
      ["hub", 17024, "/healthz"],
      ["artifact", 17025, "/healthz"],
      ["sandbox", 17026, "/healthz"],
      ["space", 17027, "/healthz"],
      ["flow", 17028, "/healthz"],
      ["ai", 3000, "/api/healthz"],
    ] as const) {
      expectHttpHealth(desktop, name, port, path);
    }
    for (const [service, dependency] of [
      ["flow", "temporal"],
      ["space", "flow"],
      ["flow-worker", "space"],
      ["ai", "space"],
    ] as const) {
      expectHealthyDependency(desktop, service, dependency);
    }
  });

  it("keeps the Ai probe intentionally shallow and owner-neutral", () => {
    expect(aiHealth).toContain('status: "ok"');
    expect(aiHealth).toContain('service: "ai"');
    expect(aiHealth).not.toMatch(/fetch\s*\(/u);
  });
});
