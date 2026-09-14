import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MockAgent,
  getGlobalDispatcher,
  setGlobalDispatcher,
  type Interceptable,
} from "undici";
import { ExactMatchCache } from "./cache.js";
import { complete, type CompleteDeps } from "./complete.js";
import { NOW, OPERATION_ID, prefix } from "./test-helpers.js";

const DIGEST = `sha256:${"c".repeat(64)}` as const;
let originalDispatcher: ReturnType<typeof getGlobalDispatcher>;
let localPool: Interceptable;

beforeEach(() => {
  originalDispatcher = getGlobalDispatcher();
  const agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  localPool = agent.get("http://127.0.0.1:11434");
});

afterEach(() => {
  setGlobalDispatcher(originalDispatcher);
});

function deps(overrides: Partial<CompleteDeps> = {}): CompleteDeps {
  return {
    anthropicApiKey: undefined,
    localBaseUrl: "http://127.0.0.1:11434/v1",
    localModelTag: "local-model",
    cache: new ExactMatchCache(),
    hostedCallsEnabled: false,
    ...overrides,
  };
}

const input = {
  target: "local" as const,
  prefix: prefix(),
  dynamicText: "",
  userMessage: "same prompt",
  sensitivity: "INTERNAL" as const,
  operationId: OPERATION_ID,
  now: NOW,
};

function localReply(text: string) {
  return {
    model: "local-model",
    choices: [{ message: { content: text } }],
    usage: { prompt_tokens: 5, completion_tokens: 2 },
  };
}

describe("local model immutable cache identity", () => {
  it("bypasses exact cache when the local model digest is unpinned", async () => {
    localPool
      .intercept({ path: "/v1/chat/completions", method: "POST" })
      .reply(200, localReply("first"));
    localPool
      .intercept({ path: "/v1/chat/completions", method: "POST" })
      .reply(200, localReply("second"));

    const sharedCache = new ExactMatchCache();
    const first = await complete(deps({ cache: sharedCache }), input);
    const second = await complete(deps({ cache: sharedCache }), input);

    expect(first.cacheHit).toBe(false);
    expect(second.cacheHit).toBe(false);
    expect(first.reply).toBe("first");
    expect(second.reply).toBe("second");
    expect(first.modelIdentityPinned).toBe(false);
    expect(first.modelIdentity).toBe("local:openai-compatible:local-model@unpinned");
  });

  it("allows exact cache only when the local model digest is pinned", async () => {
    localPool
      .intercept({ path: "/v1/chat/completions", method: "POST" })
      .reply(200, localReply("stable"))
      .times(1);

    const sharedCache = new ExactMatchCache();
    const first = await complete(
      deps({ cache: sharedCache, localModelDigest: DIGEST }),
      input,
    );
    const second = await complete(
      deps({ cache: sharedCache, localModelDigest: DIGEST }),
      input,
    );

    expect(first.cacheHit).toBe(false);
    expect(second.cacheHit).toBe(true);
    expect(first.modelIdentityPinned).toBe(true);
    expect(first.modelIdentity).toBe(`local:openai-compatible:local-model@${DIGEST}`);
    expect(second.modelIdentity).toBe(first.modelIdentity);
  });

  it("separates cache entries when the digest changes behind the same selector", async () => {
    localPool
      .intercept({ path: "/v1/chat/completions", method: "POST" })
      .reply(200, localReply("digest-a"));
    localPool
      .intercept({ path: "/v1/chat/completions", method: "POST" })
      .reply(200, localReply("digest-b"));

    const sharedCache = new ExactMatchCache();
    const digestA = `sha256:${"a".repeat(64)}` as const;
    const digestB = `sha256:${"b".repeat(64)}` as const;
    const first = await complete(
      deps({ cache: sharedCache, localModelDigest: digestA }),
      input,
    );
    const second = await complete(
      deps({ cache: sharedCache, localModelDigest: digestB }),
      input,
    );

    expect(first.cacheHit).toBe(false);
    expect(second.cacheHit).toBe(false);
    expect(first.reply).toBe("digest-a");
    expect(second.reply).toBe("digest-b");
    expect(first.modelIdentity).not.toBe(second.modelIdentity);
  });
});
