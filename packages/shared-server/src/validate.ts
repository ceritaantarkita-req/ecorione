/**
 * Validasi body/query lewat skema Zod, dengan pesan 400 yang seragam. Setiap route
 * handler di service Fase 1 memakai ini alih-alih memanggil `.parse()` mentah — supaya
 * error input pengguna tidak pernah bocor jadi 500.
 */

import type { ZodType, z } from "zod";
import { BadRequestError } from "./errors.js";

export function parseOrBadRequest<S extends ZodType>(schema: S, raw: unknown): z.infer<S> {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new BadRequestError("Input tidak valid.", {
      issues: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  return result.data;
}
