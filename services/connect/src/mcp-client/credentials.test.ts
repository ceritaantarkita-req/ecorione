import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TimestampSchema } from "@ecorione/shared-schema";
import { afterEach, describe, expect, it } from "vitest";
import { FileCredentialVault } from "../credential-vault.js";
import { VaultMcpCredentialEditor, VaultMcpCredentialReader } from "./credentials.js";

const dirs: string[] = [];
function vaultPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "ecorione-mcp-credentials-"));
  dirs.push(dir);
  return join(dir, "vault.json");
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const now = TimestampSchema.parse("2026-09-09T12:00:00.000Z");

describe("VaultMcpCredentialReader", () => {
  it("stores named secrets encrypted and lists only references", () => {
    const path = vaultPath();
    const vault = new FileCredentialVault(path, Buffer.alloc(32, 7));
    const editor = new VaultMcpCredentialEditor(vault);
    editor.set("github/read", "super-secret-token", now);
    editor.set("search/read", "another-token", now);

    const reader = new VaultMcpCredentialReader(vault);
    expect(reader.get("github/read")).toBe("super-secret-token");
    expect(reader.listRefs()).toEqual(["github/read", "search/read"]);
    const raw = readFileSync(path, "utf8");
    expect(raw).not.toContain("super-secret-token");
    expect(raw).not.toContain("another-token");
  });

  it("supports rotation of an individual named MCP secret without process restart", () => {
    const path = vaultPath();
    const vault = new FileCredentialVault(path, Buffer.alloc(32, 9));
    const editor = new VaultMcpCredentialEditor(vault);
    const reader = new VaultMcpCredentialReader(vault);
    editor.set("remote/token", "first", now);
    expect(reader.get("remote/token")).toBe("first");
    editor.set("remote/token", "second", now);
    expect(reader.get("remote/token")).toBe("second");
  });

  it("removes named secret without exposing other values", () => {
    const path = vaultPath();
    const vault = new FileCredentialVault(path, Buffer.alloc(32, 3));
    const editor = new VaultMcpCredentialEditor(vault);
    editor.set("a/token", "alpha", now);
    editor.set("b/token", "beta", now);
    expect(editor.remove("a/token", now)).toBe(true);
    expect(editor.get("a/token")).toBeUndefined();
    expect(editor.get("b/token")).toBe("beta");
  });
});
