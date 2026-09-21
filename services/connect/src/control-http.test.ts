import { randomBytes } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "@ecorione/shared-server";
import { describe, expect, it } from "vitest";
import { registerConnectControlRoutes } from "./control-http.js";
import { FileCredentialVault } from "./credential-vault.js";
import { FileRuntimeSettings } from "./runtime-settings.js";

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "ecorione-control-"));
  const runtime = new FileRuntimeSettings(join(dir, "settings.json"), {
    hostedProvider: "anthropic",
    localRuntime: "openai-compatible",
    localBaseUrl: "http://127.0.0.1:11434/v1",
    localModelTag: "local-model",
    hostedCallsEnabled: true,
  });
  const vaultPath = join(dir, "vault.json");
  const vault = new FileCredentialVault(vaultPath, randomBytes(32));
  const app = createServer({ name: "connect-test", token: "internal-secret" });
  registerConnectControlRoutes(app, { runtimeSettings: runtime, credentialVault: vault });
  return { app, runtime, vault, vaultPath };
}

const auth = { authorization: "Bearer internal-secret" };

describe("Connect Control Center boundary", () => {
  it("menolak settings tanpa internal bearer token", async () => {
    const { app } = fixture();
    const response = await app.inject({ method: "GET", url: "/v1/settings/runtime" });
    expect(response.statusCode).toBe(401);
  });

  it("mengubah runtime revision tanpa melewati schema owner", async () => {
    const { app, runtime } = fixture();
    const response = await app.inject({
      method: "PUT",
      url: "/v1/settings/runtime",
      headers: { ...auth, "content-type": "application/json" },
      payload: {
        hostedProvider: "openai",
        hostedCallsEnabled: false,
        defaultChatTarget: "hosted",
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      revision: 1,
      settings: {
        hostedProvider: "openai",
        hostedCallsEnabled: false,
        defaultChatTarget: "hosted",
      },
    });
    expect(runtime.get().settings.hostedProvider).toBe("openai");
    expect(runtime.get().settings.defaultChatTarget).toBe("hosted");
  });

  it("mengekspos provider catalog metadata tanpa credential plaintext", async () => {
    const { app } = fixture();
    const response = await app.inject({
      method: "GET",
      url: "/v1/settings/providers",
      headers: auth,
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain("secret");
    expect(response.json().providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "anthropic",
          displayName: "Claude / Anthropic",
          routingReady: true,
          connectionTestReady: true,
          hostedModels: expect.arrayContaining([
            expect.objectContaining({
              id: "claude-sonnet-4-5-20250929",
              displayName: "Claude Sonnet 4.5",
            }),
          ]),
        }),
        expect.objectContaining({
          id: "openrouter",
          routingReady: true,
          hostedModels: [
            expect.objectContaining({ id: "claude-sonnet-4-5-20250929" }),
            expect.objectContaining({ id: "claude-opus-4-1-20250805" }),
          ],
        }),
        expect.objectContaining({
          id: "kimi",
          routingReady: false,
          connectionTestReady: false,
          hostedModels: [],
        }),
      ]),
    );
  });

  it("mengklasifikasikan contention credential vault sebagai 503 yang retryable", async () => {
    const { app, vaultPath } = fixture();
    writeFileSync(`${vaultPath}.lock`, "locked\n", "utf8");

    const response = await app.inject({
      method: "PUT",
      url: "/v1/settings/credentials/openai",
      headers: { ...auth, "content-type": "application/json" },
      payload: { secret: "provider-secret" },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json().error).toMatchObject({
      type: "CREDENTIAL_VAULT_BUSY",
      message: "Credential vault sedang dipakai; coba lagi.",
    });
    expect(response.body).not.toContain(vaultPath);
  });

  it("menerima plaintext credential sekali, menyimpan terenkripsi, dan tidak meng-echo secret", async () => {
    const { app, vault } = fixture();
    const secret = "provider-secret-value-that-must-not-echo";
    const response = await app.inject({
      method: "PUT",
      url: "/v1/settings/credentials/openai",
      headers: { ...auth, "content-type": "application/json" },
      payload: { secret },
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain(secret);
    expect(response.json()).toMatchObject({
      provider: "openai",
      purpose: "messages",
      generation: 1,
    });
    expect(vault.get("openai", "messages")).toBe(secret);

    const listed = await app.inject({
      method: "GET",
      url: "/v1/settings/credentials",
      headers: auth,
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.body).not.toContain(secret);
    expect(listed.json().credentials[0]).toMatchObject({ provider: "openai", generation: 1 });
  });
});
