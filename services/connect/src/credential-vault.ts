import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import {
  chmodSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";
import {
  AI_PROVIDER_IDS,
  CREDENTIAL_PROVIDER_IDS,
  credentialPurposeForProvider,
  type AiProviderId,
  type CredentialProviderId,
  type CredentialPurpose as CatalogCredentialPurpose,
} from "./provider-catalog.js";

export const AI_CREDENTIAL_PROVIDERS = AI_PROVIDER_IDS;
export type AiCredentialProvider = AiProviderId;

export const CREDENTIAL_PROVIDERS = CREDENTIAL_PROVIDER_IDS;
export type CredentialProvider = CredentialProviderId;

export const CREDENTIAL_PURPOSES = ["messages", "tokens"] as const;
export type CredentialPurpose = CatalogCredentialPurpose;

const LEGACY_CONNECTION_ID = "default";
const LEGACY_CONNECTION_LABEL = "Primary";
const DEFAULT_PRIORITY = 100;
const PRIORITY_STEP = 100;

function assertCredentialScope(provider: CredentialProvider, purpose: CredentialPurpose): void {
  if (credentialPurposeForProvider(provider) !== purpose) {
    throw new CredentialVaultFormatError(
      `scope credential tidak didukung: ${provider}/${purpose}.`,
    );
  }
}

export interface CredentialCandidate {
  readonly provider: CredentialProvider;
  readonly purpose: CredentialPurpose;
  readonly connectionId: string;
  readonly label: string;
  readonly priority: number;
  readonly generation: number;
  readonly secret: string;
}

export interface ProviderCredentialReader {
  /**
   * Compatibility accessor. For multi-connection scopes this resolves the highest-priority
   * enabled connection.
   */
  get(provider: CredentialProvider, purpose: CredentialPurpose): string | undefined;
  /**
   * Multi-connection dispatch surface. Older reader implementations may omit this and callers
   * must fall back to `get`.
   */
  candidates?(
    provider: CredentialProvider,
    purpose: CredentialPurpose,
  ): readonly CredentialCandidate[];
}

export interface CredentialConnectionPatch {
  readonly label?: string | undefined;
  readonly enabled?: boolean | undefined;
  readonly priority?: number | undefined;
}

export interface AddCredentialConnectionOptions {
  readonly connectionId?: string | undefined;
  readonly label?: string | undefined;
  readonly enabled?: boolean | undefined;
  readonly priority?: number | undefined;
}

export interface CredentialVaultAdmin extends ProviderCredentialReader {
  list(): readonly CredentialMetadata[];
  /** Compatibility mutation for the provider's primary connection. */
  set(
    provider: CredentialProvider,
    purpose: CredentialPurpose,
    secret: string,
    updatedAt: string,
  ): CredentialMetadata;
  /** Compatibility disconnect: removes every connection for this provider/purpose. */
  remove(provider: CredentialProvider, purpose: CredentialPurpose): boolean;
  addConnection(
    provider: CredentialProvider,
    purpose: CredentialPurpose,
    secret: string,
    updatedAt: string,
    options?: AddCredentialConnectionOptions,
  ): CredentialMetadata;
  updateConnection(
    provider: CredentialProvider,
    purpose: CredentialPurpose,
    connectionId: string,
    patch: CredentialConnectionPatch,
    updatedAt: string,
  ): CredentialMetadata;
  removeConnection(
    provider: CredentialProvider,
    purpose: CredentialPurpose,
    connectionId: string,
  ): boolean;
}

export interface CredentialMetadata {
  readonly provider: CredentialProvider;
  readonly purpose: CredentialPurpose;
  readonly connectionId: string;
  readonly label: string;
  readonly enabled: boolean;
  /** Lower number means higher dispatch priority. */
  readonly priority: number;
  readonly generation: number;
  readonly updatedAt: string;
}

const TimestampSchema = z.string().datetime({ offset: false });
const EncodedBytesSchema = z.string().regex(/^[A-Za-z0-9_-]+$/);
const ConnectionIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/);
const ConnectionLabelSchema = z.string().trim().min(1).max(80);
const PrioritySchema = z.number().int().min(0).max(1_000_000);

const VaultEntryV1Schema = z.object({
  provider: z.enum(CREDENTIAL_PROVIDERS),
  purpose: z.enum(CREDENTIAL_PURPOSES),
  generation: z.number().int().positive(),
  updatedAt: TimestampSchema,
  nonce: EncodedBytesSchema,
  ciphertext: EncodedBytesSchema,
  authTag: EncodedBytesSchema,
});
type VaultEntryV1 = z.infer<typeof VaultEntryV1Schema>;

const VaultEntryV2Schema = VaultEntryV1Schema.extend({
  connectionId: ConnectionIdSchema,
  label: ConnectionLabelSchema,
  enabled: z.boolean(),
  priority: PrioritySchema,
});
type VaultEntryV2 = z.infer<typeof VaultEntryV2Schema>;

const VaultFileV1Schema = z.object({
  version: z.literal(1),
  revision: z.number().int().nonnegative(),
  entries: z.array(VaultEntryV1Schema),
});
const VaultFileV2Schema = z.object({
  version: z.literal(2),
  revision: z.number().int().nonnegative(),
  entries: z.array(VaultEntryV2Schema),
});
type VaultFileV2 = z.infer<typeof VaultFileV2Schema>;

type NormalizedVaultEntry = VaultEntryV2 & { readonly sourceVersion: 1 | 2 };
interface NormalizedVault {
  readonly revision: number;
  readonly entries: NormalizedVaultEntry[];
}

const EMPTY_VAULT: NormalizedVault = { revision: 0, entries: [] };
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

export class CredentialVaultBusyError extends CredentialVaultError {
  constructor(path: string) {
    super(`Credential vault lock sedang aktif: ${path}.`);
    this.name = "CredentialVaultBusyError";
  }
}

export class CredentialConnectionNotFoundError extends CredentialVaultError {
  constructor(
    provider: CredentialProvider,
    purpose: CredentialPurpose,
    connectionId: string,
  ) {
    super(`AI Connection tidak ditemukan: ${provider}/${purpose}/${connectionId}.`);
    this.name = "CredentialConnectionNotFoundError";
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

function connectionKey(
  provider: CredentialProvider,
  purpose: CredentialPurpose,
  connectionId: string,
): string {
  return `${scopeKey(provider, purpose)}:${connectionId}`;
}

function legacyAad(
  entry: Pick<VaultEntryV1, "provider" | "purpose" | "generation">,
): Buffer {
  return Buffer.from(
    `ecorione-credential-v1\0${entry.provider}\0${entry.purpose}\0${String(entry.generation)}`,
    "utf8",
  );
}

function connectionAad(
  entry: Pick<
    VaultEntryV2,
    "provider" | "purpose" | "connectionId" | "label" | "enabled" | "priority" | "generation"
  >,
): Buffer {
  return Buffer.from(
    [
      "ecorione-credential-v2",
      entry.provider,
      entry.purpose,
      entry.connectionId,
      entry.label,
      entry.enabled ? "enabled" : "disabled",
      String(entry.priority),
      String(entry.generation),
    ].join("\0"),
    "utf8",
  );
}

function encryptEntry(input: {
  provider: CredentialProvider;
  purpose: CredentialPurpose;
  connectionId: string;
  label: string;
  enabled: boolean;
  priority: number;
  generation: number;
  updatedAt: string;
  secret: string;
  key: Buffer;
}): VaultEntryV2 {
  const metadata = {
    provider: input.provider,
    purpose: input.purpose,
    connectionId: ConnectionIdSchema.parse(input.connectionId),
    label: ConnectionLabelSchema.parse(input.label),
    enabled: input.enabled,
    priority: PrioritySchema.parse(input.priority),
    generation: input.generation,
  };
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv(CIPHER, input.key, nonce, { authTagLength: AUTH_TAG_BYTES });
  cipher.setAAD(connectionAad(metadata));
  const ciphertext = Buffer.concat([cipher.update(input.secret, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return VaultEntryV2Schema.parse({
    ...metadata,
    updatedAt: input.updatedAt,
    nonce: nonce.toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
    authTag: authTag.toString("base64url"),
  });
}

function decryptEntry(entry: NormalizedVaultEntry, key: Buffer): string {
  try {
    const decipher = createDecipheriv(CIPHER, key, Buffer.from(entry.nonce, "base64url"), {
      authTagLength: AUTH_TAG_BYTES,
    });
    decipher.setAAD(entry.sourceVersion === 1 ? legacyAad(entry) : connectionAad(entry));
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

function normalizeV1Entry(entry: VaultEntryV1): NormalizedVaultEntry {
  return {
    ...entry,
    connectionId: LEGACY_CONNECTION_ID,
    label: LEGACY_CONNECTION_LABEL,
    enabled: true,
    priority: DEFAULT_PRIORITY,
    sourceVersion: 1,
  };
}

function normalizeV2Entry(entry: VaultEntryV2): NormalizedVaultEntry {
  return { ...entry, sourceVersion: 2 };
}

function validateNormalizedVault(vault: NormalizedVault): NormalizedVault {
  const connections = new Set<string>();
  for (const entry of vault.entries) {
    assertCredentialScope(entry.provider, entry.purpose);
    const key = connectionKey(entry.provider, entry.purpose, entry.connectionId);
    if (connections.has(key)) {
      throw new CredentialVaultFormatError(`AI Connection duplikat: ${key}.`);
    }
    connections.add(key);
  }
  return vault;
}

function readVault(path: string): NormalizedVault {
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
    const version =
      typeof parsed === "object" && parsed !== null && "version" in parsed
        ? (parsed as { version?: unknown }).version
        : undefined;
    if (version === 1) {
      const vault = VaultFileV1Schema.parse(parsed);
      const scopes = new Set<string>();
      for (const entry of vault.entries) {
        const scope = scopeKey(entry.provider, entry.purpose);
        if (scopes.has(scope)) {
          throw new CredentialVaultFormatError(`scope duplikat: ${scope}.`);
        }
        scopes.add(scope);
      }
      return validateNormalizedVault({
        revision: vault.revision,
        entries: vault.entries.map(normalizeV1Entry),
      });
    }
    if (version === 2) {
      const vault = VaultFileV2Schema.parse(parsed);
      return validateNormalizedVault({
        revision: vault.revision,
        entries: vault.entries.map(normalizeV2Entry),
      });
    }
    throw new CredentialVaultFormatError("version harus 1 atau 2.");
  } catch (error) {
    if (error instanceof CredentialVaultFormatError) throw error;
    throw new CredentialVaultFormatError(
      error instanceof Error ? error.message : String(error),
    );
  }
}

function writeVault(path: string, vault: VaultFileV2): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmpPath = `${path}.tmp-${String(process.pid)}`;
  writeFileSync(tmpPath, `${JSON.stringify(vault, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  renameSync(tmpPath, path);
  chmodSync(path, 0o600);
}

function withVaultLock<T>(path: string, fn: () => T): T {
  mkdirSync(dirname(path), { recursive: true });
  const lockPath = `${path}.lock`;
  let fd: number;
  try {
    fd = openSync(lockPath, "wx", 0o600);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "EEXIST"
    ) {
      throw new CredentialVaultBusyError(lockPath);
    }
    throw error;
  }
  try {
    writeFileSync(fd, "locked\n", "utf8");
    return fn();
  } finally {
    closeSync(fd);
    unlinkSync(lockPath);
  }
}

function metadata(entry: NormalizedVaultEntry | VaultEntryV2): CredentialMetadata {
  return {
    provider: entry.provider,
    purpose: entry.purpose,
    connectionId: entry.connectionId,
    label: entry.label,
    enabled: entry.enabled,
    priority: entry.priority,
    generation: entry.generation,
    updatedAt: entry.updatedAt,
  };
}

function compareEntries(a: Pick<VaultEntryV2, "provider" | "purpose" | "priority" | "connectionId">, b: Pick<VaultEntryV2, "provider" | "purpose" | "priority" | "connectionId">): number {
  return (
    scopeKey(a.provider, a.purpose).localeCompare(scopeKey(b.provider, b.purpose)) ||
    a.priority - b.priority ||
    a.connectionId.localeCompare(b.connectionId)
  );
}

function normalizedTimestamp(updatedAt: string): string {
  try {
    return TimestampSchema.parse(updatedAt);
  } catch (error) {
    throw new CredentialVaultFormatError(
      error instanceof Error ? error.message : String(error),
    );
  }
}

function nextConnectionId(entries: readonly NormalizedVaultEntry[]): string {
  const used = new Set(entries.map((entry) => entry.connectionId));
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const candidate = `conn_${randomBytes(9).toString("base64url")}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new CredentialVaultError("Gagal membuat identifier AI Connection yang unik.");
}

function materializeEntries(
  vault: NormalizedVault,
  key: Buffer,
): VaultEntryV2[] {
  return vault.entries.map((entry) =>
    encryptEntry({
      provider: entry.provider,
      purpose: entry.purpose,
      connectionId: entry.connectionId,
      label: entry.label,
      enabled: entry.enabled,
      priority: entry.priority,
      generation: entry.generation,
      updatedAt: entry.updatedAt,
      secret: decryptEntry(entry, key),
      key,
    }),
  );
}

/**
 * Connect-owned encrypted credential store.
 *
 * The master key is supplied out-of-band and is never persisted in the vault file.
 * Version 1 single-slot files remain readable. The first mutation atomically writes version 2,
 * where one provider may own multiple authenticated AI Connection entries.
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
    return this.candidates(provider, purpose)[0]?.secret;
  }

  candidates(
    provider: CredentialProvider,
    purpose: CredentialPurpose,
  ): readonly CredentialCandidate[] {
    assertCredentialScope(provider, purpose);
    return readVault(this.path).entries
      .filter(
        (entry) =>
          entry.provider === provider && entry.purpose === purpose && entry.enabled,
      )
      .sort(compareEntries)
      .map((entry) => ({
        ...metadata(entry),
        secret: decryptEntry(entry, this.masterKey),
      }));
  }

  list(): readonly CredentialMetadata[] {
    return readVault(this.path).entries.sort(compareEntries).map(metadata);
  }

  set(
    provider: CredentialProvider,
    purpose: CredentialPurpose,
    secret: string,
    updatedAt: string,
  ): CredentialMetadata {
    assertCredentialScope(provider, purpose);
    if (secret.length === 0) throw new CredentialVaultFormatError("secret tidak boleh kosong.");
    const timestamp = normalizedTimestamp(updatedAt);

    return withVaultLock(this.path, () => {
      const vault = readVault(this.path);
      const scoped = vault.entries.filter(
        (entry) => entry.provider === provider && entry.purpose === purpose,
      );
      const prior =
        scoped.find((entry) => entry.connectionId === LEGACY_CONNECTION_ID) ??
        [...scoped].sort(compareEntries)[0];
      const connectionId = prior?.connectionId ?? LEGACY_CONNECTION_ID;
      const generation = (prior?.generation ?? 0) + 1;
      const replacement = encryptEntry({
        provider,
        purpose,
        connectionId,
        label: prior?.label ?? LEGACY_CONNECTION_LABEL,
        enabled: prior?.enabled ?? true,
        priority: prior?.priority ?? DEFAULT_PRIORITY,
        generation,
        updatedAt: timestamp,
        secret,
        key: this.masterKey,
      });
      const entries = materializeEntries(
        {
          revision: vault.revision,
          entries: vault.entries.filter(
            (entry) =>
              !(
                entry.provider === provider &&
                entry.purpose === purpose &&
                entry.connectionId === connectionId
              ),
          ),
        },
        this.masterKey,
      )
        .concat(replacement)
        .sort(compareEntries);
      writeVault(this.path, { version: 2, revision: vault.revision + 1, entries });
      return metadata(replacement);
    });
  }

  remove(provider: CredentialProvider, purpose: CredentialPurpose): boolean {
    assertCredentialScope(provider, purpose);
    return withVaultLock(this.path, () => {
      const vault = readVault(this.path);
      const remaining = vault.entries.filter(
        (entry) => !(entry.provider === provider && entry.purpose === purpose),
      );
      if (remaining.length === vault.entries.length) return false;
      const entries = materializeEntries(
        { revision: vault.revision, entries: remaining },
        this.masterKey,
      ).sort(compareEntries);
      writeVault(this.path, { version: 2, revision: vault.revision + 1, entries });
      return true;
    });
  }

  addConnection(
    provider: CredentialProvider,
    purpose: CredentialPurpose,
    secret: string,
    updatedAt: string,
    options: AddCredentialConnectionOptions = {},
  ): CredentialMetadata {
    assertCredentialScope(provider, purpose);
    if (purpose !== "messages") {
      throw new CredentialVaultFormatError(
        "multi-connection hanya didukung untuk credential AI messages.",
      );
    }
    if (secret.length === 0) throw new CredentialVaultFormatError("secret tidak boleh kosong.");
    const timestamp = normalizedTimestamp(updatedAt);

    return withVaultLock(this.path, () => {
      const vault = readVault(this.path);
      const scoped = vault.entries.filter(
        (entry) => entry.provider === provider && entry.purpose === purpose,
      );
      const connectionId = ConnectionIdSchema.parse(
        options.connectionId ?? nextConnectionId(vault.entries),
      );
      if (scoped.some((entry) => entry.connectionId === connectionId)) {
        throw new CredentialVaultFormatError(
          `AI Connection duplikat: ${connectionKey(provider, purpose, connectionId)}.`,
        );
      }
      const priority =
        options.priority ??
        (scoped.length === 0
          ? DEFAULT_PRIORITY
          : Math.min(
              1_000_000,
              Math.max(...scoped.map((entry) => entry.priority)) + PRIORITY_STEP,
            ));
      const entry = encryptEntry({
        provider,
        purpose,
        connectionId,
        label:
          options.label ??
          (scoped.length === 0 ? LEGACY_CONNECTION_LABEL : `Connection ${scoped.length + 1}`),
        enabled: options.enabled ?? true,
        priority,
        generation: 1,
        updatedAt: timestamp,
        secret,
        key: this.masterKey,
      });
      const entries = materializeEntries(vault, this.masterKey)
        .concat(entry)
        .sort(compareEntries);
      writeVault(this.path, { version: 2, revision: vault.revision + 1, entries });
      return metadata(entry);
    });
  }

  updateConnection(
    provider: CredentialProvider,
    purpose: CredentialPurpose,
    connectionId: string,
    patch: CredentialConnectionPatch,
    updatedAt: string,
  ): CredentialMetadata {
    assertCredentialScope(provider, purpose);
    const id = ConnectionIdSchema.parse(connectionId);
    const timestamp = normalizedTimestamp(updatedAt);
    if (
      patch.label === undefined &&
      patch.enabled === undefined &&
      patch.priority === undefined
    ) {
      throw new CredentialVaultFormatError("patch AI Connection kosong.");
    }

    return withVaultLock(this.path, () => {
      const vault = readVault(this.path);
      const prior = vault.entries.find(
        (entry) =>
          entry.provider === provider &&
          entry.purpose === purpose &&
          entry.connectionId === id,
      );
      if (prior === undefined) {
        throw new CredentialConnectionNotFoundError(provider, purpose, id);
      }
      const secret = decryptEntry(prior, this.masterKey);
      const replacement = encryptEntry({
        provider,
        purpose,
        connectionId: id,
        label:
          patch.label === undefined ? prior.label : ConnectionLabelSchema.parse(patch.label),
        enabled: patch.enabled ?? prior.enabled,
        priority:
          patch.priority === undefined ? prior.priority : PrioritySchema.parse(patch.priority),
        generation: prior.generation + 1,
        updatedAt: timestamp,
        secret,
        key: this.masterKey,
      });
      const entries = materializeEntries(
        {
          revision: vault.revision,
          entries: vault.entries.filter(
            (entry) =>
              !(
                entry.provider === provider &&
                entry.purpose === purpose &&
                entry.connectionId === id
              ),
          ),
        },
        this.masterKey,
      )
        .concat(replacement)
        .sort(compareEntries);
      writeVault(this.path, { version: 2, revision: vault.revision + 1, entries });
      return metadata(replacement);
    });
  }

  removeConnection(
    provider: CredentialProvider,
    purpose: CredentialPurpose,
    connectionId: string,
  ): boolean {
    assertCredentialScope(provider, purpose);
    const id = ConnectionIdSchema.parse(connectionId);
    return withVaultLock(this.path, () => {
      const vault = readVault(this.path);
      const remaining = vault.entries.filter(
        (entry) =>
          !(
            entry.provider === provider &&
            entry.purpose === purpose &&
            entry.connectionId === id
          ),
      );
      if (remaining.length === vault.entries.length) return false;
      const entries = materializeEntries(
        { revision: vault.revision, entries: remaining },
        this.masterKey,
      ).sort(compareEntries);
      writeVault(this.path, { version: 2, revision: vault.revision + 1, entries });
      return true;
    });
  }

  /** Re-encrypts every entry under a new 32-byte master key as one atomic file replacement. */
  rotateMasterKey(nextMasterKey: string | Buffer): void {
    const nextKey = Buffer.isBuffer(nextMasterKey)
      ? Buffer.from(nextMasterKey)
      : parseVaultMasterKey(nextMasterKey);
    if (nextKey.byteLength !== 32) {
      throw new CredentialVaultFormatError("master key baru harus tepat 32 byte.");
    }
    withVaultLock(this.path, () => {
      const vault = readVault(this.path);
      const entries = vault.entries
        .map((entry) =>
          encryptEntry({
            provider: entry.provider,
            purpose: entry.purpose,
            connectionId: entry.connectionId,
            label: entry.label,
            enabled: entry.enabled,
            priority: entry.priority,
            generation: entry.generation,
            updatedAt: entry.updatedAt,
            secret: decryptEntry(entry, this.masterKey),
            key: nextKey,
          }),
        )
        .sort(compareEntries);
      writeVault(this.path, { version: 2, revision: vault.revision + 1, entries });
      this.masterKey.fill(0);
      this.masterKey = nextKey;
    });
  }
}
