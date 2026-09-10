import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileCredentialVault } from "./credential-vault.js";
import { backupConnectState, restoreConnectState, restoreConnectVaultCiphertext } from "./backup.js";

const roots: string[] = [];
function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "ecorione-connect-backup-"));
  roots.push(root);
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function allText(root: string): string {
  const walk = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? walk(path) : [readFileSync(path, "utf8")];
    });
  return walk(root).join("\n");
}

describe("Connect backup", () => {
  it("backs up credential vault as ciphertext without the out-of-band master key", () => {
    const root = tempRoot();
    const vaultPath = join(root, "credentials.vault.json");
    const backupRoot = join(root, "backup");
    const key = Buffer.alloc(32, 7);
    const secret = "provider-key-private-value";
    const vault = new FileCredentialVault(vaultPath, key);
    vault.set("openai", "messages", secret, "2026-09-10T02:00:00.000Z");

    const result = backupConnectState(
      { credentialVaultPath: vaultPath },
      backupRoot,
      "2026-09-10T02:01:00.000Z",
    );
    expect(result.vaultCiphertext?.kind).toBe("vault-ciphertext");
    expect(allText(join(backupRoot, "connect"))).not.toContain(secret);
    expect(allText(join(backupRoot, "connect"))).not.toContain(key.toString("base64url"));

    const restored = join(root, "restored.vault.json");
    restoreConnectVaultCiphertext(
      backupRoot,
      result.vaultCiphertext!.backupId,
      restored,
      "2026-09-10T02:02:00.000Z",
    );
    expect(new FileCredentialVault(restored, key).get("openai", "messages")).toBe(secret);
  });

  it("restores non-secret Connect state as an integrity-checked bundle", () => {
    const root = tempRoot();
    const spend = join(root, "spend.json");
    const registry = join(root, "registry.json");
    writeFileSync(spend, "{\"version\":1}\n");
    writeFileSync(registry, "{\"version\":1,\"servers\":[]}\n");
    const backupRoot = join(root, "backup");
    const result = backupConnectState(
      { spendBudgetPath: spend, mcpRegistryPath: registry },
      backupRoot,
      "2026-09-10T02:00:00.000Z",
    );
    const target = join(root, "restored-state");
    const receipt = restoreConnectState(
      backupRoot,
      result.state!.backupId,
      target,
      "2026-09-10T02:01:00.000Z",
    );
    expect(readFileSync(join(target, "spend.json"), "utf8")).toContain("version");
    expect(readFileSync(join(target, "registry.json"), "utf8")).toContain("servers");
    expect(receipt.restoredDigest).toBe(result.state!.aggregateDigest);
  });
});
