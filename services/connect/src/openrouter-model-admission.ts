import {
  isTargetOpenRouterModelFamily,
  type HostedModelFamily,
} from "./hosted-model-family.js";

export const OPENROUTER_ADMISSION_FAILURES = [
  "duplicate-runtime-id",
  "mutable-alias",
  "invalid-runtime-slug",
  "missing-context-window",
  "text-input-unsupported",
  "text-output-unsupported",
  "max-tokens-unsupported",
  "missing-pricing",
  "invalid-pricing",
  "stale-catalog",
] as const;

export type OpenRouterAdmissionFailure =
  (typeof OPENROUTER_ADMISSION_FAILURES)[number];

export type OpenRouterAdmissionStatus =
  | "verified-executable"
  | "verified-selectable"
  | "unavailable"
  | "discovered-only";

export interface OpenRouterAdmissionCandidate {
  readonly id: string;
  readonly sourceProvider: string;
  readonly family: HostedModelFamily;
  readonly contextWindowTokens: number | null;
  readonly inputModalities: readonly string[];
  readonly outputModalities: readonly string[];
  readonly supportedParameters: readonly string[];
  readonly promptPricePerToken: string | null;
  readonly completionPricePerToken: string | null;
  readonly mutableAlias: boolean;
  readonly duplicateRuntimeId?: boolean | undefined;
}

export interface OpenRouterAdmissionDecision {
  readonly admission: Exclude<OpenRouterAdmissionStatus, "verified-executable">;
  readonly selectable: boolean;
  readonly selectionId: string | null;
  readonly unavailableReason: OpenRouterAdmissionFailure | null;
}

const RUNTIME_SLUG = /^[a-z0-9][a-z0-9._-]{0,63}\/[a-z0-9][a-z0-9._:@+/-]{0,191}$/iu;
const DECIMAL_PRICE = /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/iu;

function unavailable(reason: OpenRouterAdmissionFailure): OpenRouterAdmissionDecision {
  return {
    admission: "unavailable",
    selectable: false,
    selectionId: null,
    unavailableReason: reason,
  };
}

function positivePrice(value: string | null): "missing" | "invalid" | "valid" {
  if (value === null || value.trim().length === 0) return "missing";
  const normalized = value.trim();
  if (!DECIMAL_PRICE.test(normalized)) return "invalid";
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? "valid" : "invalid";
}

function hasValue(values: readonly string[], expected: string): boolean {
  return values.some((value) => value.trim().toLowerCase() === expected);
}

function runtimeSlugValid(candidate: OpenRouterAdmissionCandidate): boolean {
  if (!RUNTIME_SLUG.test(candidate.id)) return false;
  const [namespace] = candidate.id.split("/", 1);
  return namespace?.toLowerCase() === candidate.sourceProvider.trim().toLowerCase();
}

/**
 * Session 4B admission is deliberately narrower than runtime execution proof.
 * A passing target-family model may enter the later picker, but this decision alone
 * does not claim that a live completion has passed Session 4E.
 */
export function verifyOpenRouterModelAdmission(
  candidate: OpenRouterAdmissionCandidate,
): OpenRouterAdmissionDecision {
  if (!isTargetOpenRouterModelFamily(candidate.family)) {
    return {
      admission: "discovered-only",
      selectable: false,
      selectionId: null,
      unavailableReason: null,
    };
  }
  if (candidate.duplicateRuntimeId === true) return unavailable("duplicate-runtime-id");
  if (candidate.mutableAlias) return unavailable("mutable-alias");
  if (!runtimeSlugValid(candidate)) return unavailable("invalid-runtime-slug");
  if (candidate.contextWindowTokens === null || candidate.contextWindowTokens <= 0) {
    return unavailable("missing-context-window");
  }
  if (!hasValue(candidate.inputModalities, "text")) {
    return unavailable("text-input-unsupported");
  }
  if (!hasValue(candidate.outputModalities, "text")) {
    return unavailable("text-output-unsupported");
  }
  if (!hasValue(candidate.supportedParameters, "max_tokens")) {
    return unavailable("max-tokens-unsupported");
  }

  const promptPrice = positivePrice(candidate.promptPricePerToken);
  const completionPrice = positivePrice(candidate.completionPricePerToken);
  if (promptPrice === "missing" || completionPrice === "missing") {
    return unavailable("missing-pricing");
  }
  if (promptPrice !== "valid" || completionPrice !== "valid") {
    return unavailable("invalid-pricing");
  }

  return {
    admission: "verified-selectable",
    selectable: true,
    selectionId: candidate.id,
    unavailableReason: null,
  };
}

export function staleOpenRouterAdmission(): OpenRouterAdmissionDecision {
  return unavailable("stale-catalog");
}
