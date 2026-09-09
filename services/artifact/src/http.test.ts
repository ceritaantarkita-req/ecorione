import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NotFoundError } from "@ecorione/shared-server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArtifactMetadataClient } from "./context-client.js";
import { buildArtifactServer } from "./http.js";
import { ArtifactStore } from "./store.js";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "ecorione-artifact-http-"));
  dirs.push(dir);
  let pointer: Parameters<ArtifactMetadataClient["register"]>[0] | undefined;
  const metadata: ArtifactMetadataClient = {
    register: vi.fn(async (p) => {
      pointer = p;
      return p;
    }),
    authorize: vi.fn(async (input) => {
      if (pointer === undefined || pointer.id !== input.id || pointer.scope !== input.scope) {
        throw new NotFoundError("denied");
      }
      return pointer;
    }),
  };
  return { app: buildArtifactServer(new ArtifactStore(dir), metadata), metadata };
}

describe("Artifact HTTP", () => {
  it("uploads once, deduplicates repeat, and serves only after authorization", async () => {
    const { app, metadata } = setup();
    const payload = {
      contentBase64: Buffer.from("hello").toString("base64"),
      mimeType: "text/plain",
      description: "hello note",
      scope: "personal",
      sensitivity: "INTERNAL",
    };
    const first = await app.inject({ method: "POST", url: "/v1/artifacts", payload });
    expect(first.statusCode).toBe(201);
    const body = first.json() as { pointer: { id: string } };
    const second = await app.inject({ method: "POST", url: "/v1/artifacts", payload });
    expect(second.statusCode).toBe(200);

    const denied = await app.inject({
      method: "GET",
      url: `/v1/artifacts/${body.pointer.id}/content?scope=work&maxSensitivity=INTERNAL`,
    });
    expect(denied.statusCode).toBe(404);

    const allowed = await app.inject({
      method: "GET",
      url: `/v1/artifacts/${body.pointer.id}/content?scope=personal&maxSensitivity=INTERNAL`,
    });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.body).toBe("hello");
    expect(metadata.authorize).toHaveBeenCalledTimes(2);
    await app.close();
  });
});
