import { describe, expect, it, vi } from "vitest";
import { MultimodalInferRequestSchema } from "@ecorione/shared-schema";
import { inferMultimodal, type MultimodalAdapter } from "./multimodal.js";
import { CostKillSwitchError, ProviderError } from "./providers/errors.js";

const NOW = "2026-09-10T00:00:00.000Z" as const;

function request(overrides: Record<string, unknown> = {}) {
  return MultimodalInferRequestSchema.parse({
    operationId: "op_multimodaltest001",
    task: "ocr",
    route: { preferred: "local", allowHostedFallback: false },
    syncClass: "LOCAL_ONLY",
    mimeType: "image/png",
    contentBase64: "aGVsbG8=",
    ...overrides,
  });
}

function adapter(
  route: "local" | "hosted",
  infer: MultimodalAdapter["infer"],
): MultimodalAdapter {
  return {
    route,
    estimateReservationUsd: () => (route === "hosted" ? 0.25 : 0),
    infer,
  };
}

function output(overrides: Record<string, unknown> = {}) {
  return {
    adapter: "test-adapter-v1",
    provider: "test-provider",
    model: "test-model-20260910",
    language: "id" as const,
    text: "halo",
    segments: [{ text: "halo", confidence: 0.98, page: 1 }],
    actualUsd: 0,
    naiveUsd: 0,
    ...overrides,
  };
}

describe("native multimodal routing", () => {
  it("uses local first and preserves page/confidence metadata", async () => {
    const localInfer = vi.fn(async () => output());
    const result = await inferMultimodal(
      {
        localAdapter: adapter("local", localInfer),
        hostedProvider: "anthropic",
        hostedCallsEnabled: true,
      },
      request(),
      NOW,
    );
    expect(result.routeUsed).toBe("local");
    expect(result.segments[0]).toMatchObject({ page: 1, confidence: 0.98 });
    expect(localInfer).toHaveBeenCalledTimes(1);
  });

  it("never falls back to hosted unless the request explicitly opts in", async () => {
    const hostedInfer = vi.fn(async () => output({ actualUsd: 0.01, naiveUsd: 0.01 }));
    await expect(
      inferMultimodal(
        {
          localAdapter: adapter("local", async () => {
            throw new ProviderError("local", "offline");
          }),
          hostedAdapter: adapter("hosted", hostedInfer),
          hostedProvider: "anthropic",
          hostedCallsEnabled: true,
        },
        request(),
        NOW,
      ),
    ).rejects.toThrow("offline");
    expect(hostedInfer).not.toHaveBeenCalled();
  });

  it("explicit hosted fallback still fails closed for LOCAL_ONLY data", async () => {
    const hostedInfer = vi.fn(async () => output({ actualUsd: 0.01, naiveUsd: 0.01 }));
    await expect(
      inferMultimodal(
        {
          localAdapter: adapter("local", async () => {
            throw new ProviderError("local", "offline");
          }),
          hostedAdapter: adapter("hosted", hostedInfer),
          hostedProvider: "anthropic",
          hostedCallsEnabled: true,
        },
        request({ route: { preferred: "local", allowHostedFallback: true } }),
        NOW,
      ),
    ).rejects.toThrow("LOCAL_ONLY");
    expect(hostedInfer).not.toHaveBeenCalled();
  });

  it("explicit fallback can use hosted only when sync class permits it", async () => {
    const hostedInfer = vi.fn(async () => output({ actualUsd: 0.01, naiveUsd: 0.02 }));
    const result = await inferMultimodal(
      {
        localAdapter: adapter("local", async () => {
          throw new ProviderError("local", "offline");
        }),
        hostedAdapter: adapter("hosted", hostedInfer),
        hostedProvider: "anthropic",
        hostedCallsEnabled: true,
      },
      request({
        syncClass: "CLOUD_ALLOWED",
        route: { preferred: "local", allowHostedFallback: true },
      }),
      NOW,
    );
    expect(result.routeUsed).toBe("hosted");
    expect(result.actualUsd).toBe(0.01);
    expect(hostedInfer).toHaveBeenCalledTimes(1);
  });

  it("cost kill switch blocks direct hosted multimodal calls", async () => {
    await expect(
      inferMultimodal(
        {
          hostedAdapter: adapter("hosted", async () => output({ actualUsd: 0.01 })),
          hostedProvider: "anthropic",
          hostedCallsEnabled: false,
        },
        request({
          syncClass: "CLOUD_ALLOWED",
          route: { preferred: "hosted", allowHostedFallback: false },
        }),
        NOW,
      ),
    ).rejects.toBeInstanceOf(CostKillSwitchError);
  });

  it("supports TTS audio through the same normalized route", async () => {
    const result = await inferMultimodal(
      {
        localAdapter: adapter("local", async () =>
          output({
            language: "en",
            text: "hello",
            segments: [],
            audioBase64: "UklGRg==",
            audioMimeType: "audio/wav",
          }),
        ),
        hostedProvider: "anthropic",
        hostedCallsEnabled: true,
      },
      request({
        task: "synthesize",
        mimeType: undefined,
        contentBase64: undefined,
        text: "hello",
        language: "en",
      }),
      NOW,
    );
    expect(result.routeUsed).toBe("local");
    expect(result.audioMimeType).toBe("audio/wav");
  });
});
