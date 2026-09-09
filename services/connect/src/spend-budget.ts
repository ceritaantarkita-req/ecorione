import { randomBytes } from "node:crypto";
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
import { OperationIdSchema, type OperationId, type Timestamp } from "@ecorione/shared-schema";
import { z } from "zod";

const TimestampSchema = z.string().datetime({ offset: false });
const NonNegativeUsdSchema = z.number().finite().nonnegative();
const PositiveUsdSchema = z.number().finite().positive();
const ReservationIdSchema = z.string().regex(/^spend_[a-f0-9]{32}$/);
const SpendStatusSchema = z.enum(["reserved", "uncertain", "settled"]);

const SpendEntrySchema = z.object({
  reservationId: ReservationIdSchema,
  operationId: OperationIdSchema,
  provider: z.literal("anthropic"),
  model: z.string().min(1),
  reservedUsd: PositiveUsdSchema,
  actualUsd: NonNegativeUsdSchema.nullable(),
  status: SpendStatusSchema,
  createdAt: TimestampSchema,
  settledAt: TimestampSchema.nullable(),
});
export type SpendEntry = z.infer<typeof SpendEntrySchema>;

const SpendFileSchema = z.object({
  version: z.literal(1),
  revision: z.number().int().nonnegative(),
  entries: z.array(SpendEntrySchema),
});
type SpendFile = z.infer<typeof SpendFileSchema>;

export interface SpendBudgetPolicy {
  readonly dailyUsd?: number | undefined;
  readonly monthlyUsd?: number | undefined;
}

export interface SpendReservationInput {
  readonly operationId: OperationId;
  readonly provider: "anthropic";
  readonly model: string;
  readonly reservedUsd: number;
  readonly now: Timestamp;
}

export interface SpendBudgetSummary {
  readonly day: string;
  readonly month: string;
  readonly dailyLimitUsd: number | null;
  readonly monthlyLimitUsd: number | null;
  readonly dailyCommittedUsd: number;
  readonly monthlyCommittedUsd: number;
  readonly unsettledReservations: number;
}

const EMPTY_SPEND: SpendFile = { version: 1, revision: 0, entries: [] };
const USD_EPSILON = 1e-9;

export class SpendBudgetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpendBudgetError";
  }
}

export class SpendBudgetFormatError extends SpendBudgetError {
  constructor(message: string) {
    super(`Spend budget store tidak valid: ${message}`);
    this.name = "SpendBudgetFormatError";
  }
}

export class SpendBudgetBusyError extends SpendBudgetError {
  constructor(lockPath: string) {
    super(`Spend budget lock sedang aktif: ${lockPath}. Hosted call ditolak fail-closed.`);
    this.name = "SpendBudgetBusyError";
  }
}

export class SpendBudgetExceededError extends SpendBudgetError {
  readonly period: "daily" | "monthly";
  readonly limitUsd: number;
  readonly committedUsd: number;
  readonly requestedReserveUsd: number;

  constructor(input: {
    period: "daily" | "monthly";
    limitUsd: number;
    committedUsd: number;
    requestedReserveUsd: number;
  }) {
    super(
      `Hosted ${input.period} spend budget terlampaui: committed/reserved $${input.committedUsd.toFixed(6)} + reservation $${input.requestedReserveUsd.toFixed(6)} > limit $${input.limitUsd.toFixed(6)}.`,
    );
    this.name = "SpendBudgetExceededError";
    this.period = input.period;
    this.limitUsd = input.limitUsd;
    this.committedUsd = input.committedUsd;
    this.requestedReserveUsd = input.requestedReserveUsd;
  }
}

export class SpendReservationNotFoundError extends SpendBudgetError {
  constructor(reservationId: string) {
    super(`Spend reservation tidak ditemukan: ${reservationId}.`);
    this.name = "SpendReservationNotFoundError";
  }
}

export class SpendReservationConflictError extends SpendBudgetError {
  constructor(reservationId: string) {
    super(`Spend reservation sudah settled dengan nilai berbeda: ${reservationId}.`);
    this.name = "SpendReservationConflictError";
  }
}

function normalizePolicy(policy: SpendBudgetPolicy): SpendBudgetPolicy {
  const parsed = z
    .object({
      dailyUsd: PositiveUsdSchema.optional(),
      monthlyUsd: PositiveUsdSchema.optional(),
    })
    .parse(policy);
  if (parsed.dailyUsd === undefined && parsed.monthlyUsd === undefined) {
    throw new SpendBudgetFormatError("minimal dailyUsd atau monthlyUsd harus dikonfigurasi.");
  }
  return parsed;
}

export function parseOptionalBudgetUsd(
  name: string,
  value: string | undefined,
): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new SpendBudgetFormatError(`${name} harus angka USD positif.`);
  }
  return parsed;
}

function dayKey(timestamp: string): string {
  return timestamp.slice(0, 10);
}

function monthKey(timestamp: string): string {
  return timestamp.slice(0, 7);
}

function committedUsd(entry: SpendEntry): number {
  return entry.status === "settled" && entry.actualUsd !== null
    ? entry.actualUsd
    : entry.reservedUsd;
}

function readSpend(path: string): SpendFile {
  if (!existsSync(path)) return { ...EMPTY_SPEND, entries: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    throw new SpendBudgetFormatError(error instanceof Error ? error.message : String(error));
  }
  try {
    const state = SpendFileSchema.parse(parsed);
    const ids = new Set<string>();
    for (const entry of state.entries) {
      if (ids.has(entry.reservationId)) {
        throw new SpendBudgetFormatError(`reservationId duplikat: ${entry.reservationId}.`);
      }
      ids.add(entry.reservationId);
    }
    return state;
  } catch (error) {
    if (error instanceof SpendBudgetFormatError) throw error;
    throw new SpendBudgetFormatError(error instanceof Error ? error.message : String(error));
  }
}

function writeSpend(path: string, state: SpendFile): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmpPath = `${path}.tmp-${String(process.pid)}`;
  writeFileSync(tmpPath, `${JSON.stringify(state, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  renameSync(tmpPath, path);
  chmodSync(path, 0o600);
}

function withSpendLock<T>(path: string, fn: () => T): T {
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
      throw new SpendBudgetBusyError(lockPath);
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

function newReservationId(): string {
  return `spend_${randomBytes(16).toString("hex")}`;
}

/**
 * Durable single-writer spend ledger at the Connect provider boundary.
 *
 * Every hosted dispatch must reserve budget before the provider call. Reserved/uncertain
 * entries count at their conservative reservation value until an actual provider cost is
 * durably settled. The filesystem lock prevents concurrent writers from admitting against
 * the same stale snapshot; a stale lock after process/host failure intentionally fails closed.
 */
export class FileSpendBudget {
  readonly policy: SpendBudgetPolicy;

  constructor(
    private readonly path: string,
    policy: SpendBudgetPolicy,
  ) {
    this.policy = normalizePolicy(policy);
  }

  reserve(input: SpendReservationInput): SpendEntry {
    const reservedUsd = PositiveUsdSchema.parse(input.reservedUsd);
    const createdAt = TimestampSchema.parse(input.now);
    return withSpendLock(this.path, () => {
      const state = readSpend(this.path);
      const currentDay = dayKey(createdAt);
      const currentMonth = monthKey(createdAt);
      const dailyCommitted = state.entries
        .filter((entry) => dayKey(entry.createdAt) === currentDay)
        .reduce((sum, entry) => sum + committedUsd(entry), 0);
      const monthlyCommitted = state.entries
        .filter((entry) => monthKey(entry.createdAt) === currentMonth)
        .reduce((sum, entry) => sum + committedUsd(entry), 0);

      if (
        this.policy.dailyUsd !== undefined &&
        dailyCommitted + reservedUsd > this.policy.dailyUsd + USD_EPSILON
      ) {
        throw new SpendBudgetExceededError({
          period: "daily",
          limitUsd: this.policy.dailyUsd,
          committedUsd: dailyCommitted,
          requestedReserveUsd: reservedUsd,
        });
      }
      if (
        this.policy.monthlyUsd !== undefined &&
        monthlyCommitted + reservedUsd > this.policy.monthlyUsd + USD_EPSILON
      ) {
        throw new SpendBudgetExceededError({
          period: "monthly",
          limitUsd: this.policy.monthlyUsd,
          committedUsd: monthlyCommitted,
          requestedReserveUsd: reservedUsd,
        });
      }

      const entry = SpendEntrySchema.parse({
        reservationId: newReservationId(),
        operationId: input.operationId,
        provider: input.provider,
        model: input.model,
        reservedUsd,
        actualUsd: null,
        status: "reserved",
        createdAt,
        settledAt: null,
      });
      writeSpend(this.path, {
        version: 1,
        revision: state.revision + 1,
        entries: [...state.entries, entry],
      });
      return entry;
    });
  }

  settle(reservationId: string, actualUsd: number, now: Timestamp): SpendEntry {
    const id = ReservationIdSchema.parse(reservationId);
    const actual = NonNegativeUsdSchema.parse(actualUsd);
    const settledAt = TimestampSchema.parse(now);
    return withSpendLock(this.path, () => {
      const state = readSpend(this.path);
      const index = state.entries.findIndex((entry) => entry.reservationId === id);
      if (index < 0) throw new SpendReservationNotFoundError(id);
      const prior = state.entries[index]!;
      if (prior.status === "settled") {
        if (prior.actualUsd !== null && Math.abs(prior.actualUsd - actual) <= USD_EPSILON) {
          return prior;
        }
        throw new SpendReservationConflictError(id);
      }
      const entry = SpendEntrySchema.parse({
        ...prior,
        actualUsd: actual,
        status: "settled",
        settledAt,
      });
      const entries = [...state.entries];
      entries[index] = entry;
      writeSpend(this.path, { version: 1, revision: state.revision + 1, entries });
      return entry;
    });
  }

  markUncertain(reservationId: string): SpendEntry {
    const id = ReservationIdSchema.parse(reservationId);
    return withSpendLock(this.path, () => {
      const state = readSpend(this.path);
      const index = state.entries.findIndex((entry) => entry.reservationId === id);
      if (index < 0) throw new SpendReservationNotFoundError(id);
      const prior = state.entries[index]!;
      if (prior.status === "settled" || prior.status === "uncertain") return prior;
      const entry = SpendEntrySchema.parse({ ...prior, status: "uncertain" });
      const entries = [...state.entries];
      entries[index] = entry;
      writeSpend(this.path, { version: 1, revision: state.revision + 1, entries });
      return entry;
    });
  }

  summary(now: Timestamp): SpendBudgetSummary {
    const timestamp = TimestampSchema.parse(now);
    const state = readSpend(this.path);
    const day = dayKey(timestamp);
    const month = monthKey(timestamp);
    return {
      day,
      month,
      dailyLimitUsd: this.policy.dailyUsd ?? null,
      monthlyLimitUsd: this.policy.monthlyUsd ?? null,
      dailyCommittedUsd: state.entries
        .filter((entry) => dayKey(entry.createdAt) === day)
        .reduce((sum, entry) => sum + committedUsd(entry), 0),
      monthlyCommittedUsd: state.entries
        .filter((entry) => monthKey(entry.createdAt) === month)
        .reduce((sum, entry) => sum + committedUsd(entry), 0),
      unsettledReservations: state.entries.filter((entry) => entry.status !== "settled").length,
    };
  }

  entries(): readonly SpendEntry[] {
    return readSpend(this.path).entries;
  }
}
