import { z } from "zod";
import type { LocalRuntimeId } from "./providers/local-runtime.js";

const SHA256_HEX = /^[0-9a-f]{64}$/;

export const LocalModelDigestSchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((value) => (value.startsWith("sha256:") ? value : `sha256:${value}`))
  .refine((value) => SHA256_HEX.test(value.slice("sha256:".length)), {
    message: "localModelDigest harus SHA-256 64 hex (opsional prefix sha256:).",
  });
export type LocalModelDigest = z.infer<typeof LocalModelDigestSchema>;

export function parseOptionalLocalModelDigest(
  value: string | null | undefined,
): LocalModelDigest | null {
  if (value === undefined || value === null || value.trim() === "") return null;
  return LocalModelDigestSchema.parse(value);
}

/**
 * Bagaimana digest pada identitas ini diperoleh.
 *
 * `verified`/`resolved` berarti boundary provider lokal benar-benar melaporkan digest itu.
 * `declared-unverified` berarti operator menyatakannya tapi runtime tidak bisa
 * mengonfirmasi — itu klaim, bukan bukti, jadi tidak dihitung `pinned` (audit 2026-09-14
 * S2-5). Tanpa deklarasi maupun provenance statusnya `unverified`.
 */
export type LocalIdentityProvenance =
  "verified" | "resolved" | "declared-unverified" | "unverified";

const PINNING_PROVENANCE: ReadonlySet<LocalIdentityProvenance> =
  new Set<LocalIdentityProvenance>(["verified", "resolved"]);

export interface LocalModelIdentity {
  readonly id: string;
  readonly pinned: boolean;
  readonly digest: LocalModelDigest | null;
  readonly provenance: LocalIdentityProvenance;
}

export function localModelIdentity(input: {
  runtime: LocalRuntimeId;
  modelTag: string;
  digest: LocalModelDigest | null | undefined;
  /**
   * Default `declared-unverified` ketika ada digest dan `unverified` ketika tidak —
   * yaitu apa yang sebenarnya diketahui pemanggil yang belum melewati boundary provider.
   */
  provenance?: LocalIdentityProvenance | undefined;
}): LocalModelIdentity {
  const digest = input.digest ?? null;
  const provenance =
    input.provenance ?? (digest === null ? "unverified" : "declared-unverified");
  const pinned = PINNING_PROVENANCE.has(provenance) && digest !== null;
  return {
    id: `local:${input.runtime}:${input.modelTag}@${pinned ? digest : "unpinned"}`,
    pinned,
    digest,
    provenance,
  };
}
