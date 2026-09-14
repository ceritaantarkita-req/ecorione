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

export interface LocalModelIdentity {
  readonly id: string;
  readonly pinned: boolean;
  readonly digest: LocalModelDigest | null;
}

export function localModelIdentity(input: {
  runtime: LocalRuntimeId;
  modelTag: string;
  digest: LocalModelDigest | null | undefined;
}): LocalModelIdentity {
  const digest = input.digest ?? null;
  return {
    id: `local:${input.runtime}:${input.modelTag}@${digest ?? "unpinned"}`,
    pinned: digest !== null,
    digest,
  };
}
