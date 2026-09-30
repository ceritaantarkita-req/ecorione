import { priceFor } from "@ecorione/shared-telemetry";
import { hostedModelRegistryEntry } from "./hosted-model-registry.js";
import type { OpenRouterAdmissionStatus } from "./openrouter-model-admission.js";

export type OpenRouterCertificationStatus = "ready" | "preparing" | "unavailable" | "discovered";

/** Maximum pre-dispatch reservation shown to the user for one explicit model validation. */
export const OPENROUTER_MODEL_VALIDATION_CAP_USD = 0.07;
const VALIDATION_INPUT_TOKEN_CEILING = 512;
const VALIDATION_MIN_OUTPUT_TOKENS = 8;
const VALIDATION_MAX_OUTPUT_TOKENS = 256;
const USD_RESERVATION_PRECISION = 1_000_000;

export interface OpenRouterValidationPlan {
  readonly capUsd: number;
  readonly inputUsdPerMTok: number;
  readonly outputUsdPerMTok: number;
  readonly maxOutputTokens: number;
  readonly reservationUsd: number;
}

export class OpenRouterValidationPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenRouterValidationPlanError";
  }
}

function decimalPrice(value: string | null): number {
  const parsed = value === null ? Number.NaN : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new OpenRouterValidationPlanError("Harga input/output OpenRouter tidak valid untuk model ini.");
  }
  return parsed;
}

function roundedReservation(value: number): number {
  return Math.ceil(value * USD_RESERVATION_PRECISION) / USD_RESERVATION_PRECISION;
}

/**
 * Derives a conservative, text-only test request from the current OpenRouter catalog price.
 * It never claims provider billing is mathematically capped: the final provider-reported
 * `usage.cost` remains authoritative. The cap is the durable pre-dispatch reservation.
 */
export function openRouterValidationPlan(input: {
  readonly promptPricePerToken: string | null;
  readonly completionPricePerToken: string | null;
}): OpenRouterValidationPlan {
  const promptPerToken = decimalPrice(input.promptPricePerToken);
  const completionPerToken = decimalPrice(input.completionPricePerToken);
  const inputUsd = VALIDATION_INPUT_TOKEN_CEILING * promptPerToken;
  const availableOutputUsd = OPENROUTER_MODEL_VALIDATION_CAP_USD - inputUsd;
  let maxOutputTokens = Math.min(
    VALIDATION_MAX_OUTPUT_TOKENS,
    Math.floor(availableOutputUsd / completionPerToken),
  );
  while (
    maxOutputTokens >= VALIDATION_MIN_OUTPUT_TOKENS &&
    roundedReservation(inputUsd + maxOutputTokens * completionPerToken) >
      OPENROUTER_MODEL_VALIDATION_CAP_USD
  ) {
    maxOutputTokens -= 1;
  }
  if (maxOutputTokens < VALIDATION_MIN_OUTPUT_TOKENS) {
    throw new OpenRouterValidationPlanError(
      "Model ini terlalu mahal untuk test minimum dalam batas USD 0.07. Naikkan batas test sebelum melanjutkan.",
    );
  }
  return {
    capUsd: OPENROUTER_MODEL_VALIDATION_CAP_USD,
    inputUsdPerMTok: promptPerToken * 1_000_000,
    outputUsdPerMTok: completionPerToken * 1_000_000,
    maxOutputTokens,
    reservationUsd: roundedReservation(inputUsd + maxOutputTokens * completionPerToken),
  };
}

/**
 * Certification is intentionally stricter than discovery admission. A candidate becomes
 * Ready only after the later bounded provider-call evidence is recorded. Until then,
 * matching a pinned candidate merely exposes Preparing to the product surface.
 */
function samePrice(left: number, right: number): boolean {
  const tolerance = Math.max(Math.abs(left), Math.abs(right), 1) * 1e-12;
  return Math.abs(left - right) <= tolerance;
}

export function openRouterCertificationStatus(input: {
  readonly id: string;
  readonly admission: OpenRouterAdmissionStatus;
  readonly executable: boolean;
  readonly promptPricePerToken: string | null;
  readonly completionPricePerToken: string | null;
  readonly certification?: {
    readonly modelId: string;
    readonly promptPricePerToken: string;
    readonly completionPricePerToken: string;
  } | undefined;
}): OpenRouterCertificationStatus {
  if (input.executable) return "ready";
  if (
    input.certification?.modelId === input.id &&
    samePrice(Number(input.certification.promptPricePerToken), Number(input.promptPricePerToken)) &&
    samePrice(Number(input.certification.completionPricePerToken), Number(input.completionPricePerToken))
  ) return "ready";
  if (input.admission === "unavailable") return "unavailable";
  const candidate = hostedModelRegistryEntry("openrouter", input.id);
  if (candidate?.verification !== "execution-candidate" || candidate.pricing.costModel === null) {
    return "discovered";
  }
  const price = priceFor(candidate.pricing.costModel);
  const prompt = Number(input.promptPricePerToken);
  const completion = Number(input.completionPricePerToken);
  if (
    !Number.isFinite(prompt) ||
    !Number.isFinite(completion) ||
    !samePrice(prompt, price.inputPerMTok / 1_000_000) ||
    !samePrice(completion, price.outputPerMTok / 1_000_000)
  ) {
    return "unavailable";
  }
  return input.admission === "verified-selectable" ? "preparing" : "discovered";
}