import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";

export const CREDENTIAL_PROVIDERS = ["anthropic", "openai", "openrouter"] as const;
export type CredentialProvider = (typeof CREDENTIAL_PROVIDERS)[number];

export const CREDENTIAL_PURPOSES = ["messages"] as const;
export type CredentialPurpose = (typeof CREDENTIAL_PURPOSES)[number];

export interface ProviderCredentialReader {
  get(provider: CredentialProvider, purpose: CredentialPurpose): string | undefined;
}

export interface CredentialMetadata {
  readonly provider: CredentialProvider;
  readonly purpose: CredentialPurpose;
  readonly generation: number;
  readonly updatedAt: string;
}

const TimestampSchema = z.string().datetime({ offset: false });
const EncodedBytesSchema = z.string().regex(/^[A-Za-z0-9_-]+$/);
const VaultEntrySchema = z.object({
  provider: z.enum(CREDENTIAL_PROVIDERS),
  purpose: z.enum(CREDENTIAL_PURPOSES),
  generation: z.number().int().positive(),
  updatedAt: TimestampSchema,
  nonce: EncodedBytesSchema,
  ciphertext: EncodedBytesSchema,
  authTag: EncodedBytesSchema,
});
type VaultEntry = z.infer<typeof VaultEntrySchema>;

const VaultFileSchema = z.object({
  version: z.literal(1),
  revision: z.number().int().nonnegative(),
  entries: z.array(VaultEntrySchema),
});
type VaultFile = z.infer<typeof VaultFileSchema>;

const EMPTY_VAULT: VaultFile = { version: 1, revision: 0, entries: [] };
const CIPHER = "aes-256-gcm";
const NONCE_BYTES = 12;
const AUTH_TAG_BYTES = 16;

export class CredentialVaultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CredentialVaultError";
  }
}

export class CredentialVaultIntegrityError extends CredentialVaultError {
  constructor(provider: CredentialProvider, purpose: CredentialPurpose) {
    super(`Credential vault gagal autentikasi untuk ${provider}/${purpose}.`);
    this.name = "CredentialVaultIntegrityError";
  }
}

export class CredentialVaultFormatError extends CredentialVaultError {
  constructor(message: string) {
    super(`Credential vault tidak valid: ${message}`);
    this.name = "CredentialVaultFormatError";
  }
}

export function parseVaultMasterKey(encoded: string): Buffer {
  if (!/^[A-Za-z0-9_-]+$/.test(encoded)) {
    throw new CredentialVaultFormatError("master key harus base64url tanpa padding.");
  }
  const key = Buffer.from(encoded, "base64url");
  if (key.byteLength !== 32) {
    throw new CredentialVaultFormatError("master key harus tepat 32 byte.");
  }
  return key;
}

function scopeKey(provider: CredentialProvider, purpose: CredentialPurpose): string {
  return `${provider}:${purpose}`;
}

function aad(entry: Pick<VaultEntry, "provider" | "purpose" | "generation">): Buffer {
  return Buffer.from(
    `ecorione-credential-v1\0${entry.provider}\0${entry.purpose}\0${String(entry.generation)}`,
    "utf8",
  );
}

function encryptEntry(input: {
  provider: CredentialProvider;
  purpose: CredentialPurpose;
  generation: number;
  updatedAt: string;
  secret: string;
  key: Buffer;
}): VaultEntry {
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv(CIPHER, input.key, nonce, { authTagLength: AUTH_TAG_BYTES });
  const metadata = {
    provider: input.provider,
    purpose: input.purpose,
    generation: input.generation,
  };
  cipher.setAAD(aad(metadata));
  const ciphertext = Buffer.concat([cipher.update(input.secret, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return VaultEntrySchema.parse({
    ...metadata,
    updatedAt: input.updatedAt,
    nonce: nonce.toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
    authTag: authTag.toString("base64url"),
  });
}

function decryptEntry(entry: VaultEntry, key: Buffer): string {
  try {
    const decipher = createDecipheriv(CIPHER, key, Buffer.from(entry.nonce, "base64url"), {
      authTagLength: AUTH_TAG_BYTES,
    });
    decipher.setAAD(aad(entry));
    decipher.setAuthTag(Buffer.from(entry.authTag, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(entry.ciphertext, "base64url")),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  } catch {
    throw new CredentialVaultIntegrityError(entry.provider, entry.purpose);
  }
}

function readVault(path: string): VaultFile {
  if (!existsSync(path)) return { ...EMPTY_VAULT, entries: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    throw new CredentialVaultFormatError(
      error instanceof Error ? error.message : String(error),
    );
  }
  try {
    const vault = VaultFileSchema.parse(parsed);
    const scopes = new Set<string>();
    for (const entry of vault.entries) {
      const scope = scopeKey(entry.provider, entry.purpose);
      if (scopes.has(scope)) {
        throw new CredentialVaultFormatError(`scope duplikat: ${scope}.`);
      }
      scopes.add(scope);
    }
    return vault;
  } catch (error) {
    if (error instanceof CredentialVaultFormatError) throw error;
    throw new CredentialVaultFormatError(
      error instanceof Error ? error.message : String(error),
    );
  }
}

function writeVault(path: string, vault: VaultFile): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmpPath = `${path}.tmp-${String(process.pid)}`;
  writeFileSync(tmpPath, `${JSON.stringify(vault, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  renameSync(tmpPath, path);
  chmodSync(path, 0o600);
}

/**
 * Connect-owned encrypted credential store.
 *
 * The master key is supplied out-of-band and is never persisted in the vault file.
 * Reads reload the file so provider-secret rotation can take effect without a process restart.
 */
export class FileCredentialVault implements ProviderCredentialReader {
  private masterKey: Buffer;

  constructor(
    private readonly path: string,
    masterKey: string | Buffer,
  ) {
    this.masterKey = Buffer.isBuffer(masterKey)
      ? Buffer.from(masterKey)
      : parseVaultMasterKey(masterKey);
    if (this.masterKey.byteLength !== 32) {
      throw new CredentialVaultFormatError("master key harus tepat 32 byte.");
    }
  }

  get(provider: CredentialProvider, purpose: CredentialPurpose): string | undefined {
    const vault = readVault(this.path);
    const entry = vault.entries.find(
      (candidate) => candidate.provider === provider && candidate.purpose === purpose,
    );
    return entry === undefined ? undefined : decryptEntry(entry, this.masterKey);
  }

  list(): readonly CredentialMetadata[] {
    return readVault(this.path).entries.map(({ provider, purpose, generation, updatedAt }) => ({
      provider,
      purpose,
      generation,
      updatedAt,
    }));
  }

  set(
    provider: CredentialProvider,
    purpose: CredentialPurpose,
    secret: string,
    updatedAt: string,
  ): CredentialMetadata {
    if (secret.length === 0) throw new CredentialVaultFormatError("secret tidak boleh kosong.");
    let normalizedUpdatedAt: string;
    try {
      normalizedUpdatedAt = TimestampSchema.parse(updatedAt);
    } catch (error) {
      throw new CredentialVaultFormatError(
        error instanceof Error ? error.message : String(error),
      );
    }
    const vault = readVault(this.path);
    const prior = vault.entries.find(
      (candidate) => candidate.provider === provider && candidate.purpose === purpose,
    );
    const generation = (prior?.generation ?? 0) + 1;
    const next = encryptEntry({
      provider,
      purpose,
      generation,
      updatedAt: normalizedUpdatedAt,
      secret,
      key: this.masterKey,
    });
    const entries = vault.entries
      .filter((entry) => !(entry.provider === provider && entry.purpose === purpose))
      .concat(next)
      .sort((a, b) =>
        scopeKey(a.provider, a.purpose).localeCompare(scopeKey(b.provider, b.purpose)),
      );
    writeVault(this.path, { version: 1, revision: vault.revision + 1, entries });
    return { provider, purpose, generation, updatedAt: normalizedUpdatedAt };
  }

  /** Re-encrypts every entry under a new 32-byte master key as one atomic file replacement. */
  rotateMasterKey(nextMasterKey: string | Buffer): void {
    const nextKey = Buffer.isBuffer(nextMasterKey)
      ? Buffer.from(nextMasterKey)
      : parseVaultMasterKey(nextMasterKey);
    if (nextKey.byteLength !== 32) {
      throw new CredentialVaultFormatError("master key baru harus tepat 32 byte.");
    }
    const vault = readVault(this.path);
    const plaintext = vault.entries.map((entry) => ({
      entry,
      secret: decryptEntry(entry, this.masterKey),
    }));
    const entries = plaintext.map(({ entry, secret }) =>
      encryptEntry({
        provider: entry.provider,
        purpose: entry.purpose,
        generation: entry.generation,
        updatedAt: entry.updatedAt,
        secret,
        key: nextKey,
      }),
    );
    writeVault(this.path, { version: 1, revision: vault.revision + 1, entries });
    this.masterKey.fill(0);
    this.masterKey = nextKey;
  }
}
