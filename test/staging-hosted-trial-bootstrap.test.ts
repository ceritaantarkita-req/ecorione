import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const SCRIPT = "scripts/staging-hosted-trial-bootstrap-once.sh";

function fixture(extra = "") {
  const dir = mkdtempSync(join(tmpdir(), "ecorione-hosted-trial-"));
  const envPath = join(dir, "staging.env");
  const markerPath = join(dir, "hosted-trial.marker");
  writeFileSync(
    envPath,
    [
      "ECORIONE_INTERNAL_TOKEN=secret-must-survive",
      "ECORIONE_COST_KILL_SWITCH=1",
      "ECORIONE_SPEND_DAILY_USD=",
      "ECORIONE_SPEND_MONTHLY_USD=",
      "ECORIONE_SPEND_UNLIMITED=0",
      extra,
      "",
    ].join("\n"),
    "utf8",
  );
  chmodSync(envPath, 0o600);
  return { envPath, markerPath };
}

function run(envPath: string, markerPath: string, project = "ecorione-staging") {
  return execFileSync("bash", [SCRIPT, envPath], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      ECORIONE_COMPOSE_PROJECT: project,
      ECORIONE_STAGING_HOSTED_TRIAL_MARKER: markerPath,
    },
  });
}

describe("one-time staging hosted trial bootstrap", () => {
  it("opens hosted calls once with bounded default spend while preserving unrelated secrets", () => {
    const { envPath, markerPath } = fixture();
    expect(run(envPath, markerPath)).toContain("PASS staging hosted trial bootstrap");

    const env = readFileSync(envPath, "utf8");
    expect(env).toContain("ECORIONE_INTERNAL_TOKEN=secret-must-survive");
    expect(env).toContain("ECORIONE_COST_KILL_SWITCH=0");
    expect(env).toContain("ECORIONE_SPEND_DAILY_USD=1");
    expect(env).toContain("ECORIONE_SPEND_MONTHLY_USD=10");
    expect(env).toContain("ECORIONE_SPEND_UNLIMITED=0");
    expect(readFileSync(markerPath, "utf8")).toBe("staging-hosted-trial-v1\n");
  });

  it("does not override a later operator kill-switch change after the marker exists", () => {
    const { envPath, markerPath } = fixture();
    run(envPath, markerPath);
    const first = readFileSync(envPath, "utf8").replace(
      "ECORIONE_COST_KILL_SWITCH=0",
      "ECORIONE_COST_KILL_SWITCH=1",
    );
    writeFileSync(envPath, first, "utf8");
    chmodSync(envPath, 0o600);

    expect(run(envPath, markerPath)).toContain("already applied");
    expect(readFileSync(envPath, "utf8")).toContain("ECORIONE_COST_KILL_SWITCH=1");
  });

  it("keeps existing positive spend limits instead of widening them", () => {
    const { envPath, markerPath } = fixture();
    let env = readFileSync(envPath, "utf8")
      .replace("ECORIONE_SPEND_DAILY_USD=", "ECORIONE_SPEND_DAILY_USD=0.25")
      .replace("ECORIONE_SPEND_MONTHLY_USD=", "ECORIONE_SPEND_MONTHLY_USD=2");
    writeFileSync(envPath, env, "utf8");
    chmodSync(envPath, 0o600);

    run(envPath, markerPath);
    env = readFileSync(envPath, "utf8");
    expect(env).toContain("ECORIONE_SPEND_DAILY_USD=0.25");
    expect(env).toContain("ECORIONE_SPEND_MONTHLY_USD=2");
  });

  it("refuses unlimited hosted spend and leaves the env unchanged", () => {
    const { envPath, markerPath } = fixture();
    const before = readFileSync(envPath, "utf8").replace(
      "ECORIONE_SPEND_UNLIMITED=0",
      "ECORIONE_SPEND_UNLIMITED=1",
    );
    writeFileSync(envPath, before, "utf8");
    chmodSync(envPath, 0o600);

    const result = spawnSync("bash", [SCRIPT, envPath], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        ECORIONE_COMPOSE_PROJECT: "ecorione-staging",
        ECORIONE_STAGING_HOSTED_TRIAL_MARKER: markerPath,
      },
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("ECORIONE_SPEND_UNLIMITED must be 0");
    expect(readFileSync(envPath, "utf8")).toBe(before);
  });

  it("does nothing outside the staging compose project", () => {
    const { envPath, markerPath } = fixture();
    const before = readFileSync(envPath, "utf8");
    expect(run(envPath, markerPath, "ecorione")).toContain("skipped");
    expect(readFileSync(envPath, "utf8")).toBe(before);
  });
});
