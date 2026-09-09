/**
 * Prefix ID per entitas — `prd.md` §12.
 *
 * Setiap ID membawa tipenya sendiri. Ini bukan kosmetik: ID yang salah tempat adalah
 * kelas bug yang mahal di sistem multi-modul, dan branded type membuat compiler
 * menangkapnya tanpa biaya runtime.
 */

import { z } from "zod";

export const ID_PREFIXES = {
  workspace: "ws",
  project: "prj",
  artifact: "art",
  attachment: "att",
  multimodalDerivation: "mmd",
  operation: "op",
  device: "dev",
  workflow: "wf",
  workflowRun: "wfr",
  connection: "conn",
  event: "evt",
  memoryFact: "mem",
  episode: "epi",
  /** Sesi percakapan — mengelompokkan giliran chat di Ai, dipakai Context & Hub untuk
   * membatasi ringkasan episodik ke thread yang sedang berjalan (`prd.md` §12.1). */
  session: "sess",
} as const;

export type IdKind = keyof typeof ID_PREFIXES;
export type IdPrefix = (typeof ID_PREFIXES)[IdKind];

/**
 * Brand memakai properti bertipe, bukan `unique symbol`.
 *
 * `unique symbol` terlihat lebih rapi tapi tidak bisa dinamai saat `tsc` menghasilkan
 * `.d.ts` untuk skema Zod yang memakai ID bertipe (TS4023), dan itu menggagalkan build
 * seluruh paket. Properti fantom tidak pernah ada saat runtime dan memberi pesan error
 * yang lebih terbaca ketika ID salah tempat.
 */
export type Branded<T, B extends string> = T & { readonly __brand: B };

export type WorkspaceId = Branded<string, "ws">;
export type ProjectId = Branded<string, "prj">;
export type ArtifactId = Branded<string, "art">;
export type AttachmentId = Branded<string, "att">;
export type MultimodalDerivationId = Branded<string, "mmd">;
export type OperationId = Branded<string, "op">;
export type DeviceId = Branded<string, "dev">;
export type WorkflowId = Branded<string, "wf">;
export type WorkflowRunId = Branded<string, "wfr">;
export type ConnectionId = Branded<string, "conn">;
export type EventId = Branded<string, "evt">;
export type MemoryFactId = Branded<string, "mem">;
export type EpisodeId = Branded<string, "epi">;
export type SessionId = Branded<string, "sess">;

export interface IdTypeMap {
  workspace: WorkspaceId;
  project: ProjectId;
  artifact: ArtifactId;
  attachment: AttachmentId;
  multimodalDerivation: MultimodalDerivationId;
  operation: OperationId;
  device: DeviceId;
  workflow: WorkflowId;
  workflowRun: WorkflowRunId;
  connection: ConnectionId;
  event: EventId;
  memoryFact: MemoryFactId;
  episode: EpisodeId;
  session: SessionId;
}

/** Bagian setelah prefix: alfanumerik lowercase + `-`/`_`, minimal 1 karakter. */
const SUFFIX = /^[a-z0-9][a-z0-9_-]*$/;

export function isId<K extends IdKind>(kind: K, value: unknown): value is IdTypeMap[K] {
  if (typeof value !== "string") return false;
  const prefix = ID_PREFIXES[kind];
  if (!value.startsWith(`${prefix}_`)) return false;
  return SUFFIX.test(value.slice(prefix.length + 1));
}

export class InvalidIdError extends Error {
  constructor(kind: IdKind, value: unknown) {
    super(
      `ID tidak valid untuk "${kind}": diharapkan berawalan "${ID_PREFIXES[kind]}_", diterima ${JSON.stringify(value)}`,
    );
    this.name = "InvalidIdError";
  }
}

export function assertId<K extends IdKind>(kind: K, value: unknown): IdTypeMap[K] {
  if (!isId(kind, value)) throw new InvalidIdError(kind, value);
  return value;
}

/**
 * Membuat ID baru. `random` diinjeksikan supaya bisa dites deterministik —
 * lihat ADR-01: apa pun yang non-deterministik harus bisa dikendalikan dari luar.
 */
export function makeId<K extends IdKind>(
  kind: K,
  random: () => string = defaultRandom,
): IdTypeMap[K] {
  const suffix = random();
  if (!SUFFIX.test(suffix)) {
    throw new Error(`Suffix ID tidak valid: ${JSON.stringify(suffix)}`);
  }
  return `${ID_PREFIXES[kind]}_${suffix}` as IdTypeMap[K];
}

function defaultRandom(): string {
  return globalThis.crypto.randomUUID().replaceAll("-", "").slice(0, 24);
}

/**
 * ID artifact adalah content-addressed: `art_<sha256 hex>` (ADR-05, PRD §12).
 * Referensi artifact selalu lewat digest, tidak pernah lewat raw file path.
 */
const SHA256_HEX = /^[a-f0-9]{64}$/;

export function artifactIdFromDigest(sha256Hex: string): ArtifactId {
  const normalized = sha256Hex.toLowerCase();
  if (!SHA256_HEX.test(normalized)) {
    throw new Error(`Digest SHA-256 tidak valid: ${JSON.stringify(sha256Hex)}`);
  }
  return `art_${normalized}` as ArtifactId;
}

export function digestFromArtifactId(id: ArtifactId): string {
  return id.slice("art_".length);
}

function idSchema<K extends IdKind>(kind: K) {
  return z.string().refine((v): v is IdTypeMap[K] & string => isId(kind, v), {
    message: `Diharapkan ID berawalan "${ID_PREFIXES[kind]}_"`,
  });
}

export const WorkspaceIdSchema = idSchema("workspace");
export const ProjectIdSchema = idSchema("project");
export const ArtifactIdSchema = idSchema("artifact");
export const AttachmentIdSchema = idSchema("attachment");
export const MultimodalDerivationIdSchema = idSchema("multimodalDerivation");
export const OperationIdSchema = idSchema("operation");
export const DeviceIdSchema = idSchema("device");
export const WorkflowIdSchema = idSchema("workflow");
export const WorkflowRunIdSchema = idSchema("workflowRun");
export const ConnectionIdSchema = idSchema("connection");
export const EventIdSchema = idSchema("event");
export const MemoryFactIdSchema = idSchema("memoryFact");
export const EpisodeIdSchema = idSchema("episode");
export const SessionIdSchema = idSchema("session");
