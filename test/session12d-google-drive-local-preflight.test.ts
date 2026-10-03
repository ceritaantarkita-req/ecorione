import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const SCRIPT = "scripts/google-drive-local-acceptance-preflight.mjs";
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
    ECORIONE_GOOGLE_DRIVE_REDIRECT_URI:
      "http://localhost:3000/api/integrations/google-drive/callback",
    ECORIONE_GOOGLE_DRIVE_PICKER_API_KEY: "picker_example_key_123456",
    ECORIONE_GOOGLE_DRIVE_PICKER_APP_ID: "123456789012",
  };
}

function run(
  env: NodeJS.ProcessEnv,
  origin = "http://localhost:3000",
): ReturnType<typeof spawnSync> {
  return spawnSync(process.execPath, [SCRIPT, "--origin", origin], {
    env,
    encoding: "utf8",
    windowsHide: true,
  });
}

describe("Session 12D Google Drive local acceptance preflight", () => {
  it("passes a complete local OAuth + Picker + Vault configuration", () => {
    const result = run(baseEnv());

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("PASS google-drive-local-preflight");
    expect(result.stdout).toContain("vault_configured=1");
    expect(result.stdout).toContain("oauth_configured=1");
    expect(result.stdout).toContain("oauth_client_secret=absent");
    expect(result.stdout).toContain("picker_configured=1");
    expect(result.stdout).toContain("redirect_origin=http://localhost:3000");
    expect(result.stdout).toContain(
      "redirect_path=/api/integrations/google-drive/callback",
    );
    expect(result.stdout).not.toContain("picker_example_key_123456");
    expect(result.stdout).not.toContain("example-client-id-123456");
  });

  it("rejects an OAuth redirect origin that does not match the Ai origin", () => {
    const env = {
      ...baseEnv(),
      ECORIONE_GOOGLE_DRIVE_REDIRECT_URI:
        "http://localhost:3001/api/integrations/google-drive/callback",
    };
    const result = run(env);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Redirect origin http://localhost:3001");
    expect(result.stderr).not.toContain(String(env.ECORIONE_GOOGLE_DRIVE_PICKER_API_KEY));
  });

  it("rejects a redirect URI that does not terminate at the Ai callback route", () => {
    const env = {
      ...baseEnv(),
      ECORIONE_GOOGLE_DRIVE_REDIRECT_URI: "http://localhost:3000/oauth/callback",
    };
    const result = run(env);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("/api/integrations/google-drive/callback");
  });

  it("rejects incomplete Picker configuration", () => {
    const env = baseEnv();
    delete env.ECORIONE_GOOGLE_DRIVE_PICKER_APP_ID;
    const result = run(env);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("ECORIONE_GOOGLE_DRIVE_PICKER_APP_ID belum diisi");
  });

  it("rejects a Vault master key that is not canonical 32-byte base64url", () => {
    const env = {
      ...baseEnv(),
      ECORIONE_CONNECT_VAULT_MASTER_KEY: "not-a-32-byte-key",
    };
    const result = run(env);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "ECORIONE_CONNECT_VAULT_MASTER_KEY harus tepat 32 byte",
    );
  });
});
