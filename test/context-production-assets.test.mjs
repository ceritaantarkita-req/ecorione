import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "..");
const rootPackage = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
const contextPackage = JSON.parse(
  readFileSync(resolve(ROOT, "services/context/package.json"), "utf8"),
);
const copyScript = readFileSync(
  resolve(ROOT, "services/context/scripts/copy-migrations.mjs"),
  "utf8",
);
const dockerfile = readFileSync(resolve(ROOT, "Dockerfile"), "utf8");

describe("Context production runtime assets", () => {
  it("copies Context migrations during the root production build", () => {
    expect(rootPackage.scripts.build).toContain(
      "pnpm --filter @ecorione/context run copy:runtime-assets",
    );
    expect(contextPackage.scripts["copy:runtime-assets"]).toBe(
      "node scripts/copy-migrations.mjs",
    );
  });

  it("copies source migrations beside the compiled migration runner", () => {
    expect(copyScript).toContain("../src/migrations/");
    expect(copyScript).toContain("../dist/migrations/");
    expect(copyScript).toContain("cpSync(src, dest, { recursive: true })");
  });

  it("fails the production image build if migration SQL assets are missing", () => {
    expect(dockerfile).toContain("test -d services/context/dist/migrations");
    expect(dockerfile).toContain(
      "find services/context/dist/migrations -maxdepth 1 -type f -name '*.sql' -print -quit | grep -q .",
    );
  });
});
