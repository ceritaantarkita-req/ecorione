/**
 * Lapisan akses data trace store — `docs/api-fase1.md` §RnD.
 *
 * RnD **tidak menghitung ulang biaya**: ia cuma menyimpan apa yang dikirim Connect/Hub
 * lewat `buildGenAiSpan` (`@ecorione/shared-telemetry`) dan menjumlahkan atribut
 * `ecorione.cost.*` yang sudah ada untuk ringkasan — bukan sumber kebenaran biaya.
 */

import { randomUUID } from "node:crypto";
import type { Timestamp } from "@ecorione/shared-schema";
import { ECORIONE_ATTR, type SpanAttributeValue } from "@ecorione/shared-telemetry";
import type { RndDatabase } from "./db.js";

export interface TraceAttributes {
  readonly [key: string]: SpanAttributeValue;
}

export interface RecordTraceInput {
  readonly name: string;
  readonly attributes: TraceAttributes;
  readonly operationId?: string | null | undefined;
  readonly traceId?: string | null | undefined;
  readonly recordedAt: Timestamp;
}

export interface TraceRecord {
  readonly id: string;
  readonly name: string;
  readonly attributes: TraceAttributes;
  readonly operationId: string | null;
  readonly traceId: string | null;
  readonly recordedAt: Timestamp;
}

export interface ListTracesFilter {
  readonly operationId?: string | undefined;
  readonly traceId?: string | undefined;
  readonly limit?: number | undefined;
}

export interface TraceSummary {
  readonly callCount: number;
  readonly totalActualUsd: number;
  readonly totalNaiveUsd: number;
  readonly totalSavedUsd: number;
}

interface SpanRow {
  id: string;
  name: string;
  attributes: string;
  operation_id: string | null;
  trace_id: string | null;
  recorded_at: string;
}

function rowToRecord(row: SpanRow): TraceRecord {
  return {
    id: row.id,
    name: row.name,
    attributes: JSON.parse(row.attributes) as TraceAttributes,
    operationId: row.operation_id,
    traceId: row.trace_id,
    recordedAt: row.recorded_at as Timestamp,
  };
}

const DEFAULT_LIST_LIMIT = 50;

export class TraceStore {
  readonly #db: RndDatabase;

  constructor(db: RndDatabase) {
    this.#db = db;
  }

  record(input: RecordTraceInput): TraceRecord {
    const id = `span_${randomUUID().replaceAll("-", "")}`;
    this.#db.raw
      .prepare(
        `INSERT INTO spans (id, name, attributes, operation_id, trace_id, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.name,
        JSON.stringify(input.attributes),
        input.operationId ?? null,
        input.traceId ?? null,
        input.recordedAt,
      );

    return {
      id,
      name: input.name,
      attributes: input.attributes,
      operationId: input.operationId ?? null,
      traceId: input.traceId ?? null,
      recordedAt: input.recordedAt,
    };
  }

  get(id: string): TraceRecord | null {
    const row = this.#db.raw.prepare("SELECT * FROM spans WHERE id = ?").get(id) as
      SpanRow | undefined;
    return row === undefined ? null : rowToRecord(row);
  }

  list(filter: ListTracesFilter = {}): TraceRecord[] {
    const clauses: string[] = [];
    const params: (string | number)[] = [];

    if (filter.operationId !== undefined) {
      clauses.push("operation_id = ?");
      params.push(filter.operationId);
    }
    if (filter.traceId !== undefined) {
      clauses.push("trace_id = ?");
      params.push(filter.traceId);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const limit = filter.limit ?? DEFAULT_LIST_LIMIT;

    const rows = this.#db.raw
      .prepare(`SELECT * FROM spans ${where} ORDER BY recorded_at DESC, id ASC LIMIT ?`)
      .all(...params, limit) as SpanRow[];

    return rows.map(rowToRecord);
  }

  /**
   * Menjumlahkan atribut `ecorione.cost.*` dari span yang cocok dengan `operationId`.
   * Satu giliran chat bisa memuat lebih dari satu panggilan model (mis. retry
   * eskalasi) — ADR-13 mensyaratkan keduanya ikut terhitung, jadi ini menjumlahkan
   * semua span, bukan mengambil satu.
   */
  summary(operationId: string): TraceSummary {
    const records = this.list({ operationId, limit: 1000 });
    let callCount = 0;
    let totalActualUsd = 0;
    let totalNaiveUsd = 0;

    for (const record of records) {
      const actual = record.attributes[ECORIONE_ATTR.costActualUsd];
      const naive = record.attributes[ECORIONE_ATTR.costNaiveUsd];
      if (typeof actual !== "number" || typeof naive !== "number") continue;
      callCount += 1;
      totalActualUsd += actual;
      totalNaiveUsd += naive;
    }

    return {
      callCount,
      totalActualUsd,
      totalNaiveUsd,
      totalSavedUsd: totalNaiveUsd - totalActualUsd,
    };
  }
}
