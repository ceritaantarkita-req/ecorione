export const TARGET_OPENROUTER_MODEL_FAMILIES = [
  "gpt",
  "gemini",
  "qwen",
  "deepseek",
  "kimi",
  "glm",
] as const;

export type TargetOpenRouterModelFamily =
  (typeof TARGET_OPENROUTER_MODEL_FAMILIES)[number];
export type HostedModelFamily = TargetOpenRouterModelFamily | "other";

export interface OpenRouterModelFamilyDefinition {
  readonly id: TargetOpenRouterModelFamily;
  readonly displayName: string;
  /**
   * Canonical OpenRouter author namespaces. Model versions are intentionally not pinned here.
   * A namespace match is necessary but still not sufficient: the runtime slug/name must also
   * look like the expected family so unrelated models from the same author are not grouped in.
   */
  readonly sourceProviders: readonly string[];
  readonly modelPrefixes: readonly string[];
}

export const OPENROUTER_MODEL_FAMILY_DEFINITIONS = [
  {
    id: "gpt",
    displayName: "GPT",
    sourceProviders: ["openai"],
    modelPrefixes: ["gpt"],
  },
  {
    id: "gemini",
    displayName: "Gemini",
    sourceProviders: ["google"],
    modelPrefixes: ["gemini"],
  },
  {
    id: "qwen",
    displayName: "Qwen",
    sourceProviders: ["qwen"],
    modelPrefixes: ["qwen"],
  },
  {
    id: "deepseek",
    displayName: "DeepSeek",
    sourceProviders: ["deepseek", "deepseek-ai"],
    modelPrefixes: ["deepseek"],
  },
  {
    id: "kimi",
    displayName: "Kimi",
    sourceProviders: ["moonshotai"],
    modelPrefixes: ["kimi"],
  },
  {
    id: "glm",
    displayName: "GLM",
    sourceProviders: ["z-ai"],
    modelPrefixes: ["glm"],
  },
] as const satisfies readonly OpenRouterModelFamilyDefinition[];

const familyBySourceProvider = new Map<
  string,
  readonly OpenRouterModelFamilyDefinition[]
>();

for (const definition of OPENROUTER_MODEL_FAMILY_DEFINITIONS) {
  for (const sourceProvider of definition.sourceProviders) {
    const existing = familyBySourceProvider.get(sourceProvider) ?? [];
    familyBySourceProvider.set(sourceProvider, [...existing, definition]);
  }
}

function normalizedRuntimeBasename(id: string): string {
  const normalized = id.trim().toLowerCase().replace(/^~/u, "");
  const slash = normalized.indexOf("/");
  return slash === -1 ? normalized : normalized.slice(slash + 1);
}

function normalizedSourceProvider(sourceProvider: string): string {
  return sourceProvider.trim().toLowerCase().replace(/^~/u, "");
}

function familyTokenMatches(value: string, prefix: string): boolean {
  return value === prefix || value.startsWith(`${prefix}-`) || value.startsWith(`${prefix}_`);
}

export interface OpenRouterModelFamilyCandidate {
  readonly id: string;
  readonly displayName: string;
  readonly sourceProvider: string;
}

export function classifyOpenRouterModelFamily(
  candidate: OpenRouterModelFamilyCandidate,
): HostedModelFamily {
  const sourceProvider = normalizedSourceProvider(candidate.sourceProvider);
  const basename = normalizedRuntimeBasename(candidate.id);
  const displayName = candidate.displayName.trim().toLowerCase();
  const definitions = familyBySourceProvider.get(sourceProvider) ?? [];

  for (const definition of definitions) {
    const matches = definition.modelPrefixes.some(
      (prefix) =>
        familyTokenMatches(basename, prefix) ||
        displayName === prefix ||
        displayName.startsWith(`${prefix} `) ||
        displayName.startsWith(`${prefix}:`) ||
        displayName.startsWith(`${prefix}-`),
    );
    if (matches) return definition.id;
  }

  return "other";
}

export function isTargetOpenRouterModelFamily(
  family: HostedModelFamily,
): family is TargetOpenRouterModelFamily {
  return (TARGET_OPENROUTER_MODEL_FAMILIES as readonly string[]).includes(family);
}

export function openRouterModelFamilyDefinition(
  family: TargetOpenRouterModelFamily,
): OpenRouterModelFamilyDefinition {
  const definition = OPENROUTER_MODEL_FAMILY_DEFINITIONS.find(
    (entry) => entry.id === family,
  );
  if (definition === undefined) {
    throw new Error(`Unknown OpenRouter model family: ${family}`);
  }
  return definition;
}
