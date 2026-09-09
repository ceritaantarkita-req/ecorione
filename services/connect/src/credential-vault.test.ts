import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
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
      { provider: "anthropic", purpose: "messages", generation: 1, updatedAt: NOW },
    ]);
    if (process.platform !== "win32") expect(statSync(path).mode & 0o777).toBe(0o600);
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
