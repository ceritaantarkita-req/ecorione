import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "..");
const launcher = readFileSync(resolve(ROOT, "desktop/ecorione.ps1"), "utf8");

describe("W11 packaged desktop image probe", () => {
  it("treats a missing runtime image as a normal first-start state", () => {
    expect(launcher).toContain('docker image ls --quiet --filter "reference=$Image"');
    expect(launcher).toContain("return @($ids | Where-Object { $_ }).Count -gt 0");
    expect(launcher).toContain("Gagal memeriksa Docker image '$Image'.");
    expect(launcher).not.toContain("docker image inspect $Image");
  });
});
