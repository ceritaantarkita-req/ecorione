import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { assertId, type Timestamp } from "@ecorione/shared-schema";
import { afterEach, describe, expect, it } from "vitest";
import {
  FileSpendBudget,
  SpendBudgetBusyError,
  SpendBudgetExceededError,
  SpendBudgetFormatError,
  parseOptionalBudgetUsd,
} from "./spend-budget.js";

const dirs: string[] = [];
const DAY1 = "2026-09-09T09:00:00.000Z" as Timestamp;
const DAY2 = "2026-09-10T09:00:00.000Z" as Timestamp;
const NEXT_MONTH = "2026-10-01T00:00:00.000Z" as Timestamp;
const OP1 = assertId("operation", "op_budget001");
const OP2 = assertId("operation", "op_budget002");
const OP3 = assertId("operation", "op_budget003");

function spendPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "ecorione-spend-"));
  dirs.push(dir);
  return join(dir, "spend.json");
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function reserve(
  budget: FileSpendBudget,
  operationId = OP1,
  reservedUsd = 0.3,
  now = DAY1,
) {
  return budget.reserve({
    operationId,
    provider: "anthropic",
    model: "claude-sonnet-4-5-20250929",
    reservedUsd,
    now,
  });
}

describe("FileSpendBudget", () => {
  it("settled actual spend bertahan restart dan unused reservation capacity dilepas", () => {
    const path = spendPath();
    const first = new FileSpendBudget(path, { dailyUsd: 0.5 });
    const r1 = reserve(first, OP1, 0.3);
    first.settle(r1.reservationId, 0.1, DAY1);

    const restarted = new FileSpendBudget(path, { dailyUsd: 0.5 });
    reserve(restarted, OP2, 0.4);
    expect(restarted.summary(DAY1)).toMatchObject({
      dailyLimitUsd: 0.5,
      dailyCommittedUsd: 0.5,
      unsettledReservations: 1,
    });
  });

  it("reservation kedua ditolak terhadap state durable terbaru, bukan snapshot lama", () => {
    const path = spendPath();
    const budget = new FileSpendBudget(path, { dailyUsd: 0.5 });
    reserve(budget, OP1, 0.3);
    expect(() => reserve(budget, OP2, 0.3)).toThrow(SpendBudgetExceededError);
    expect(budget.entries()).toHaveLength(1);
  });

  it("reservation uncertain tetap dihitung setelah restart", () => {
    const path = spendPath();
    const first = new FileSpendBudget(path, { dailyUsd: 0.5 });
    const r1 = reserve(first, OP1, 0.3);
    first.markUncertain(r1.reservationId);

    const restarted = new FileSpendBudget(path, { dailyUsd: 0.5 });
    expect(() => reserve(restarted, OP2, 0.3)).toThrow(SpendBudgetExceededError);
    expect(restarted.summary(DAY1).unsettledReservations).toBe(1);
  });

  it("daily period reset tetapi monthly cap tetap mengikat lintas hari", () => {
    const path = spendPath();
    const budget = new FileSpendBudget(path, { dailyUsd: 0.5, monthlyUsd: 0.7 });
    reserve(budget, OP1, 0.4, DAY1);
    reserve(budget, OP2, 0.2, DAY2);
    expect(() => reserve(budget, OP3, 0.2, DAY2)).toThrow(SpendBudgetExceededError);
    expect(budget.summary(DAY2)).toMatchObject({
      dailyCommittedUsd: 0.2,
      monthlyCommittedUsd: 0.6,
    });
  });

  it("monthly period reset mengizinkan budget baru", () => {
    const path = spendPath();
    const budget = new FileSpendBudget(path, { monthlyUsd: 0.5 });
    reserve(budget, OP1, 0.5, DAY1);
    reserve(budget, OP2, 0.5, NEXT_MONTH);
    expect(budget.summary(NEXT_MONTH).monthlyCommittedUsd).toBe(0.5);
  });

  it("actual spend di atas reservation disimpan jujur dan memblokir call berikutnya", () => {
    const path = spendPath();
    const budget = new FileSpendBudget(path, { dailyUsd: 0.5 });
    const r1 = reserve(budget, OP1, 0.3);
    budget.settle(r1.reservationId, 0.55, DAY1);
    expect(budget.summary(DAY1).dailyCommittedUsd).toBe(0.55);
    expect(() => reserve(budget, OP2, 0.01)).toThrow(SpendBudgetExceededError);
  });

  it("existing lock fail-closed daripada membuka race admission", () => {
    const path = spendPath();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(`${path}.lock`, "stale\n", "utf8");
    const budget = new FileSpendBudget(path, { dailyUsd: 1 });
    expect(() => reserve(budget)).toThrow(SpendBudgetBusyError);
  });

  it("corrupt durable store fail-closed", () => {
    const path = spendPath();
    writeFileSync(path, "{broken", "utf8");
    const budget = new FileSpendBudget(path, { dailyUsd: 1 });
    expect(() => budget.summary(DAY1)).toThrow(SpendBudgetFormatError);
    expect(() => reserve(budget)).toThrow(SpendBudgetFormatError);
  });

  it("budget env parser menolak nol, negatif, NaN dan menerima kosong sebagai disabled", () => {
    expect(parseOptionalBudgetUsd("DAILY", undefined)).toBeUndefined();
    expect(parseOptionalBudgetUsd("DAILY", "")).toBeUndefined();
    expect(parseOptionalBudgetUsd("DAILY", "1.25")).toBe(1.25);
    expect(() => parseOptionalBudgetUsd("DAILY", "0")).toThrow(SpendBudgetFormatError);
    expect(() => parseOptionalBudgetUsd("DAILY", "-1")).toThrow(SpendBudgetFormatError);
    expect(() => parseOptionalBudgetUsd("DAILY", "wat")).toThrow(SpendBudgetFormatError);
  });
});
