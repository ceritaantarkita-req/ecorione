import { z } from "zod";
import type { HostedProviderId } from "./provider-types.js";
import {
  executableHostedModelRegistryEntry,
  hostedModelRegistry,
  hostedModelRegistryEntry,
  registeredHostedModelIds,
  type HostedModelRegistryEntry,
} from "./hosted-model-registry.js";

export const GOVERNED_HOSTED_MODEL = "governed" as const;

/**
 * Runtime settings deliberately store a string preference rather than a compile-time enum.
 * The provider/model pair is still fail-closed by hostedModelSupported() against the
 * governed registry. This keeps the persistence/API shape ready for later catalog discovery
 * without weakening current verification.
 */
export const HostedModelPreferenceSchema = z.string().trim().min(1).max(256);
export type HostedModelPreference = z.infer<typeof HostedModelPreferenceSchema>;

export type HostedModelCatalogEntry = HostedModelRegistryEntry;

/** Compatibility export for callers/tests that need the currently admitted identities. */
export const SELECTABLE_HOSTED_MODEL_IDS = registeredHostedModelIds();

export function hostedModelCatalog(
  provider: HostedProviderId,
): readonly HostedModelCatalogEntry[] {
  return hostedModelRegistry(provider);
}

export function hostedModelSupported(
  provider: HostedProviderId,
  preference: HostedModelPreference,
): boolean {
  if (preference === GOVERNED_HOSTED_MODEL) return true;
  return executableHostedModelRegistryEntry(provider, preference) !== undefined;
}

export function hostedModelCatalogEntry(
  provider: HostedProviderId,
  preference: HostedModelPreference,
): HostedModelCatalogEntry | undefined {
  if (preference === GOVERNED_HOSTED_MODEL) return undefined;
  return hostedModelRegistryEntry(provider, preference);
}
