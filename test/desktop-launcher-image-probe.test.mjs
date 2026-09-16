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

  it("does not treat normal docker compose progress on stderr as a PowerShell failure", () => {
    expect(launcher).toContain(
      '$previousErrorActionPreference = $ErrorActionPreference',
    );
    expect(launcher).toContain('$ErrorActionPreference = "Continue"');
    expect(launcher).toContain(
      '$output = & docker compose --env-file $EnvFile -f $ComposeFile @Arguments 2>&1',
    );
    expect(launcher).toContain('$exitCode = $LASTEXITCODE');
    expect(launcher).toContain(
      '$ErrorActionPreference = $previousErrorActionPreference',
    );
    expect(launcher).toContain('if ($exitCode -ne 0)');
  });
});
