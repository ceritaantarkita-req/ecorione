import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const HTTP_JSON_CALLERS = [
  "services/hub/src/project-source-http.ts",
  "services/flow/src/trigger-http.ts",
  "services/flow/src/trigger-activities.ts",
] as const;

describe("A-01 internal HTTP timeout contract", () => {
  it("shared httpJson applies a bounded default deadline", () => {
    const source = readFileSync("packages/shared-server/src/client.ts", "utf8");
    expect(source).toContain("DEFAULT_INTERNAL_HTTP_TIMEOUT_MS");
    expect(source).toContain("AbortSignal.timeout(timeoutMs)");
    expect(source).toContain("init.signal = boundedSignal(options)");
  });

  for (const path of HTTP_JSON_CALLERS) {
    it(`${path} tetap lewat shared httpJson boundary`, () => {
      const source = readFileSync(path, "utf8");
      expect(source).toContain("httpJson");
    });
  }

  it("Brain raw owner fetch memiliki deadline eksplisit yang sama", () => {
    const source = readFileSync("apps/ai/lib/brain-projection.ts", "utf8");
    expect(source).toContain("BRAIN_OWNER_TIMEOUT_MS = 10_000");
    expect(source).toContain("signal: AbortSignal.timeout(BRAIN_OWNER_TIMEOUT_MS)");
  });
});
