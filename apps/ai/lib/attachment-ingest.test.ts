import { assertId } from "@ecorione/shared-schema";
import { describe, expect, it, vi } from "vitest";
import {
  AttachmentInputError,
  AttachmentUpstreamError,
  MAX_CHAT_ATTACHMENT_BYTES,
  attachmentTaskForMimeType,
  ingestAttachment,
  resolveAttachmentMimeType,
} from "./attachment-ingest";

const artifactId = `art_${"a".repeat(64)}`;
const sessionId = assertId("session", "sess_attachmenttest001");
const operationId = assertId("operation", "op_attachmenttest001");

function artifactPointer(syncClass: "LOCAL_ONLY" | "CLOUD_ALLOWED", mimeType = "image/png") {
  return {
    id: artifactId,
    path: `sha256/${"a".repeat(64)}`,
    description: "Chat attachment: photo.png",
    mimeType,
    sizeBytes: 3,
    scope: "personal",
    sensitivity: "INTERNAL",
    syncClass,
  };
}

function analyzeResponse(
  routeUsed: "local" | "hosted",
  task: "ocr" | "vision" | "transcribe",
) {
  return {
    operationId,
    sessionId,
    sourceArtifactId: artifactId,
    task,
    state: "READY",
    result: {
      routeUsed,
      adapter: "adapter-v1",
      provider: routeUsed === "local" ? "local" : "openai",
      model: "pinned-model-v1",
      language: "unknown",
      text: "derived text",
      segments: [],
      actualUsd: routeUsed === "local" ? 0 : 0.01,
      naiveUsd: routeUsed === "local" ? 0 : 0.02,
    },
    contextEpisodeId: "epi_attachmenttest001",
    historyEventId: "evt_attachmenttest001",
  };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("attachment MIME mapping", () => {
  it("maps browser media/document MIME types to existing multimodal tasks", () => {
    expect(attachmentTaskForMimeType("image/png")).toBe("vision");
    expect(attachmentTaskForMimeType("audio/wav")).toBe("transcribe");
    expect(attachmentTaskForMimeType("video/mp4")).toBe("transcribe");
    expect(attachmentTaskForMimeType("application/pdf")).toBe("ocr");
    expect(attachmentTaskForMimeType("text/plain")).toBe("ocr");
    expect(attachmentTaskForMimeType("application/zip")).toBeNull();
  });

  it("uses a bounded extension fallback only when browser MIME is missing/generic", () => {
    expect(resolveAttachmentMimeType("notes.md", "")).toBe("text/markdown");
    expect(resolveAttachmentMimeType("photo.JPG", "application/octet-stream")).toBe("image/jpeg");
    expect(resolveAttachmentMimeType("archive.zip", "application/octet-stream")).toBe(
      "application/octet-stream",
    );
  });
});

describe("ingestAttachment", () => {
  it("stores bytes in Artifact before asking Hub to hydrate the same session", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({ pointer: artifactPointer("LOCAL_ONLY"), deduplicated: false }, 201),
      )
      .mockResolvedValueOnce(jsonResponse(analyzeResponse("local", "vision")));

    const result = await ingestAttachment(
      {
        sessionId,
        target: "local",
        fileName: "photo.png",
        mimeType: "image/png",
        bytes: new Uint8Array([1, 2, 3]),
      },
      {
        artifactUrl: "http://artifact",
        hubUrl: "http://hub",
        internalToken: "internal-token",
        fetchImpl,
        operationId: () => operationId,
      },
    );

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const [artifactUrl, artifactInit] = fetchImpl.mock.calls[0] ?? [];
    expect(artifactUrl).toBe("http://artifact/v1/artifacts");
    expect((artifactInit?.headers as Record<string, string>).authorization).toBe(
      "Bearer internal-token",
    );
    const artifactBody = JSON.parse(String(artifactInit?.body)) as Record<string, unknown>;
    expect(artifactBody).toMatchObject({
      contentBase64: "AQID",
      mimeType: "image/png",
      scope: "personal",
      sensitivity: "INTERNAL",
      syncClass: "LOCAL_ONLY",
    });

    const [hubUrl, hubInit] = fetchImpl.mock.calls[1] ?? [];
    expect(hubUrl).toBe("http://hub/v1/multimodal/analyze");
    const hubBody = JSON.parse(String(hubInit?.body)) as Record<string, unknown>;
    expect(hubBody).toMatchObject({
      operationId,
      sessionId,
      artifactId,
      scope: "personal",
      maxSensitivity: "INTERNAL",
      task: "vision",
      route: { preferred: "local", allowHostedFallback: false },
    });
    expect(result).toMatchObject({
      artifactId,
      contextEpisodeId: "epi_attachmenttest001",
      task: "vision",
      routeUsed: "local",
      state: "READY",
    });
  });

  it("keeps hosted attachment classification explicit and never enables silent fallback", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            pointer: artifactPointer("CLOUD_ALLOWED", "application/pdf"),
            deduplicated: false,
          },
          201,
        ),
      )
      .mockResolvedValueOnce(jsonResponse(analyzeResponse("hosted", "ocr")));

    await ingestAttachment(
      {
        sessionId,
        target: "hosted",
        fileName: "report.pdf",
        mimeType: "application/pdf",
        bytes: new Uint8Array([1, 2, 3]),
      },
      {
        artifactUrl: "http://artifact",
        hubUrl: "http://hub",
        fetchImpl,
        operationId: () => operationId,
      },
    );

    const artifactBody = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)) as Record<
      string,
      unknown
    >;
    expect(artifactBody.syncClass).toBe("CLOUD_ALLOWED");
    const hubBody = JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body)) as {
      route: { preferred: string; allowHostedFallback: boolean };
    };
    expect(hubBody.route).toEqual({ preferred: "hosted", allowHostedFallback: false });
  });

  it("fails before network I/O for unsupported or oversized input", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(
      ingestAttachment(
        {
          sessionId,
          target: "local",
          fileName: "archive.zip",
          mimeType: "application/zip",
          bytes: new Uint8Array([1]),
        },
        { artifactUrl: "http://artifact", hubUrl: "http://hub", fetchImpl },
      ),
    ).rejects.toBeInstanceOf(AttachmentInputError);
    await expect(
      ingestAttachment(
        {
          sessionId,
          target: "local",
          fileName: "too-large.png",
          mimeType: "image/png",
          bytes: new Uint8Array(MAX_CHAT_ATTACHMENT_BYTES + 1),
        },
        { artifactUrl: "http://artifact", hubUrl: "http://hub", fetchImpl },
      ),
    ).rejects.toBeInstanceOf(AttachmentInputError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("surfaces only the structured upstream message instead of dumping raw payloads", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse(
        {
          error: {
            type: "UPSTREAM_UNAVAILABLE",
            message: "Artifact sedang tidak tersedia.",
          },
          debug: "raw-secret",
        },
        503,
      ),
    );

    let caught: unknown;
    try {
      await ingestAttachment(
        {
          sessionId,
          target: "local",
          fileName: "photo.png",
          mimeType: "image/png",
          bytes: new Uint8Array([1]),
        },
        { artifactUrl: "http://artifact", hubUrl: "http://hub", fetchImpl },
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(AttachmentUpstreamError);
    expect((caught as Error).message).toContain("Artifact sedang tidak tersedia.");
    expect((caught as Error).message).not.toContain("raw-secret");
  });
});
