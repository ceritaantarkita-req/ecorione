import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SCRIPT = "scripts/google-drive-local-acceptance-preflight.mjs";
const DEFAULT_ORIGIN = "http://localhost:3000";
const CALLBACK_PATH = "/api/integrations/google-drive/callback";
const PICKER_KEY = "picker_example_key_123456";
const SECRET_NAMES = [
  "ECORIONE_CONNECT_VAULT_MASTER_KEY",
  "ECORIONE_GOOGLE_DRIVE_CLIENT_ID",
  "ECORIONE_GOOGLE_DRIVE_CLIENT_SECRET",
  "ECORIONE_GOOGLE_DRIVE_REDIRECT_URI",
  "ECORIONE_GOOGLE_DRIVE_PICKER_API_KEY",
  "ECORIONE_GOOGLE_DRIVE_PICKER_APP_ID",
] as const;

function baseEnv(): NodeJS.ProcessEnv {
  const next = { ...process.env };
  for (const name of SECRET_NAMES) delete next[name];

  return {
    ...next,
    ECORIONE_CONNECT_VAULT_MASTER_KEY: Buffer.alloc(32, 7).toString("base64url"),
    ECORIONE_GOOGLE_DRIVE_CLIENT_ID: "example-client-id-123456",
    ECORIONE_GOOGLE_DRIVE_REDIRECT_URI: `${DEFAULT_ORIGIN}${CALLBACK_PATH}`,
    ECORIONE_GOOGLE_DRIVE_PICKER_API_KEY: PICKER_KEY,
    ECORIONE_GOOGLE_DRIVE_PICKER_APP_ID: "123456789012",
  };
}

function run(env: NodeJS.ProcessEnv, origin = DEFAULT_ORIGIN) {
  return spawnSync(process.execPath, [SCRIPT, "--origin", origin], {
    env,
    encoding: "utf8",
    windowsHide: true,
  });
}

describe("Session 12D Google Drive local acceptance preflight", () => {
  it("documents the local operator contract", () => {
    const example = readFileSync(".env.example", "utf8");
    const packageJson = readFileSync("package.json", "utf8");
    const runbook = readFileSync("docs/google-drive-operations.md", "utf8");

    for (const name of SECRET_NAMES) {
      expect(example).toContain(name);
    }

    expect(example).toContain("ECORIONE_GOOGLE_DRIVE_PICKER_APP_ID=");
    expect(packageJson).toContain('"acceptance:google-drive:preflight"');
    expect(packageJson).toContain(
      "node --env-file=.env scripts/google-drive-local-acceptance-preflight.mjs",
    );
    expect(runbook).toContain(
      "pnpm acceptance:google-drive:preflight -- --origin http://localhost:3000",
    );
    expect(runbook).toContain("pnpm dev");
    expect(runbook).toContain("does **not** prove");
  });

  it("passes complete local config", () => {
    const result = run(baseEnv());

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("PASS google-drive-local-preflight");
    expect(result.stdout).toContain("vault_configured=1");
    expect(result.stdout).toContain("oauth_configured=1");
    expect(result.stdout).toContain("oauth_client_secret=absent");
    expect(result.stdout).toContain("picker_configured=1");
    expect(result.stdout).toContain("redirect_origin=http://localhost:3000");
    expect(result.stdout).toContain(`redirect_path=${CALLBACK_PATH}`);
    expect(result.stdout).not.toContain(PICKER_KEY);
    expect(result.stdout).not.toContain("example-client-id-123456");
  });

  it("rejects insecure non-loopback origin", () => {
    const origin = "http://example.test:3000";
    const env = {
      ...baseEnv(),
      ECORIONE_GOOGLE_DRIVE_REDIRECT_URI: `${origin}${CALLBACK_PATH}`,
    };
    const result = run(env, origin);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("--origin harus HTTPS kecuali loopback localhost");
  });

  it("rejects redirect origin mismatch", () => {
    const env = {
      ...baseEnv(),
      ECORIONE_GOOGLE_DRIVE_REDIRECT_URI:
        "http://localhost:3001/api/integrations/google-drive/callback",
    };
    const result = run(env);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Redirect origin http://localhost:3001");
    expect(result.stderr).not.toContain(PICKER_KEY);
  });

  it("rejects the wrong callback path", () => {
    const env = {
      ...baseEnv(),
      ECORIONE_GOOGLE_DRIVE_REDIRECT_URI: "http://localhost:3000/oauth/callback",
    };
    const result = run(env);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(CALLBACK_PATH);
  });

  it("rejects incomplete Picker config", () => {
    const env = baseEnv();
    delete env.ECORIONE_GOOGLE_DRIVE_PICKER_APP_ID;

    const result = run(env);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("ECORIONE_GOOGLE_DRIVE_PICKER_APP_ID belum diisi");
  });

  it("rejects an invalid Vault master key", () => {
    const env = {
      ...baseEnv(),
      ECORIONE_CONNECT_VAULT_MASTER_KEY: "not-a-32-byte-key",
    };
    const result = run(env);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("ECORIONE_CONNECT_VAULT_MASTER_KEY harus tepat 32 byte");
  });
});
