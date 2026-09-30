import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";

const RecordSchema = z
  .object({
    modelId: z.string().min(1).max(256),
    certifiedAt: z.string().datetime({ offset: false }),
    catalogFetchedAt: z.string().datetime({ offset: false }),
    responseModel: z.string().min(1).max(256),
    routingProvider: z.string().min(1).max(128).optional(),
    latencyMs: z.number().finite().nonnegative(),
    billedCostUsd: z.number().finite().positive(),
    promptPricePerToken: z.string().min(1).max(64),
    completionPricePerToken: z.string().min(1).max(64),
  })
  .strict();
export type OpenRouterCertificationRecord = z.infer<typeof RecordSchema>;

const StoreSchema = z
  .object({ version: z.literal(1), revision: z.number().int().nonnegative(), records: z.array(RecordSchema) })
  .strict();

type Store = z.infer<typeof StoreSchema>;

export interface OpenRouterCertificationReader {
  get(modelId: string): OpenRouterCertificationRecord | undefined;
  list(): readonly OpenRouterCertificationRecord[];
}

export interface OpenRouterCertificationAdmin extends OpenRouterCertificationReader {
  record(input: OpenRouterCertificationRecord): void;
}

/** Durable evidence only: callers must complete catalog and bounded provider validation first. */
export class FileOpenRouterCertificationStore implements OpenRouterCertificationAdmin {
  constructor(private readonly path: string) {}

  private read(): Store {
    if (!existsSync(this.path)) return { version: 1, revision: 0, records: [] };
    return StoreSchema.parse(JSON.parse(readFileSync(this.path, "utf8")) as unknown);
  }

  get(modelId: string): OpenRouterCertificationRecord | undefined {
    return this.read().records.find((record) => record.modelId === modelId);
  }

  list(): readonly OpenRouterCertificationRecord[] {
    return this.read().records;
  }

  record(input: OpenRouterCertificationRecord): void {
    const record = RecordSchema.parse(input);
    const prior = this.read();
    const records = [...prior.records.filter((item) => item.modelId !== record.modelId), record].sort(
      (left, right) => left.modelId.localeCompare(right.modelId),
    );
    const next = { version: 1 as const, revision: prior.revision + 1, records };
    mkdirSync(dirname(this.path), { recursive: true });
    const tmp = `${this.path}.tmp-${String(process.pid)}`;
    writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    renameSync(tmp, this.path);
    chmodSync(this.path, 0o600);
  }
}