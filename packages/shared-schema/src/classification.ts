/**
 * Klasifikasi data — `prd.md` §12, §14.
 * Dua sumbu berbeda: sensitivity = siapa boleh melihat; syncClass = bagaimana data boleh
 * meninggalkan mesin. Jangan menukarnya dengan optimisasi biaya.
 */
import { z } from "zod";

export const SENSITIVITY = ["PUBLIC", "INTERNAL", "SENSITIVE", "RESTRICTED"] as const;
export type Sensitivity = (typeof SENSITIVITY)[number];
export const SensitivitySchema = z.enum(SENSITIVITY);
const SENSITIVITY_RANK: Record<Sensitivity, number> = {
  PUBLIC: 0,
  INTERNAL: 1,
  SENSITIVE: 2,
  RESTRICTED: 3,
};
export function sensitivityRank(s: Sensitivity): number {
  return SENSITIVITY_RANK[s];
}
export function atLeastAsSensitive(actual: Sensitivity, threshold: Sensitivity): boolean {
  return SENSITIVITY_RANK[actual] >= SENSITIVITY_RANK[threshold];
}
export function maxSensitivity(values: readonly Sensitivity[]): Sensitivity {
  let result: Sensitivity = "PUBLIC";
  for (const v of values) if (SENSITIVITY_RANK[v] > SENSITIVITY_RANK[result]) result = v;
  return result;
}

export const SYNC_CLASS = ["LOCAL_ONLY", "SYNC_ENCRYPTED", "CLOUD_ALLOWED", "PUBLIC"] as const;
export type SyncClass = (typeof SYNC_CLASS)[number];
export const SyncClassSchema = z.enum(SYNC_CLASS);
export const DEFAULT_SYNC_CLASS: SyncClass = "LOCAL_ONLY";
export function mayLeaveDevice(sync: SyncClass): boolean {
  return sync !== "LOCAL_ONLY";
}
/**
 * Hosted model menerima plaintext, jadi `SYNC_ENCRYPTED` tidak cukup. Hanya data yang
 * eksplisit CLOUD_ALLOWED/PUBLIC boleh dimasukkan ke request provider hosted.
 */
export function maySendToHosted(sync: SyncClass): boolean {
  return sync === "CLOUD_ALLOWED" || sync === "PUBLIC";
}

export const TRUST = ["USER", "LOCAL_AGENT", "HOSTED_AGENT", "THIRD_PARTY"] as const;
export type Trust = (typeof TRUST)[number];
export const TrustSchema = z.enum(TRUST);
const TRUST_RANK: Record<Trust, number> = {
  USER: 3,
  LOCAL_AGENT: 2,
  HOSTED_AGENT: 1,
  THIRD_PARTY: 0,
};
export function mayWriteCoreMemory(trust: Trust): boolean {
  return trust === "USER";
}
export function requiresQuarantine(trust: Trust): boolean {
  return TRUST_RANK[trust] < TRUST_RANK.USER;
}

export const ScopeSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9:_-]*$/, "Scope: lowercase, boleh `:` `_` `-`");
export type Scope = z.infer<typeof ScopeSchema>;
export const DEFAULT_SCOPE: Scope = "personal";
