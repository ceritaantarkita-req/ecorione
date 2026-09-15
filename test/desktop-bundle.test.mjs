import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const compose = readFileSync(resolve(root, "desktop/compose.yml"), "utf8");
const launcher = readFileSync(resolve(root, "desktop/ecorione.ps1"), "utf8");
const startWrapper = readFileSync(resolve(root, "desktop/Start-ECORIONE.cmd"), "utf8");
const doctorWrapper = readFileSync(resolve(root, "desktop/Doctor-ECORIONE.cmd"), "utf8");
const stopWrapper = readFileSync(resolve(root, "desktop/Stop-ECORIONE.cmd"), "utf8");

describe("ECORIONE desktop bundle contract", () => {
  it("uses a prebuilt app image and does not build source on the user machine", () => {
    expect(compose).toContain("ECORIONE_DESKTOP_IMAGE");
    expect(compose).not.toMatch(/^\s*build:/m);
    expect(launcher).not.toMatch(/\bpnpm\b/i);
    expect(launcher).not.toMatch(/\bgit\s+clone\b/i);
    expect(launcher).not.toMatch(/\bnode(?:\.exe)?\b/i);
  });

  it("keeps the desktop web surface loopback-only and omits the public edge", () => {
    expect(compose).toContain('"127.0.0.1:${ECORIONE_AI_PORT:-17020}:3000"');
    expect(launcher).toContain("ECORIONE_AI_PORT=17020");
    expect(launcher).toContain("Select-FreeAiPort");
    expect(launcher).toContain("17029..17039");
    expect(compose).not.toContain('"80:80"');
    expect(compose).not.toContain('"443:443"');
    expect(compose).not.toMatch(/^\s+caddy:/m);
    expect(compose).not.toMatch(/^\s+mcp:/m);
  });

  it("contains the full local Phase 4 application fleet plus Temporal", () => {
    for (const service of [
      "temporal-db",
      "temporal",
      "rnd",
      "context",
      "connect",
      "hub",
      "artifact",
      "sandbox",
      "space",
      "flow",
      "flow-worker",
      "ai",
    ]) {
      expect(compose).toMatch(new RegExp(`^\\s{2}${service}:`, "m"));
    }
  });

  it("creates user-local secrets and loads the bundled runtime image through Docker", () => {
    expect(launcher).toContain("LOCALAPPDATA");
    expect(launcher).toContain("RandomNumberGenerator");
    expect(launcher).toContain("ECORIONE_INTERNAL_TOKEN=$(New-Base64UrlSecret)");
    expect(launcher).toContain("ECORIONE_CONNECT_VAULT_MASTER_KEY=$(New-Base64UrlSecret)");
    expect(launcher).toContain("docker load --input $RuntimeImageTar");
    expect(launcher).toContain('Invoke-Compose @("up", "-d")');
    expect(launcher).toContain('Invoke-Compose @("down", "--remove-orphans")');
  });

  it("provides double-click wrappers for start, doctor, and stop", () => {
    expect(startWrapper).toContain('ecorione.ps1" start');
    expect(doctorWrapper).toContain('ecorione.ps1" doctor');
    expect(stopWrapper).toContain('ecorione.ps1" stop');
  });
});
