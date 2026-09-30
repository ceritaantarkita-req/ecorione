import { describe, expect, it } from "vitest";
import {
  buildChatProviderOptions,
  buildHostedProviderModels,
  buildOpenRouterQuickSwitchModels,
  currentHostedModelPreference,
  currentOpenRouterPreference,
  deriveChatRoutingState,
  type ChatOpenRouterDiscovery,
  type ChatProviderCatalogEntry,
  type ChatRuntimeSnapshot,
} from "./chat-model-routing";

const runtime: ChatRuntimeSnapshot = {
  revision: 4,
  settings: {
    hostedProvider: "openrouter",
    hostedModel: "governed",
    openRouterModelSelection: "qwen/qwen3.8-max",
    hostedCallsEnabled: false,
    defaultChatTarget: "local",
  },
};

const providers: ChatProviderCatalogEntry[] = [
  {
    id: "openrouter",
    displayName: "OpenRouter",
    category: "ai",
    routingReady: true,
    hostedModels: [
      { id: "claude-sonnet-4-5-20250929", displayName: "Claude Sonnet 4.5" },
      { id: "claude-opus-4-1-20250805", displayName: "Claude Opus 4.1" },
    ],
  },
  {
    id: "anthropic",
    displayName: "Claude / Anthropic",
    category: "ai",
    routingReady: true,
    hostedModels: [
      { id: "claude-sonnet-4-5-20250929", displayName: "Claude Sonnet 4.5" },
    ],
  },
  {
    id: "openai",
    displayName: "OpenAI / ChatGPT API",
    category: "ai",
    routingReady: true,
    hostedModels: [
      { id: "gpt-5.6-sol", displayName: "GPT-5.6 Sol" },
    ],
  },
];

const discovery: ChatOpenRouterDiscovery = {
  stale: false,
  models: [
    {
      id: "qwen/qwen3.8-max",
      displayName: "Qwen: Qwen3.8 Max",
      selectable: true,
      executable: false,
      selectionId: "qwen/qwen3.8-max",
      promptPricePerToken: "0.000002",
      completionPricePerToken: "0.000006",
    },
    {
      id: "google/gemini-3.8-flash",
      displayName: "Gemini 3.8 Flash",
      selectable: true,
      executable: false,
      selectionId: "google/gemini-3.8-flash",
      promptPricePerToken: "0.0000004",
      completionPricePerToken: "0.0000012",
    },
    {
      id: "~deepseek/deepseek-v4-flash-latest",
      displayName: "DeepSeek V4 Flash Latest",
      selectable: false,
      executable: false,
      selectionId: null,
    },
  ],
};

describe("Ai provider/model selector routing", () => {
  it("shows Local plus only connected first-class hosted providers", () => {
    expect(
      buildChatProviderOptions(
        {
          ready: true,
          state: "connected",
          configuredModel: "qwen3.5:9b",
          message: "Local AI · Connected.",
        },
        providers,
        {
          credentials: [{ provider: "openrouter" }, { provider: "anthropic" }],
        },
      ),
    ).toEqual([
      { id: "local", displayName: "Local", available: true },
      { id: "openrouter", displayName: "OpenRouter", available: true },
      { id: "anthropic", displayName: "Anthropic", available: true },
    ]);
  });

  it("builds provider-specific model choices and keeps OpenRouter catalog pricing", () => {
    expect(currentHostedModelPreference(runtime)).toBe("qwen/qwen3.8-max");
    const models = buildHostedProviderModels(runtime, providers, discovery);
    expect(models.map((model) => model.id)).toEqual([
      "governed",
      "claude-sonnet-4-5-20250929",
      "claude-opus-4-1-20250805",
      "qwen/qwen3.8-max",
      "google/gemini-3.8-flash",
    ]);
    expect(models.find((model) => model.id === "qwen/qwen3.8-max")).toMatchObject({
      inputUsdPerMTok: 2,
      outputUsdPerMTok: 6,
      available: true,
    });

    const anthropicRuntime: ChatRuntimeSnapshot = {
      ...runtime,
      settings: {
        ...runtime.settings,
        hostedProvider: "anthropic",
        hostedModel: "claude-sonnet-4-5-20250929",
      },
    };
    expect(buildHostedProviderModels(anthropicRuntime, providers, null)).toEqual([
      { id: "governed", displayName: "Recommended", available: true },
      {
        id: "claude-sonnet-4-5-20250929",
        displayName: "Claude Sonnet 4.5",
        available: true,
      },
    ]);
  });
});

describe("Ai chat OpenRouter quick-switch routing", () => {
  it("shows every fresh compatible catalog model directly with provider pricing", () => {
    const models = buildOpenRouterQuickSwitchModels(runtime, providers, discovery);
    expect(models.map((model) => model.id)).toEqual([
      "governed",
      "claude-sonnet-4-5-20250929",
      "claude-opus-4-1-20250805",
      "qwen/qwen3.8-max",
      "google/gemini-3.8-flash",
    ]);
    expect(models.find((model) => model.id === "qwen/qwen3.8-max")).toMatchObject({
      available: true,
      inputUsdPerMTok: 2,
      outputUsdPerMTok: 6,
    });
    const gemini = models.find((model) => model.id === "google/gemini-3.8-flash");
    expect(gemini).toMatchObject({ available: true });
    expect(gemini?.inputUsdPerMTok).toBeCloseTo(0.4);
    expect(gemini?.outputUsdPerMTok).toBeCloseTo(1.2);
    expect(models.some((model) => model.id.includes("deepseek"))).toBe(false);
  });

  it("keeps a saved dynamic preference visible but unavailable without trusted admission", () => {
    const models = buildOpenRouterQuickSwitchModels(runtime, providers, null);
    expect(currentOpenRouterPreference(runtime)).toBe("qwen/qwen3.8-max");
    expect(models.find((model) => model.id === "qwen/qwen3.8-max")).toEqual({
      id: "qwen/qwen3.8-max",
      displayName: "qwen/qwen3.8-max",
      available: false,
    });
  });

  it("only exposes Hosted as the default when runtime execution and credential readiness both allow it", () => {
    const hostedRuntime: ChatRuntimeSnapshot = {
      ...runtime,
      settings: {
        ...runtime.settings,
        hostedModel: "claude-sonnet-4-5-20250929",
        openRouterModelSelection: "claude-sonnet-4-5-20250929",
        hostedCallsEnabled: true,
        defaultChatTarget: "hosted",
      },
    };

    expect(
      deriveChatRoutingState(hostedRuntime, {
        credentials: [{ provider: "openrouter" }],
      }),
    ).toMatchObject({
      hostedAvailable: true,
      defaultTarget: "hosted",
    });

    expect(deriveChatRoutingState(hostedRuntime, { credentials: [] })).toMatchObject({
      hostedAvailable: false,
      defaultTarget: "local",
    });

    expect(
      deriveChatRoutingState(runtime, {
        credentials: [{ provider: "openrouter" }],
      }),
    ).toMatchObject({
      hostedAvailable: false,
      defaultTarget: "local",
    });
  });
  it("allows an automatically admitted dynamic selection when the trusted marker matches", () => {
    const admittedRuntime: ChatRuntimeSnapshot = {
      ...runtime,
      settings: {
        ...runtime.settings,
        openRouterCertifiedModelId: "qwen/qwen3.8-max",
        hostedCallsEnabled: true,
        defaultChatTarget: "hosted",
      },
    };

    expect(
      deriveChatRoutingState(admittedRuntime, {
        credentials: [{ provider: "openrouter" }],
      }),
    ).toMatchObject({
      hostedAvailable: true,
      hostedBlockedByOpenRouterPreference: false,
      hostedRouteLabel: "Hosted · OpenRouter · qwen/qwen3.8-max",
      defaultTarget: "hosted",
    });
  });

  it("fails closed for a legacy dynamic preference snapshot that incorrectly says Hosted is on", () => {
    const contradictoryRuntime: ChatRuntimeSnapshot = {
      ...runtime,
      settings: {
        ...runtime.settings,
        hostedCallsEnabled: true,
        defaultChatTarget: "hosted",
      },
    };

    expect(
      deriveChatRoutingState(contradictoryRuntime, {
        credentials: [{ provider: "openrouter" }],
      }),
    ).toMatchObject({
      hostedAvailable: false,
      hostedBlockedByOpenRouterPreference: true,
      defaultTarget: "local",
    });
  });
});
