/** Deterministic routing — ADR-02 + ADR-14. */
import type { Sensitivity } from "@ecorione/shared-schema";
import type { PinnedModelId } from "@ecorione/shared-telemetry";
import { DEFAULT_HOSTED_PROVIDER, type HostedProviderId } from "./provider-types.js";

export type RouteTarget = "hosted" | "local";

export interface RouteRequest {
  readonly target: RouteTarget;
  readonly sensitivity: Sensitivity;
  readonly hostedProvider?: HostedProviderId | undefined;
}

export interface RouteDecision {
  /** Pinned pricing identity, not necessarily the provider runtime slug. */
  readonly model: PinnedModelId;
  readonly routeReason: "local-consolidation" | "sensitivity-restricted" | "default-hosted";
}

/**
 * Local model/runtime identity is dynamic configuration. Cost accounting uses one generic
 * zero-provider-token pricing identity so telemetry never pretends every local call is Qwen.
 */
export const LOCAL_PINNED_MODEL: PinnedModelId = "local/provider-token-zero";

function hostedModel(provider: HostedProviderId, sensitivity: Sensitivity): PinnedModelId {
  switch (provider) {
    case "anthropic":
    case "openrouter":
      return sensitivity === "RESTRICTED"
        ? "claude-opus-4-1-20250805"
        : "claude-sonnet-4-5-20250929";
    case "openai":
      return sensitivity === "RESTRICTED" ? "gpt-5.6-sol" : "gpt-5.6-terra";
  }
}

/**
 * Deterministic order:
 * 1. local target always stays local;
 * 2. RESTRICTED chooses the provider's higher-quality pinned model;
 * 3. normal hosted chooses the provider's standard pinned model.
 *
 * Provider choice is explicit configuration, never an auto-router. Runtime aliases such as
 * `gpt-5.6` or model `latest` are not accepted as pricing identities.
 */
export function route(req: RouteRequest): RouteDecision {
  if (req.target === "local") {
    return { model: LOCAL_PINNED_MODEL, routeReason: "local-consolidation" };
  }
  const provider = req.hostedProvider ?? DEFAULT_HOSTED_PROVIDER;
  if (req.sensitivity === "RESTRICTED") {
    return {
      model: hostedModel(provider, req.sensitivity),
      routeReason: "sensitivity-restricted",
    };
  }
  return { model: hostedModel(provider, req.sensitivity), routeReason: "default-hosted" };
}
