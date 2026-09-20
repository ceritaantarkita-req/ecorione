import { describe, expect, it, vi } from "vitest";
import type { LocalModelDigest } from "./local-model-identity.js";
import { discoverLocalRuntime, localModelsUrl } from "./local-runtime-discovery.js";

const input = {
  runtime: "openai-compatible" as const,
  baseUrl: "http://127.0.0.1:11434/v1",
  modelTag: "qwen3:8b-instruct-q4_K_M",
};

describe("local runtime discovery", () => {
  it("uses the OpenAI-compatible models endpoint", () => {
    expect(localModelsUrl(input.baseUrl)).toBe("http://127.0.0.1:11434/v1/models");
    expect(localModelsUrl("http://localhost:1234/v1/")).toBe("http://localhost:1234/v1/models");
  });

  it("reports connected only when the configured model is advertised", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: [{ id: "qwen3:8b-instruct-q4_K_M" }, { id: "another-model" }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );

    const result = await discoverLocalRuntime(input, { fetcher });
    expect(result).toMatchObject({
      state: "connected",
      reachable: true,
      ready: true,
      configuredModel: input.modelTag,
    });
    expect(result.models).toEqual(["qwen3:8b-instruct-q4_K_M", "another-model"]);
    expect(fetcher).toHaveBeenCalledWith(
      "http://127.0.0.1:11434/v1/models",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("resolves an Ollama digest without making Ollama mandatory", async () => {
    const digest = `sha256:${"a".repeat(64)}`;
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/v1/models")) {
        return new Response(JSON.stringify({ data: [{ id: "qwen3:8b-instruct-q4_K_M" }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.endsWith("/api/tags")) {
        return new Response(
          JSON.stringify({
            models: [
              {
                name: "qwen3:8b-instruct-q4_K_M",
                model: "qwen3:8b-instruct-q4_K_M",
                digest,
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("not found", { status: 404 });
    });

    const result = await discoverLocalRuntime(input, { fetcher });
    expect(result).toMatchObject({
      state: "connected",
      ready: true,
      modelDigest: digest,
      identityProvenance: "resolved",
    });
  });

  it("reports a declared digest mismatch as not ready", async () => {
    const observed = `sha256:${"a".repeat(64)}`;
    const declared = `sha256:${"b".repeat(64)}` as LocalModelDigest;
    const fetcher = vi.fn(async (request: string | URL | Request) => {
      const url = String(request);
      if (url.endsWith("/v1/models")) {
        return new Response(JSON.stringify({ data: [{ id: "qwen3:8b-instruct-q4_K_M" }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
          models: [
            {
              name: "qwen3:8b-instruct-q4_K_M",
              digest: observed,
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    const result = await discoverLocalRuntime(
      { ...input, declaredDigest: declared },
      { fetcher },
    );
    expect(result).toMatchObject({
      state: "identity-mismatch",
      reachable: true,
      ready: false,
      modelDigest: observed,
    });
  });

  it("distinguishes reachable endpoint from missing configured model", async () => {
    const result = await discoverLocalRuntime(input, {
      fetcher: async () =>
        new Response(JSON.stringify({ data: [{ id: "different-model" }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    });
    expect(result).toMatchObject({
      state: "model-missing",
      reachable: true,
      ready: false,
      models: ["different-model"],
    });
  });

  it("treats network failure as a normal not-connected state", async () => {
    const result = await discoverLocalRuntime(input, {
      fetcher: async () => {
        throw new Error("ECONNREFUSED");
      },
    });
    expect(result).toMatchObject({
      state: "unreachable",
      reachable: false,
      ready: false,
      models: [],
    });
  });

  it("keeps reachable non-discoverable runtimes explicit rather than guessing", async () => {
    const result = await discoverLocalRuntime(input, {
      fetcher: async () => new Response("not supported", { status: 404 }),
    });
    expect(result).toMatchObject({
      state: "unsupported",
      reachable: true,
      ready: false,
    });
  });
});
