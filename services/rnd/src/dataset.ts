import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  DatasetReleaseManifestSchema,
  DatasetReleaseRequestSchema,
  type DatasetInputRecord,
  type DatasetQualityReport,
  type DatasetReleaseManifest,
  type DatasetReleaseRequest,
  type DatasetReleasedRecord,
  type DatasetSplit,
  type DatasetSplitPolicy,
} from "@ecorione/shared-schema";
import { z } from "zod";

const RegistryFileSchema = z.object({
  format: z.literal("ecorione.dataset-registry/v1"),
  revision: z.number().int().nonnegative(),
  releases: z.array(
    z.object({
      releaseId: z.string().regex(/^[a-f0-9]{64}$/),
      dataset: z.string().min(1),
      schemaName: z.string().min(1),
      schemaVersion: z.string().min(1),
      createdAt: z.string().datetime({ offset: false }),
    }),
  ),
});
type RegistryFile = z.infer<typeof RegistryFileSchema>;

const EMPTY_REGISTRY: RegistryFile = {
  format: "ecorione.dataset-registry/v1",
  revision: 0,
  releases: [],
};

const SECRET_FIELD =
  /^(?:authorization|password|passwd|secret|api[-_]?key|access[-_]?token|refresh[-_]?token|credential)$/i;
const EMAIL_VALUE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_VALUE = /(?<!\w)\+?[0-9][0-9 ()-]{7,}[0-9](?!\w)/g;
const BEARER_VALUE = /\bBearer\s+[A-Za-z0-9._~+/-]{12,}\b/gi;

export class DatasetGovernanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatasetGovernanceError";
  }
}

function digest(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonical(item)).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
}

interface MutableSanitationReport {
  secretFieldsRedacted: number;
  emailValuesRedacted: number;
  phoneValuesRedacted: number;
}

function sanitizeString(value: string, report: MutableSanitationReport): string {
  let sanitized = value.replace(BEARER_VALUE, () => {
    report.secretFieldsRedacted += 1;
    return "[REDACTED:SECRET]";
  });
  sanitized = sanitized.replace(EMAIL_VALUE, () => {
    report.emailValuesRedacted += 1;
    return "[REDACTED:EMAIL]";
  });
  sanitized = sanitized.replace(PHONE_VALUE, () => {
    report.phoneValuesRedacted += 1;
    return "[REDACTED:PHONE]";
  });
  return sanitized;
}

function sanitizeValue(value: unknown, report: MutableSanitationReport): unknown {
  if (typeof value === "string") return sanitizeString(value, report);
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item, report));
  if (value !== null && typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_FIELD.test(key)) {
        report.secretFieldsRedacted += 1;
        next[key] = "[REDACTED:SECRET]";
      } else {
        next[key] = sanitizeValue(item, report);
      }
    }
    return next;
  }
  return value;
}

function validateSplitPolicy(policy: DatasetSplitPolicy | undefined): void {
  if (policy === undefined) return;
  if (policy.trainPercent + policy.evalPercent + policy.regressionPercent !== 100) {
    throw new DatasetGovernanceError("persentase train/eval/regression harus berjumlah 100");
  }
}

function splitFor(
  dataset: string,
  record: DatasetInputRecord,
  policy: DatasetSplitPolicy | undefined,
): DatasetSplit {
  if (policy === undefined) return "none";
  const group = record.groupId ?? record.id;
  const bucket = Number.parseInt(digest(`${dataset}\0${group}`).slice(0, 8), 16) % 100;
  if (bucket < policy.trainPercent) return "train";
  if (bucket < policy.trainPercent + policy.evalPercent) return "eval";
  return "regression";
}

function readRegistry(path: string): RegistryFile {
  if (!existsSync(path)) return { ...EMPTY_REGISTRY, releases: [] };
  try {
    return RegistryFileSchema.parse(JSON.parse(readFileSync(path, "utf8")) as unknown);
  } catch (error) {
    throw new DatasetGovernanceError(
      `dataset registry tidak valid: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function writeRegistry(path: string, state: RegistryFile): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temp = `${path}.tmp-${randomUUID()}`;
  writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  renameSync(temp, path);
}

function withLock<T>(path: string, work: () => T): T {
  const lockPath = `${path}.lock`;
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  let fd: number;
  try {
    fd = openSync(lockPath, "wx", 0o600);
  } catch (error) {
    throw new DatasetGovernanceError(
      `dataset registry sedang dipakai: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  try {
    return work();
  } finally {
    closeSync(fd);
    rmSync(lockPath, { force: true });
  }
}

function buildRecords(
  request: DatasetReleaseRequest,
  report: MutableSanitationReport,
): readonly DatasetReleasedRecord[] {
  const byDigest = new Map<string, DatasetReleasedRecord>();
  const sourceIds = new Set<string>();
  for (const record of request.records) {
    if (sourceIds.has(record.id))
      throw new DatasetGovernanceError(`record id duplikat: ${record.id}`);
    sourceIds.add(record.id);
    const payload = sanitizeValue(record.payload, report) as Record<string, unknown>;
    const payloadDigest = digest(canonical(payload));
    if (byDigest.has(payloadDigest)) continue;
    const releaseRecord: DatasetReleasedRecord = {
      id: digest(`${request.dataset}\0${record.id}\0${payloadDigest}`),
      sourceId: record.id,
      ...(record.groupId === undefined ? {} : { groupId: record.groupId }),
      split: splitFor(request.dataset, record, request.splitPolicy),
      digest: payloadDigest,
      payload,
    };
    byDigest.set(payloadDigest, releaseRecord);
  }
  return [...byDigest.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function quality(
  inputCount: number,
  records: readonly DatasetReleasedRecord[],
  sanitation: MutableSanitationReport,
): DatasetQualityReport {
  const splitCounts = { train: 0, eval: 0, regression: 0, none: 0 };
  let emptyPayloads = 0;
  for (const record of records) {
    splitCounts[record.split] += 1;
    if (Object.keys(record.payload).length === 0) emptyPayloads += 1;
  }
  if (records.length === 0)
    throw new DatasetGovernanceError("release dataset kosong setelah dedupe");
  if (emptyPayloads > 0)
    throw new DatasetGovernanceError("payload dataset kosong ditolak quality gate");
  return {
    inputRecords: inputCount,
    uniqueRecords: records.length,
    duplicateRecordsRemoved: inputCount - records.length,
    emptyPayloads,
    splitCounts,
    sanitation: { ...sanitation },
  };
}

/** RnD-owned immutable dataset release registry. */
export class DatasetRegistry {
  readonly root: string;
  private readonly registryPath: string;

  constructor(root: string) {
    this.root = resolve(root);
    this.registryPath = join(this.root, "registry.json");
    mkdirSync(this.root, { recursive: true, mode: 0o700 });
  }

  private register(manifest: DatasetReleaseManifest): void {
    const state = readRegistry(this.registryPath);
    if (state.releases.some((entry) => entry.releaseId === manifest.releaseId)) return;
    writeRegistry(this.registryPath, {
      format: "ecorione.dataset-registry/v1",
      revision: state.revision + 1,
      releases: state.releases
        .concat({
          releaseId: manifest.releaseId,
          dataset: manifest.dataset,
          schemaName: manifest.schemaName,
          schemaVersion: manifest.schemaVersion,
          createdAt: manifest.createdAt,
        })
        .sort((a, b) => a.releaseId.localeCompare(b.releaseId)),
    });
  }

  release(input: DatasetReleaseRequest, createdAt: string): DatasetReleaseManifest {
    const request = DatasetReleaseRequestSchema.parse(input);
    validateSplitPolicy(request.splitPolicy);
    const sanitation: MutableSanitationReport = {
      secretFieldsRedacted: 0,
      emailValuesRedacted: 0,
      phoneValuesRedacted: 0,
    };
    const records = buildRecords(request, sanitation);
    const report = quality(request.records.length, records, sanitation);
    const recordsText = `${records.map((record) => canonical(record)).join("\n")}\n`;
    const recordsDigest = digest(recordsText);
    const releaseId = digest(
      canonical({
        format: "ecorione.dataset-release/v1",
        dataset: request.dataset,
        schemaName: request.schemaName,
        schemaVersion: request.schemaVersion,
        sources: request.sources,
        recordsDigest,
        quality: report,
      }),
    );
    const manifest = DatasetReleaseManifestSchema.parse({
      format: "ecorione.dataset-release/v1",
      releaseId,
      dataset: request.dataset,
      schemaName: request.schemaName,
      schemaVersion: request.schemaVersion,
      createdAt,
      sources: request.sources,
      recordsDigest,
      quality: report,
    });
    return withLock(this.registryPath, () => {
      const releaseRoot = join(this.root, "releases", releaseId);
      if (existsSync(releaseRoot)) {
        const existing = this.get(releaseId);
        this.register(existing);
        return existing;
      }
      const staging = `${releaseRoot}.tmp-${randomUUID()}`;
      mkdirSync(staging, { recursive: true, mode: 0o700 });
      try {
        writeFileSync(join(staging, "records.ndjson"), recordsText, {
          mode: 0o600,
          flag: "wx",
        });
        writeFileSync(
          join(staging, "manifest.json"),
          `${JSON.stringify(manifest, null, 2)}\n`,
          {
            mode: 0o600,
            flag: "wx",
          },
        );
        mkdirSync(dirname(releaseRoot), { recursive: true, mode: 0o700 });
        renameSync(staging, releaseRoot);
      } catch (error) {
        rmSync(staging, { recursive: true, force: true });
        throw error;
      }
      this.register(manifest);
      return manifest;
    });
  }

  list(dataset?: string): readonly DatasetReleaseManifest[] {
    const state = readRegistry(this.registryPath);
    return state.releases
      .filter((entry) => dataset === undefined || entry.dataset === dataset)
      .map((entry) => this.get(entry.releaseId));
  }

  get(releaseId: string): DatasetReleaseManifest {
    if (!/^[a-f0-9]{64}$/.test(releaseId))
      throw new DatasetGovernanceError("release id tidak valid");
    const root = join(this.root, "releases", releaseId);
    if (!existsSync(root))
      throw new DatasetGovernanceError(`release tidak ditemukan: ${releaseId}`);
    const manifest = DatasetReleaseManifestSchema.parse(
      JSON.parse(readFileSync(join(root, "manifest.json"), "utf8")) as unknown,
    );
    if (manifest.releaseId !== releaseId)
      throw new DatasetGovernanceError("release manifest id mismatch");
    const recordsText = readFileSync(join(root, "records.ndjson"), "utf8");
    if (digest(recordsText) !== manifest.recordsDigest) {
      throw new DatasetGovernanceError("records digest release tidak cocok");
    }
    const computed = digest(
      canonical({
        format: manifest.format,
        dataset: manifest.dataset,
        schemaName: manifest.schemaName,
        schemaVersion: manifest.schemaVersion,
        sources: manifest.sources,
        recordsDigest: manifest.recordsDigest,
        quality: manifest.quality,
      }),
    );
    if (computed !== releaseId)
      throw new DatasetGovernanceError("release identity tidak cocok");
    return manifest;
  }
}
