import { describe, expect, it } from "vitest";
import {
  buildOpenRouterQuickSwitchModels,
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

describe("Ai chat OpenRouter quick-switch routing", () => {
  it("shows governed, static executable, and admitted dynamic models but excludes unavailable discovery", () => {
    const models = buildOpenRouterQuickSwitchModels(runtime, providers, discovery);
    expect(models.map((model) => model.id)).toEqual([
      "governed",
      "claude-sonnet-4-5-20250929",
      "claude-opus-4-1-20250805",
      "qwen/qwen3.8-max",
    ]);
    expect(models.find((model) => model.id === "qwen/qwen3.8-max")).toMatchObject({
      executable: false,
      displayName: "Qwen: Qwen3.8 Max",
    });
    expect(models.some((model) => model.id.includes("deepseek"))).toBe(false);
  });

  it("keeps a saved dynamic preference visible without pretending it is executable", () => {
    const models = buildOpenRouterQuickSwitchModels(runtime, providers, null);
    expect(currentOpenRouterPreference(runtime)).toBe("qwen/qwen3.8-max");
    expect(models.find((model) => model.id === "qwen/qwen3.8-max")).toEqual({
      id: "qwen/qwen3.8-max",
      displayName: "qwen/qwen3.8-max",
      executable: false,
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
});
