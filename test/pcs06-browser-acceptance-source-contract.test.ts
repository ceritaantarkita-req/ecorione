import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PCS-06 integrated browser acceptance contract", () => {
  const harness = readFileSync("scripts/pcs06-browser-acceptance.mjs", "utf8");
  const workflow = readFileSync(".github/workflows/pcs06-browser-acceptance.yml", "utf8");

  it("covers every approved product surface in rendered browser acceptance", () => {
    for (const route of [
      '"/"',
      '"/projects"',
      '"/work"',
      '"/brain"',
      '"/space"',
      '"/flow"',
      '"/ops"',
      '"/settings"',
    ]) {
      expect(harness).toContain(route);
    }
  });

  it("covers the post-closure user journeys rather than route smoke only", () => {
    expect(harness).toContain("Earlier hosted reply");
    expect(harness).toContain("PCS06_HOSTED_OK");
    expect(harness).toContain("Local unavailable option must be disabled");
    expect(harness).toContain('name: "Test API key"');
    expect(harness).toContain('"governed"');
    expect(harness).toContain('name: "Prepare authority"');
    expect(harness).toContain('name: "Approve"');
    expect(harness).toContain("Execution authority ready");
    expect(harness).toContain("graphRunStarted");
  });

  it("covers responsive, theme, overflow and browser-console behavior", () => {
    expect(harness).toContain("width: 1440, height: 900");
    expect(harness).toContain("width: 410, height: 844");
    expect(harness).toContain("Gunakan tema terang");
    expect(harness).toContain("Gunakan tema gelap");
    expect(harness).toContain("assertNoPageOverflow");
    expect(harness).toContain("pageerror");
    expect(harness).toContain("badConsoleMessage");
  });

  it("fails if rendered acceptance makes external network requests", () => {
    expect(harness).toContain("externalRequests");
    expect(harness).toContain("External network request(s) observed");
    expect(harness).toContain('url.hostname !== "127.0.0.1"');
    expect(harness).toContain('url.hostname !== "localhost"');
  });

  it("keeps the browser runtime ephemeral and GitHub actions immutable-pinned", () => {
    expect(workflow).toContain("/tmp/pcs06-playwright");
    expect(workflow).toContain('"playwright": "1.55.0"');
    expect(workflow).toContain("PCS06_ARTIFACT_DIR");
    expect(workflow).toContain(
      "actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09",
    );
    expect(workflow).toContain(
      "pnpm/action-setup@fc06bc1257f339d1d5d8b3a19a8cae5388b55320",
    );
    expect(workflow).toContain(
      "actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444",
    );
    expect(workflow).toContain(
      "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02",
    );
  });
});
