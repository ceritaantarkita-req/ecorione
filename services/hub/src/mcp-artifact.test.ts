import { afterEach, describe, expect, it } from "vitest";
import { createServer } from "@ecorione/shared-server";
import { openHubDatabase, type HubDatabase } from "./db.js";
import { buildHubServer } from "./http.js";

const dbs: HubDatabase[] = [];
afterEach(() => {
  for (const db of dbs.splice(0)) db.close();
});

describe("MCP memory_open → Artifact", () => {
  it("returns authorized Artifact bytes as base64 instead of the former 501", async () => {
    const artifact = createServer({ name: "artifact-test" });
    artifact.get<{ Params: { id: string } }>(
      "/v1/artifacts/:id/content",
      async (req, reply) => {
        expect(req.query).toMatchObject({ scope: "personal", maxSensitivity: "INTERNAL" });
        return reply.type("text/plain").send(Buffer.from("artifact-body"));
      },
    );
    await artifact.listen({ port: 0, host: "127.0.0.1" });
    const address = artifact.server.address();
    if (address === null || typeof address === "string")
      throw new Error("Artifact test address gagal.");

    const db = openHubDatabase();
    dbs.push(db);
    const hub = buildHubServer(db, {
      contextUrl: "http://127.0.0.1:1",
      connectUrl: "http://127.0.0.1:1",
      rndUrl: "http://127.0.0.1:1",
      artifactUrl: `http://127.0.0.1:${String(address.port)}`,
    });
    const id = `art_${"a".repeat(64)}`;
    const response = await hub.inject({
      method: "POST",
      url: "/v1/mcp/memory/open",
      payload: {
        access: {
          principalId: "test-user",
          sourceApp: "test",
          allowedScopes: ["personal"],
          maxSensitivity: "INTERNAL",
          delivery: "local",
          requestId: "request-1",
        },
        artifactPointer: {
          id,
          path: "/untrusted/caller/path",
          description: "test artifact",
          mimeType: "text/plain",
          sizeBytes: 13,
          scope: "personal",
          sensitivity: "INTERNAL",
          syncClass: "LOCAL_ONLY",
        },
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      artifactId: id,
      contentBase64: Buffer.from("artifact-body").toString("base64"),
      encoding: "base64",
      sizeBytes: 13,
    });
    await hub.close();
    await artifact.close();
  });
});
