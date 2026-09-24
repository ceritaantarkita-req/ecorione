import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const OWNER_ENTRYPOINTS = [
  "services/rnd/src/main.ts",
  "services/context/src/main.ts",
  "services/connect/src/main.ts",
  "services/hub/src/main.ts",
  "services/artifact/src/main.ts",
  "services/sandbox/src/main.ts",
  "services/space/src/main.ts",
  "services/flow/src/main.ts",
] as const;

describe("A-12 owner remote-bind authentication contract", () => {
  for (const path of OWNER_ENTRYPOINTS) {
    it(`${path} fail-closed melalui authenticated bind helper`, () => {
      const source = readFileSync(path, "utf8");
      expect(source).toContain("bindHostForAuthenticatedService");
      expect(source).toContain(
        "const host = bindHostForAuthenticatedService(token);",
      );
      expect(source).toContain(".listen({ port, host })");
      expect(source).not.toContain("host: bindHost()");
    });
  }

  it("Sync tetap memakai boundary auth miliknya sendiri", () => {
    const source = readFileSync("services/sync/src/main.ts", "utf8");
    expect(source).toContain("ECORIONE_SYNC_OWNER_TOKEN");
    expect(source).toContain("bindHost()");
    expect(source).not.toContain("bindHostForAuthenticatedService");
  });
});
