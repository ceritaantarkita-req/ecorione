import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MockAgent,
  getGlobalDispatcher,
  setGlobalDispatcher,
  type Interceptable,
} from "undici";
import { POST } from "./route";

let originalDispatcher: ReturnType<typeof getGlobalDispatcher>;
let hubPool: Interceptable;
let artifactPool: Interceptable;
let originalHubUrl: string | undefined;
let originalArtifactUrl: string | undefined;

const ARTIFACT_ID = `art_${"a".repeat(64)}`;
const MAX_PROJECT_SOURCE_UPLOAD_BYTES = 20 * 1024 * 1024;

function uploadRequest(bytes: Uint8Array, name = "notes.txt"): Request {
  const payload = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(payload).set(bytes);
  const form = new FormData();
  form.set("workspaceId", "ws_personal");
  form.set("role", "source");
  form.set("file", new File([payload], name, { type: "text/plain" }));
  return new Request("http://ai.local/api/projects/prj_finance/sources/upload", {
    method: "POST",
    body: form,
  });
}

beforeEach(() => {
  originalDispatcher = getGlobalDispatcher();
  const agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  hubPool = agent.get("http://hub.local");
  artifactPool = agent.get("http://artifact.local");
  originalHubUrl = process.env.ECORIONE_HUB_URL;
  originalArtifactUrl = process.env.ECORIONE_ARTIFACT_URL;
  process.env.ECORIONE_HUB_URL = "http://hub.local";
  process.env.ECORIONE_ARTIFACT_URL = "http://artifact.local";
});

afterEach(() => {
  setGlobalDispatcher(originalDispatcher);
  if (originalHubUrl === undefined) delete process.env.ECORIONE_HUB_URL;
  else process.env.ECORIONE_HUB_URL = originalHubUrl;
  if (originalArtifactUrl === undefined) delete process.env.ECORIONE_ARTIFACT_URL;
  else process.env.ECORIONE_ARTIFACT_URL = originalArtifactUrl;
});

describe("/api/projects/:id/sources/upload", () => {
  it("stores raw bytes in Artifact and attaches the resulting artifact through Hub", async () => {
    const bytes = new TextEncoder().encode("hello");

    hubPool
      .intercept({
        path: "/v1/projects/prj_finance?workspaceId=ws_personal",
        method: "GET",
      })
      .reply(200, { id: "prj_finance", workspaceId: "ws_personal" });

    artifactPool
      .intercept({
        path: "/v1/artifacts",
        method: "POST",
        body: JSON.stringify({
          contentBase64: "aGVsbG8=",
          mimeType: "text/plain",
          description: "Project source: notes.txt",
          scope: "personal",
          sensitivity: "INTERNAL",
          syncClass: "LOCAL_ONLY",
        }),
      })
      .reply(201, {
        pointer: {
          id: ARTIFACT_ID,
          path: `cas/${ARTIFACT_ID}`,
          description: "Project source: notes.txt",
          mimeType: "text/plain",
          sizeBytes: 5,
          scope: "personal",
          sensitivity: "INTERNAL",
          syncClass: "LOCAL_ONLY",
        },
        deduplicated: false,
      });

    hubPool
      .intercept({
        path: "/v1/projects/prj_finance/sources",
        method: "POST",
        body: JSON.stringify({
          workspaceId: "ws_personal",
          resourceType: "artifact",
          resourceId: ARTIFACT_ID,
          role: "source",
        }),
      })
      .reply(201, {
        availability: "AVAILABLE",
        binding: {
          projectId: "prj_finance",
          workspaceId: "ws_personal",
          resourceType: "artifact",
          resourceId: ARTIFACT_ID,
          owner: "Artifact",
          role: "source",
          createdAt: "2026-09-25T00:00:00.000Z",
        },
        metadata: { id: ARTIFACT_ID },
        unavailableReason: null,
      });

    const response = await POST(uploadRequest(bytes), {
      params: Promise.resolve({ id: "prj_finance" }),
    });
    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      artifact: { id: string; syncClass?: string };
      deduplicated: boolean;
      source: { binding: { resourceId: string } };
    };
    expect(body.artifact.id).toBe(ARTIFACT_ID);
    expect(body.artifact.syncClass).toBe("LOCAL_ONLY");
    expect(body.deduplicated).toBe(false);
    expect(body.source.binding.resourceId).toBe(ARTIFACT_ID);
  });

  it("validates Project ownership before uploading bytes", async () => {
    hubPool
      .intercept({
        path: "/v1/projects/prj_finance?workspaceId=ws_personal",
        method: "GET",
      })
      .reply(404, { error: { code: "NOT_FOUND", message: "Project tidak ditemukan." } });

    const response = await POST(uploadRequest(new TextEncoder().encode("hello")), {
      params: Promise.resolve({ id: "prj_finance" }),
    });
    expect(response.status).toBe(404);
  });

  it("rejects files larger than the Artifact owner limit before egress", async () => {
    const response = await POST(
      uploadRequest(new Uint8Array(MAX_PROJECT_SOURCE_UPLOAD_BYTES + 1)),
      {
        params: Promise.resolve({ id: "prj_finance" }),
      },
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "BAD_REQUEST" },
    });
  });
});
