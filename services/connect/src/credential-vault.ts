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

export const AI_CREDENTIAL_PROVIDERS = [
  "anthropic",
  "openai",
  "openrouter",
  "kimi",
  "gemini",
  "qwen",
  "glm",
  "custom-openai",
] as const;
export type AiCredentialProvider = (typeof AI_CREDENTIAL_PROVIDERS)[number];

export const CREDENTIAL_PROVIDERS = [...AI_CREDENTIAL_PROVIDERS, "mcp"] as const;
export type CredentialProvider = (typeof CREDENTIAL_PROVIDERS)[number];

export const CREDENTIAL_PURPOSES = ["messages", "tokens"] as const;
export type CredentialPurpose = (typeof CREDENTIAL_PURPOSES)[number];

function assertCredentialScope(provider: CredentialProvider, purpose: CredentialPurpose): void {
  const valid =
    (provider === "mcp" && purpose === "tokens") ||
    (provider !== "mcp" && purpose === "messages");
  if (!valid) {
    throw new CredentialVaultFormatError(
      `scope credential tidak didukung: ${provider}/${purpose}.`,
    );
  }
}

export interface ProviderCredentialReader {
  get(provider: CredentialProvider, purpose: CredentialPurpose): string | undefined;
}

export interface CredentialVaultAdmin extends ProviderCredentialReader {
  list(): readonly CredentialMetadata[];
  set(
    provider: CredentialProvider,
    purpose: CredentialPurpose,
    secret: string,
    updatedAt: string,
  ): CredentialMetadata;
  remove(provider: CredentialProvider, purpose: CredentialPurpose): boolean;
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

function parseVault(raw: string): VaultFile {
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    throw new CredentialVaultFormatError("file bukan JSON valid.");
  }
  const parsed = VaultFileSchema.safeParse(value);
  if (!parsed.success) {
    throw new CredentialVaultFormatError(parsed.error.issues[0]?.message ?? "schema tidak cocok.");
  }
  for (const entry of parsed.data.entries) assertCredentialScope(entry.provider, entry.purpose);
  const keys = new Set<string>();
  for (const entry of parsed.data.entries) {
    const key = scopeKey(entry.provider, entry.purpose);
    if (keys.has(key)) throw new CredentialVaultFormatError(`scope duplikat: ${key}.`);
    keys.add(key);
  }
  return parsed.data;
}

function writeVault(path: string, next: VaultFile): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${String(process.pid)}`;
  writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  renameSync(tmp, path);
  chmodSync(path, 0o600);
}

export class FileCredentialVault implements CredentialVaultAdmin {
  private masterKey: Buffer;

  constructor(
    private readonly path: string,
    encodedMasterKey: string,
  ) {
    this.masterKey = parseVaultMasterKey(encodedMasterKey);
  }

  private read(): VaultFile {
    if (!existsSync(this.path)) return EMPTY_VAULT;
    return parseVault(readFileSync(this.path, "utf8"));
  }

  list(): readonly CredentialMetadata[] {
    return this.read().entries.map(({ provider, purpose, generation, updatedAt }) => ({
      provider,
      purpose,
      generation,
      updatedAt,
    }));
  }

  get(provider: CredentialProvider, purpose: CredentialPurpose): string | undefined {
    assertCredentialScope(provider, purpose);
    const entry = this.read().entries.find(
      (candidate) => candidate.provider === provider && candidate.purpose === purpose,
    );
    return entry === undefined ? undefined : decryptEntry(entry, this.masterKey);
  }

  set(
    provider: CredentialProvider,
    purpose: CredentialPurpose,
    secret: string,
    updatedAt: string,
  ): CredentialMetadata {
    assertCredentialScope(provider, purpose);
    if (secret.length === 0) throw new CredentialVaultFormatError("secret tidak boleh kosong.");
    const prior = this.read();
    const previous = prior.entries.find(
      (entry) => entry.provider === provider && entry.purpose === purpose,
    );
    const generation = (previous?.generation ?? 0) + 1;
    const nextEntry = encryptEntry({
      provider,
      purpose,
      generation,
      updatedAt,
      secret,
      key: this.masterKey,
    });
    const entries = prior.entries
      .filter((entry) => !(entry.provider === provider && entry.purpose === purpose))
      .concat(nextEntry)
      .sort((a, b) => scopeKey(a.provider, a.purpose).localeCompare(scopeKey(b.provider, b.purpose)));
    writeVault(this.path, {
      version: 1,
      revision: prior.revision + 1,
      entries,
    });
    return {
      provider,
      purpose,
      generation,
      updatedAt,
    };
  }

  remove(provider: CredentialProvider, purpose: CredentialPurpose): boolean {
    assertCredentialScope(provider, purpose);
    const prior = this.read();
    const entries = prior.entries.filter(
      (entry) => !(entry.provider === provider && entry.purpose === purpose),
    );
    if (entries.length === prior.entries.length) return false;
    writeVault(this.path, {
      version: 1,
      revision: prior.revision + 1,
      entries,
    });
    return true;
  }

  rotateMasterKey(nextEncodedMasterKey: string): void {
    const nextKey = parseVaultMasterKey(nextEncodedMasterKey);
    const prior = this.read();
    const entries = prior.entries.map((entry) =>
      encryptEntry({
        provider: entry.provider,
        purpose: entry.purpose,
        generation: entry.generation,
        updatedAt: entry.updatedAt,
        secret: decryptEntry(entry, this.masterKey),
        key: nextKey,
      }),
    );
    writeVault(this.path, {
      version: 1,
      revision: prior.revision + 1,
      entries,
    });
    this.masterKey = nextKey;
  }
}
