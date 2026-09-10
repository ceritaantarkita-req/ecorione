import { z } from "zod";

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const TimestampSchema = z.string().datetime({ offset: false });
const SafeNameSchema = z.string().regex(/^[a-z0-9][a-z0-9._-]{0,127}$/);

export const DatasetSplitSchema = z.enum(["train", "eval", "regression", "none"]);
export type DatasetSplit = z.infer<typeof DatasetSplitSchema>;

export const DatasetSourceSchema = z.object({
  owner: z.string().min(1).max(64),
  kind: z.string().min(1).max(64),
  identity: z.string().min(1).max(512),
  digest: Sha256Schema,
});
export type DatasetSource = z.infer<typeof DatasetSourceSchema>;

export const DatasetInputRecordSchema = z.object({
  id: z.string().min(1).max(512),
  groupId: z.string().min(1).max(512).optional(),
  payload: z.record(z.string(), z.unknown()),
});
export type DatasetInputRecord = z.infer<typeof DatasetInputRecordSchema>;

export const DatasetSplitPolicySchema = z.object({
  trainPercent: z.number().int().min(0).max(100),
  evalPercent: z.number().int().min(0).max(100),
  regressionPercent: z.number().int().min(0).max(100),
});
export type DatasetSplitPolicy = z.infer<typeof DatasetSplitPolicySchema>;

export const DatasetReleaseRequestSchema = z.object({
  dataset: SafeNameSchema,
  schemaName: SafeNameSchema,
  schemaVersion: z.string().min(1).max(64),
  sources: z.array(DatasetSourceSchema).min(1),
  records: z.array(DatasetInputRecordSchema).min(1),
  splitPolicy: DatasetSplitPolicySchema.optional(),
});
export type DatasetReleaseRequest = z.infer<typeof DatasetReleaseRequestSchema>;

export const DatasetSanitationReportSchema = z.object({
  secretFieldsRedacted: z.number().int().nonnegative(),
  emailValuesRedacted: z.number().int().nonnegative(),
  phoneValuesRedacted: z.number().int().nonnegative(),
});
export type DatasetSanitationReport = z.infer<typeof DatasetSanitationReportSchema>;

export const DatasetQualityReportSchema = z.object({
  inputRecords: z.number().int().positive(),
  uniqueRecords: z.number().int().positive(),
  duplicateRecordsRemoved: z.number().int().nonnegative(),
  emptyPayloads: z.number().int().nonnegative(),
  splitCounts: z.object({
    train: z.number().int().nonnegative(),
    eval: z.number().int().nonnegative(),
    regression: z.number().int().nonnegative(),
    none: z.number().int().nonnegative(),
  }),
  sanitation: DatasetSanitationReportSchema,
});
export type DatasetQualityReport = z.infer<typeof DatasetQualityReportSchema>;

export const DatasetReleasedRecordSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  groupId: z.string().min(1).optional(),
  split: DatasetSplitSchema,
  digest: Sha256Schema,
  payload: z.record(z.string(), z.unknown()),
});
export type DatasetReleasedRecord = z.infer<typeof DatasetReleasedRecordSchema>;

export const DatasetReleaseManifestSchema = z.object({
  format: z.literal("ecorione.dataset-release/v1"),
  releaseId: Sha256Schema,
  dataset: SafeNameSchema,
  schemaName: SafeNameSchema,
  schemaVersion: z.string().min(1).max(64),
  createdAt: TimestampSchema,
  sources: z.array(DatasetSourceSchema).min(1),
  recordsDigest: Sha256Schema,
  quality: DatasetQualityReportSchema,
});
export type DatasetReleaseManifest = z.infer<typeof DatasetReleaseManifestSchema>;

export const BackupKindSchema = z.enum([
  "sqlite",
  "file",
  "directory",
  "bundle",
  "vault-ciphertext",
]);
export type BackupKind = z.infer<typeof BackupKindSchema>;

export const BackupEntrySchema = z.object({
  relativePath: z.string().min(1),
  digest: Sha256Schema,
  sizeBytes: z.number().int().nonnegative(),
});
export type BackupEntry = z.infer<typeof BackupEntrySchema>;

export const BackupManifestSchema = z.object({
  format: z.literal("ecorione.owner-backup/v1"),
  backupId: Sha256Schema,
  owner: z.string().min(1).max(64),
  logicalName: SafeNameSchema,
  kind: BackupKindSchema,
  createdAt: TimestampSchema,
  aggregateDigest: Sha256Schema,
  entries: z.array(BackupEntrySchema).min(1),
});
export type BackupManifest = z.infer<typeof BackupManifestSchema>;

export const RestoreReceiptSchema = z.object({
  format: z.literal("ecorione.owner-restore/v1"),
  owner: z.string().min(1).max(64),
  backupId: Sha256Schema,
  restoredAt: TimestampSchema,
  target: z.string().min(1),
  restoredDigest: Sha256Schema,
  safetyBackupId: Sha256Schema.nullable(),
});
export type RestoreReceipt = z.infer<typeof RestoreReceiptSchema>;
