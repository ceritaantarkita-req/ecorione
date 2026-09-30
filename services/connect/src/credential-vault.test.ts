import { createCipheriv } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  AI_CREDENTIAL_PROVIDERS,
  CredentialVaultBusyError,
  CredentialVaultFormatError,
  CredentialVaultIntegrityError,
  FileCredentialVault,
  parseVaultMasterKey,
} from "./credential-vault.js";

const dirs: string[] = [];
const NOW = "2026-09-09T09:00:00.000Z";
function master(fill: number): string {
  return Buffer.alloc(32, fill).toString("base64url");
}
function vaultPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "ecorione-vault-"));
  dirs.push(dir);
  return join(dir, "credentials.vault.json");
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("FileCredentialVault", () => {
  it("menyimpan ciphertext at-rest dan hanya membuka scope provider/purpose yang tepat", () => {
    const path = vaultPath();
    const vault = new FileCredentialVault(path, master(1));
    vault.set("anthropic", "messages", "provider-secret-alpha", NOW);

    const persisted = readFileSync(path, "utf8");
    expect(persisted).not.toContain("provider-secret-alpha");
    expect(vault.get("anthropic", "messages")).toBe("provider-secret-alpha");
    expect(vault.get("openai", "messages")).toBeUndefined();
    expect(vault.list()).toEqual([
      {
        provider: "anthropic",
        purpose: "messages",
        connectionId: "default",
        label: "Primary",
        enabled: true,
        priority: 100,
        generation: 1,
        updatedAt: NOW,
      },
    ]);
    if (process.platform !== "win32") expect(statSync(path).mode & 0o777).toBe(0o600);
  });

  it("menerima seluruh provider AI onboarding tanpa mengubah scope secret", () => {
    const path = vaultPath();
    const vault = new FileCredentialVault(path, master(8));

    for (const provider of AI_CREDENTIAL_PROVIDERS) {
      const secret = `secret-${provider}`;
      vault.set(provider, "messages", secret, NOW);
      expect(vault.get(provider, "messages")).toBe(secret);
    }

    const persisted = readFileSync(path, "utf8");
    for (const provider of AI_CREDENTIAL_PROVIDERS) {
      expect(persisted).not.toContain(`secret-${provider}`);
    }
    expect(vault.list()).toHaveLength(AI_CREDENTIAL_PROVIDERS.length);
  });

  it("menyimpan beberapa AI Connection per provider dan memilih prioritas enabled tertinggi", () => {
    const path = vaultPath();
    const vault = new FileCredentialVault(path, master(11));

    const primary = vault.addConnection(
      "openrouter",
      "messages",
      "router-key-primary",
      NOW,
      { connectionId: "router_primary", label: "Primary", priority: 100 },
    );
    const backup = vault.addConnection(
      "openrouter",
      "messages",
      "router-key-backup",
      "2026-09-09T09:01:00.000Z",
      { connectionId: "router_backup", label: "Backup", priority: 200 },
    );

    expect(primary.connectionId).toBe("router_primary");
    expect(backup.connectionId).toBe("router_backup");
    expect(vault.get("openrouter", "messages")).toBe("router-key-primary");
    expect(vault.candidates("openrouter", "messages").map((item) => item.connectionId)).toEqual([
      "router_primary",
      "router_backup",
    ]);

    vault.updateConnection(
      "openrouter",
      "messages",
      "router_backup",
      { priority: 50 },
      "2026-09-09T09:02:00.000Z",
    );
    expect(vault.get("openrouter", "messages")).toBe("router-key-backup");

    vault.updateConnection(
      "openrouter",
      "messages",
      "router_backup",
      { enabled: false },
      "2026-09-09T09:03:00.000Z",
    );
    expect(vault.get("openrouter", "messages")).toBe("router-key-primary");
    expect(vault.candidates("openrouter", "messages")).toHaveLength(1);

    const persisted = readFileSync(path, "utf8");
    expect(persisted).not.toContain("router-key-primary");
    expect(persisted).not.toContain("router-key-backup");
    expect(JSON.parse(persisted).version).toBe(2);
  });

  it("legacy set mengganti primary tanpa menghapus backup dan remove legacy memutus seluruh provider", () => {
    const path = vaultPath();
    const vault = new FileCredentialVault(path, master(12));
    vault.set("openai", "messages", "primary-v1", NOW);
    vault.addConnection(
      "openai",
      "messages",
      "backup",
      "2026-09-09T09:01:00.000Z",
      { connectionId: "backup", priority: 200 },
    );

    const updated = vault.set(
      "openai",
      "messages",
      "primary-v2",
      "2026-09-09T09:02:00.000Z",
    );
    expect(updated.connectionId).toBe("default");
    expect(updated.generation).toBe(2);
    expect(vault.candidates("openai", "messages").map((item) => item.secret)).toEqual([
      "primary-v2",
      "backup",
    ]);

    expect(vault.remove("openai", "messages")).toBe(true);
    expect(vault.candidates("openai", "messages")).toEqual([]);
  });

  it("metadata routing v2 ikut AAD sehingga priority tamper gagal tertutup", () => {
    const path = vaultPath();
    const vault = new FileCredentialVault(path, master(13));
    vault.addConnection(
      "openrouter",
      "messages",
      "tamper-routing-secret",
      NOW,
      { connectionId: "route_a", priority: 100 },
    );
    const parsed = JSON.parse(readFileSync(path, "utf8")) as {
      entries: Array<{ priority: number }>;
    };
    const entry = parsed.entries[0];
    if (entry === undefined) throw new Error("fixture entry hilang");
    entry.priority = 1;
    writeFileSync(path, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");

    expect(() => vault.get("openrouter", "messages")).toThrow(
      CredentialVaultIntegrityError,
    );
  });

  it("membaca vault v1 lama dan memigrasikannya atomik saat mutation pertama", () => {
    const path = vaultPath();
    const key = Buffer.alloc(32, 14);
    const nonce = Buffer.alloc(12, 3);
    const cipher = createCipheriv("aes-256-gcm", key, nonce, { authTagLength: 16 });
    cipher.setAAD(
      Buffer.from("ecorione-credential-v1\0openai\0messages\01", "utf8"),
    );
    const ciphertext = Buffer.concat([
      cipher.update("legacy-openai-secret", "utf8"),
      cipher.final(),
    ]);
    writeFileSync(
      path,
      `${JSON.stringify(
        {
          version: 1,
          revision: 7,
          entries: [
            {
              provider: "openai",
              purpose: "messages",
              generation: 1,
              updatedAt: NOW,
              nonce: nonce.toString("base64url"),
              ciphertext: ciphertext.toString("base64url"),
              authTag: cipher.getAuthTag().toString("base64url"),
            },
          ],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const vault = new FileCredentialVault(path, key);
    expect(vault.get("openai", "messages")).toBe("legacy-openai-secret");
    expect(vault.list()[0]).toMatchObject({
      connectionId: "default",
      label: "Primary",
      enabled: true,
      priority: 100,
    });

    vault.addConnection(
      "openai",
      "messages",
      "legacy-backup",
      "2026-09-09T09:04:00.000Z",
      { connectionId: "backup" },
    );
    const migrated = JSON.parse(readFileSync(path, "utf8")) as {
      version: number;
      revision: number;
      entries: unknown[];
    };
    expect(migrated.version).toBe(2);
    expect(migrated.revision).toBe(8);
    expect(migrated.entries).toHaveLength(2);
    expect(vault.get("openai", "messages")).toBe("legacy-openai-secret");
  });

  it("rotasi credential menaikkan generation dan provider membaca nilai terbaru tanpa restart", () => {
    const path = vaultPath();
    const vault = new FileCredentialVault(path, master(2));
    vault.set("anthropic", "messages", "first-value", NOW);
    const rotatedAt = "2026-09-09T09:10:00.000Z";
    const metadata = vault.set("anthropic", "messages", "second-value", rotatedAt);

    expect(metadata.generation).toBe(2);
    expect(vault.get("anthropic", "messages")).toBe("second-value");
    const persisted = readFileSync(path, "utf8");
    expect(persisted).not.toContain("first-value");
    expect(persisted).not.toContain("second-value");
  });

  it("rotasi master key re-encrypt atomically; key lama gagal dan key baru berhasil", () => {
    const path = vaultPath();
    const oldKey = master(3);
    const newKey = master(4);
    const vault = new FileCredentialVault(path, oldKey);
    vault.set("anthropic", "messages", "rotatable-secret", NOW);
    const before = readFileSync(path, "utf8");

    vault.rotateMasterKey(newKey);

    const after = readFileSync(path, "utf8");
    expect(after).not.toBe(before);
    expect(vault.get("anthropic", "messages")).toBe("rotatable-secret");
    expect(() => new FileCredentialVault(path, oldKey).get("anthropic", "messages")).toThrow(
      CredentialVaultIntegrityError,
    );
    expect(new FileCredentialVault(path, newKey).get("anthropic", "messages")).toBe(
      "rotatable-secret",
    );
  });

  it("tamper ciphertext gagal tertutup", () => {
    const path = vaultPath();
    const vault = new FileCredentialVault(path, master(5));
    vault.set("anthropic", "messages", "tamper-target", NOW);
    const parsed = JSON.parse(readFileSync(path, "utf8")) as {
      entries: Array<{ ciphertext: string }>;
    };
    const entry = parsed.entries[0];
    if (entry === undefined) throw new Error("fixture entry hilang");
    const current = entry.ciphertext;
    if (current.length === 0) throw new Error("fixture ciphertext kosong");
    entry.ciphertext = `${current.startsWith("A") ? "B" : "A"}${current.slice(1)}`;
    writeFileSync(path, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");

    expect(() => vault.get("anthropic", "messages")).toThrow(CredentialVaultIntegrityError);
  });

  it("menolak mutation saat lock lintas-proses aktif tanpa mengubah credential", () => {
    const path = vaultPath();
    const vault = new FileCredentialVault(path, master(9));
    vault.set("anthropic", "messages", "stable-secret", NOW);
    writeFileSync(`${path}.lock`, "locked\n", { encoding: "utf8", mode: 0o600 });

    expect(() =>
      vault.set("anthropic", "messages", "racing-secret", "2026-09-09T09:20:00.000Z"),
    ).toThrow(CredentialVaultBusyError);
    expect(() => vault.remove("anthropic", "messages")).toThrow(CredentialVaultBusyError);
    expect(() =>
      vault.addConnection(
        "anthropic",
        "messages",
        "backup",
        "2026-09-09T09:21:00.000Z",
      ),
    ).toThrow(CredentialVaultBusyError);
    expect(() => vault.rotateMasterKey(master(10))).toThrow(CredentialVaultBusyError);
    expect(vault.get("anthropic", "messages")).toBe("stable-secret");
  });

  it("vault malformed dan master key invalid ditolak eksplisit", () => {
    expect(() => parseVaultMasterKey("not-a-32-byte-key")).toThrow(CredentialVaultFormatError);
    const path = vaultPath();
    writeFileSync(path, "{not-json", "utf8");
    const vault = new FileCredentialVault(path, master(6));
    expect(() => vault.list()).toThrow(CredentialVaultFormatError);
  });

  it("vault yang belum dibuat mengembalikan credential missing tanpa membuat file", () => {
    const path = vaultPath();
    const vault = new FileCredentialVault(path, master(7));
    expect(vault.get("anthropic", "messages")).toBeUndefined();
  });
});
