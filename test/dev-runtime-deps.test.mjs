import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);

describe("local dev runtime dependency bootstrap", () => {
  it("builds compiled workspace dependencies before every local dev entrypoint", () => {
    const buildRuntimeDeps = packageJson.scripts?.["build:runtime-deps"];
    expect(buildRuntimeDeps).toBe(
      "tsc --build packages/shared-schema packages/shared-telemetry packages/context-assembly packages/shared-server",
    );

    for (const scriptName of ["dev", "dev:phase2", "dev:phase3", "dev:phase4"]) {
      expect(packageJson.scripts?.[scriptName]).toMatch(
        /^pnpm run build:runtime-deps && /,
      );
    }
  });
});
