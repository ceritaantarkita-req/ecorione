import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Docker native dependency build contract", () => {
  const dockerfile = readFileSync("Dockerfile", "utf8");
  const runtimeStage =
    "FROM node:22.20.0-bookworm-slim@sha256:b21fe589dfbe5cc39365d0544b9be3f1f33f55f3c86c87a76ff65a02f8f5848e AS runtime";
  const runtimeIndex = dockerfile.indexOf(runtimeStage);

  it("supports better-sqlite3 source fallback in the pinned builder", () => {
    expect(dockerfile).toContain(
      "FROM node:22.20.0-bookworm-slim@sha256:b21fe589dfbe5cc39365d0544b9be3f1f33f55f3c86c87a76ff65a02f8f5848e AS build",
    );
    expect(dockerfile).toContain(
      "apt-get install -y --no-install-recommends python3 make g++",
    );
    expect(dockerfile).toContain("pnpm install --frozen-lockfile && pnpm run build");
    expect(dockerfile.indexOf("python3 make g++")).toBeLessThan(runtimeIndex);
  });

  it("keeps compilers out of the final runtime stage", () => {
    expect(runtimeIndex).toBeGreaterThan(0);
    const runtime = dockerfile.slice(runtimeIndex);
    expect(runtime).toContain(runtimeStage);
    expect(runtime).toContain("COPY --from=build /app /app");
    expect(runtime).not.toContain("apt-get install");
    expect(runtime).not.toContain("python3 make g++");
    expect(runtime).toContain("USER node");
  });
});
