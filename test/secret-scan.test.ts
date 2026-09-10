import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT = resolve("scripts/secret-scan.mjs");
const tempDirs: string[] = [];

function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "ecorione-secret-scan-"));
  tempDirs.push(dir);
  execFileSync("git", ["init", "-q"], { cwd: dir });
  writeFileSync(join(dir, ".gitignore"), ".env\n.env.*\n", "utf8");
  writeFileSync(join(dir, "README.md"), "fixture\n", "utf8");
  return dir;
}

function runScan(cwd: string) {
  return spawnSync(process.execPath, [SCRIPT], {
    cwd,
    encoding: "utf8",
  });
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("secret-scan commit boundary", () => {
  it("ignores a machine-local .env that Git excludes from commits", () => {
    const dir = makeRepo();
    const syntheticKey = `sk-${"a".repeat(40)}`;
    writeFileSync(join(dir, ".env"), `OPENAI_API_KEY=${syntheticKey}\n`, "utf8");

    const result = runScan(dir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("secret-scan: bersih.");
  });

  it("still blocks a forbidden .env once it is force-added to Git", () => {
    const dir = makeRepo();
    writeFileSync(join(dir, ".env"), "ECORIONE_INTERNAL_TOKEN=synthetic\n", "utf8");
    execFileSync("git", ["add", "-f", ".env"], { cwd: dir });

    const result = runScan(dir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(".env — File kredensial tidak boleh di-commit");
  });

  it("scans untracked files that are not ignored", () => {
    const dir = makeRepo();
    const syntheticKey = `sk-${"b".repeat(40)}`;
    writeFileSync(join(dir, "notes.txt"), `token=${syntheticKey}\n`, "utf8");

    const result = runScan(dir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("OpenAI API key");
  });
});
