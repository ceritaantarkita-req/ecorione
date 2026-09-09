import type { Timestamp } from "@ecorione/shared-schema";
import { z } from "zod";
import {
  CredentialVaultFormatError,
  type FileCredentialVault,
  type ProviderCredentialReader,
} from "../credential-vault.js";
import {
  McpCredentialRefSchema,
  type McpCredentialReader,
  type McpCredentialRef,
} from "./types.js";

const McpCredentialBundleSchema = z.object({
  version: z.literal(1),
  entries: z.record(McpCredentialRefSchema, z.string().min(1)),
});
type McpCredentialBundle = z.infer<typeof McpCredentialBundleSchema>;

const EMPTY_BUNDLE: McpCredentialBundle = { version: 1, entries: {} };

function parseBundle(raw: string | undefined): McpCredentialBundle {
  if (raw === undefined) return EMPTY_BUNDLE;
  try {
    return McpCredentialBundleSchema.parse(JSON.parse(raw) as unknown);
  } catch (error) {
    throw new CredentialVaultFormatError(
      `bundle mcp/tokens tidak valid: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** Named outbound MCP secrets backed by the Connect credential vault. */
export class VaultMcpCredentialReader implements McpCredentialReader {
  constructor(private readonly vault: ProviderCredentialReader) {}

  get(ref: McpCredentialRef): string | undefined {
    const key = McpCredentialRefSchema.parse(ref);
    return parseBundle(this.vault.get("mcp", "tokens")).entries[key];
  }

  listRefs(): readonly McpCredentialRef[] {
    return Object.keys(parseBundle(this.vault.get("mcp", "tokens")).entries).sort();
  }
}

/** Operator-only mutation helper; values are never returned or listed. */
export class VaultMcpCredentialEditor extends VaultMcpCredentialReader {
  constructor(private readonly writableVault: FileCredentialVault) {
    super(writableVault);
  }

  set(ref: McpCredentialRef, secret: string, now: Timestamp): void {
    const key = McpCredentialRefSchema.parse(ref);
    if (secret.length === 0) throw new CredentialVaultFormatError("MCP secret tidak boleh kosong.");
    const prior = parseBundle(this.writableVault.get("mcp", "tokens"));
    const entries = Object.fromEntries(
      Object.entries({ ...prior.entries, [key]: secret }).sort(([a], [b]) => a.localeCompare(b)),
    );
    this.writableVault.set("mcp", "tokens", JSON.stringify({ version: 1, entries }), now);
  }

  remove(ref: McpCredentialRef, now: Timestamp): boolean {
    const key = McpCredentialRefSchema.parse(ref);
    const prior = parseBundle(this.writableVault.get("mcp", "tokens"));
    if (!(key in prior.entries)) return false;
    const entries = { ...prior.entries };
    delete entries[key];
    this.writableVault.set("mcp", "tokens", JSON.stringify({ version: 1, entries }), now);
    return true;
  }
}
