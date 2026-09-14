import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MockAgent,
  getGlobalDispatcher,
  setGlobalDispatcher,
  type Interceptable,
} from "undici";
import { ExactMatchCache } from "./cache.js";
import { complete, type CompleteDeps } from "./complete.js";
import type { LocalModelDigest } from "./local-model-identity.js";
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

/**
 * Boundary provider yang mengonfirmasi digest. Setelah audit 2026-09-14 S2-5, deklarasi
 * operator sendirian TIDAK lagi menghasilkan `pinned` — hanya digest yang benar-benar
 * dilaporkan runtime yang dihitung.
 */
function verifiedBoundary(digest: LocalModelDigest): CompleteDeps["resolveLocalProvenance"] {
  return () =>
    Promise.resolve({
      status: "verified" as const,
      digest,
      source: "test://api/tags",
    });
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
    const pinnedDeps = {
      cache: sharedCache,
      localModelDigest: DIGEST,
      resolveLocalProvenance: verifiedBoundary(DIGEST),
    };
    const first = await complete(deps(pinnedDeps), input);
    const second = await complete(deps(pinnedDeps), input);

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
      deps({
        cache: sharedCache,
        localModelDigest: digestA,
        resolveLocalProvenance: verifiedBoundary(digestA),
      }),
      input,
    );
    const second = await complete(
      deps({
        cache: sharedCache,
        localModelDigest: digestB,
        resolveLocalProvenance: verifiedBoundary(digestB),
      }),
      input,
    );

    expect(first.cacheHit).toBe(false);
    expect(second.cacheHit).toBe(false);
    expect(first.reply).toBe("digest-a");
    expect(second.reply).toBe("digest-b");
    expect(first.modelIdentity).not.toBe(second.modelIdentity);
  });

  it("digest yang dideklarasikan tapi tidak terverifikasi tetap unpinned", async () => {
    // Audit 2026-09-14 S2-5: W13 menandai `pinned=true` hanya karena operator menuliskan
    // digest di env. Itu klaim, bukan bukti, dan justru kelas masalah yang W13 dibuat
    // untuk menutupnya. Runtime tanpa provenance API sekarang dilaporkan apa adanya.
    localPool
      .intercept({ path: "/v1/chat/completions", method: "POST" })
      .reply(200, localReply("first"));
    localPool
      .intercept({ path: "/v1/chat/completions", method: "POST" })
      .reply(200, localReply("second"));

    const sharedCache = new ExactMatchCache();
    const unverified: CompleteDeps["resolveLocalProvenance"] = () =>
      Promise.resolve({
        status: "declared-unverified" as const,
        digest: DIGEST,
        source: "operator-declaration",
        detail: "Runtime lokal tidak mengekspos provenance API yang bisa dihubungi.",
      });

    const first = await complete(
      deps({
        cache: sharedCache,
        localModelDigest: DIGEST,
        resolveLocalProvenance: unverified,
      }),
      input,
    );
    const second = await complete(
      deps({
        cache: sharedCache,
        localModelDigest: DIGEST,
        resolveLocalProvenance: unverified,
      }),
      input,
    );

    expect(first.modelIdentityPinned).toBe(false);
    expect(first.modelIdentityProvenance).toBe("declared-unverified");
    expect(first.modelIdentity).toBe("local:openai-compatible:local-model@unpinned");
    expect(second.cacheHit).toBe(false);
  });

  it("mengadopsi digest yang dilaporkan runtime walau operator tidak mendeklarasikan", async () => {
    localPool
      .intercept({ path: "/v1/chat/completions", method: "POST" })
      .reply(200, localReply("stable"))
      .times(1);

    const sharedCache = new ExactMatchCache();
    const resolved: CompleteDeps["resolveLocalProvenance"] = () =>
      Promise.resolve({
        status: "resolved" as const,
        digest: DIGEST,
        source: "test://api/tags",
      });

    const first = await complete(
      deps({ cache: sharedCache, resolveLocalProvenance: resolved }),
      input,
    );
    const second = await complete(
      deps({ cache: sharedCache, resolveLocalProvenance: resolved }),
      input,
    );

    expect(first.modelIdentityPinned).toBe(true);
    expect(first.modelIdentityProvenance).toBe("resolved");
    expect(first.modelIdentity).toBe(`local:openai-compatible:local-model@${DIGEST}`);
    expect(second.cacheHit).toBe(true);
  });
});
