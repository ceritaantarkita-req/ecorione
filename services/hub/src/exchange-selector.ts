import type { EcxPacket } from "@ecorione/shared-schema";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "this",
  "to",
  "with",
  "return",
  "json",
  "exactly",
  "these",
  "key",
  "keys",
  "preserve",
  "source",
  "value",
  "values",
  "string",
  "strings",
  "number",
  "numbers",
  "numeric",
  "field",
  "fields",
  "use",
  "using",
]);

const NEGATIVE_AUTHORITY_PATTERNS = [
  /\bnoise\b/gi,
  /\blegacy\b/gi,
  /\bretired\b/gi,
  /\barchived?\b/gi,
  /\bhistorical\b/gi,
  /\bfictional\b/gi,
  /\bgeneric\b/gi,
  /\billustrative\b/gi,
  /\bnon[- ]authoritative\b/gi,
  /\bunrelated\b/gi,
  /\bolder\b/gi,
  /\bpreviously closed\b/gi,
  /\bdoes not\b/gi,
  /\bdo not\b/gi,
  /\bwithout the requested\b/gi,
];

const POSITIVE_AUTHORITY_PATTERNS = [
  /\bcurrent\b/gi,
  /\bfinal\b/gi,
  /\bapproved\b/gi,
  /\bauthoritative\b/gi,
  /\bactive\b/gi,
  /\brequired\b/gi,
  /\brequirement\b/gi,
  /\bonly open\b/gi,
  /\brunbook\b/gi,
  /\brouting\b/gi,
  /\bassignment\b/gi,
  /\bcontrol\b/gi,
];

export interface EcxReferenceDescriptor {
  readonly index: number;
  readonly text: string;
}

export interface EcxReferenceSelectorOptions {
  readonly maxRefs: number;
}

function normalizeText(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function stemToken(value: string): string {
  if (value.length > 5 && value.endsWith("ies")) return `${value.slice(0, -3)}y`;
  if (value.length > 5 && value.endsWith("ing")) return value.slice(0, -3);
  if (value.length > 4 && value.endsWith("ed")) return value.slice(0, -2);
  if (value.length > 4 && value.endsWith("s") && !value.endsWith("ss")) {
    return value.slice(0, -1);
  }
  return value;
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(/[^a-z0-9]+/g)
    .map(stemToken)
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
}

function addWeightedTokens(weights: Map<string, number>, value: string, weight: number): void {
  for (const token of new Set(tokenize(value))) {
    weights.set(token, (weights.get(token) ?? 0) + weight);
  }
}

function queryWeights(packet: EcxPacket): Map<string, number> {
  const weights = new Map<string, number>();
  addWeightedTokens(weights, packet.intent, 0.5);
  addWeightedTokens(weights, packet.task, 1);
  for (const need of packet.need) addWeightedTokens(weights, need, 2);
  return weights;
}

function countMatches(text: string, patterns: readonly RegExp[]): number {
  let total = 0;
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    total += [...text.matchAll(pattern)].length;
  }
  return total;
}

function authorityMultiplier(text: string): number {
  const normalized = normalizeText(text);
  const positive = countMatches(normalized, POSITIVE_AUTHORITY_PATTERNS);
  const negative = countMatches(normalized, NEGATIVE_AUTHORITY_PATTERNS);
  return Math.max(0.2, Math.min(1.6, 1 + positive * 0.08 - negative * 0.18));
}

/**
 * Deterministic local selector for W16. It ranks already-authorized reference
 * descriptors against packet intent/task/need. This is deliberately not a
 * hosted-model call and does not mutate the packet or bypass hydration policy.
 *
 * maxRefs is the caller's hard context budget. Once semantic overlap exists,
 * fill that budget with the highest positive-score references rather than
 * applying a relative cutoff that can discard secondary evidence needed to
 * answer a multi-field task. Authority penalties still rank noise below more
 * current/final evidence; the budget remains the hard upper bound.
 */
export function selectEcxReferenceIndexes(
  packet: EcxPacket,
  descriptors: readonly EcxReferenceDescriptor[],
  options: EcxReferenceSelectorOptions,
): number[] {
  if (descriptors.length === 0 || options.maxRefs <= 0) return [];

  const weights = queryWeights(packet);
  const descriptorTokens = descriptors.map((descriptor) => ({
    descriptor,
    tokens: new Set(tokenize(descriptor.text)),
  }));
  const documentFrequency = new Map<string, number>();
  for (const { tokens } of descriptorTokens) {
    for (const token of tokens) {
      if (weights.has(token)) {
        documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
      }
    }
  }

  const count = descriptorTokens.length;
  const scored = descriptorTokens.map(({ descriptor, tokens }) => {
    let overlap = 0;
    for (const [token, weight] of weights) {
      if (!tokens.has(token)) continue;
      const frequency = documentFrequency.get(token) ?? count;
      const idf = Math.log((count + 1) / (frequency + 1)) + 1;
      overlap += weight * idf;
    }
    return {
      index: descriptor.index,
      score: overlap * authorityMultiplier(descriptor.text),
    };
  });

  scored.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return left.index - right.index;
  });

  const topScore = scored[0]?.score ?? 0;
  if (topScore <= 0) {
    return scored
      .map((entry) => entry.index)
      .sort((left, right) => left - right)
      .slice(0, Math.min(options.maxRefs, scored.length));
  }

  const selected = scored
    .filter((entry) => entry.score > 0)
    .slice(0, Math.min(options.maxRefs, scored.length))
    .map((entry) => entry.index);

  return selected.length > 0 ? selected : [scored[0]!.index];
}
