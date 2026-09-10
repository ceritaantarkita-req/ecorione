import { createServer } from "@ecorione/shared-server";
import { afterEach, describe, expect, it } from "vitest";
import { openSpaceDatabase, type SpaceDatabase } from "./db.js";
import { buildSpaceServer } from "./http.js";
import { SpaceStore } from "./store.js";

const dbs: SpaceDatabase[] = [];
afterEach(() => {
  for (const db of dbs.splice(0)) db.close();
});

async function createPage(app: ReturnType<typeof buildSpaceServer>): Promise<{ id: string; version: number }> {
  const created = await app.inject({
    method: "POST",
    url: "/v1/pages",
    payload: { workspaceId: "ws_personal", title: "Project notes", scope: "work" },
  });
  expect(created.statusCode).toBe(201);
  return created.json() as { id: string; version: number };
}

describe("Space", () => {
  it("owns typed composition, stable ordering, and optimistic versions", async () => {
    const db = openSpaceDatabase(":memory:");
    dbs.push(db);
    const app = buildSpaceServer(new SpaceStore(db), { contextUrl: "http://127.0.0.1:1" });
    const page = await createPage(app);
    const heading = await app.inject({
      method: "POST",
      url: `/v1/pages/${page.id}/blocks?workspaceId=ws_personal`,
      payload: {
        body: { kind: "heading", text: "Decision", level: 2 },
        position: 0,
        expectedPageVersion: page.version,
      },
    });
    expect(heading.statusCode).toBe(201);
    const headingResult = heading.json() as { block: { id: string; version: number }; pageVersion: number };
    const paragraph = await app.inject({
      method: "POST",
      url: `/v1/pages/${page.id}/blocks?workspaceId=ws_personal`,
      payload: {
        body: { kind: "paragraph", text: "Body" },
        position: 0,
        expectedPageVersion: headingResult.pageVersion,
      },
    });
    expect(paragraph.statusCode).toBe(201);
    const paragraphResult = paragraph.json() as { block: { id: string }; pageVersion: number };
    const fetched = await app.inject({
      method: "GET",
      url: `/v1/pages/${page.id}?workspaceId=ws_personal`,
    });
    const document = fetched.json() as { page: { version: number }; blocks: Array<{ id: string; type: string }> };
    expect(document.blocks.map((block) => block.type)).toEqual(["paragraph", "heading"]);

    const stale = await app.inject({
      method: "PATCH",
      url: `/v1/blocks/${headingResult.block.id}?workspaceId=ws_personal`,
      payload: {
        body: { kind: "heading", text: "stale", level: 2 },
        expectedVersion: headingResult.block.version,
        expectedPageVersion: headingResult.pageVersion,
      },
    });
    expect(stale.statusCode).toBe(409);

    const reordered = await app.inject({
      method: "POST",
      url: `/v1/pages/${page.id}/reorder?workspaceId=ws_personal`,
      payload: {
        blockIds: [headingResult.block.id, paragraphResult.block.id],
        expectedPageVersion: document.page.version,
      },
    });
    expect(reordered.statusCode).toBe(200);
    expect((reordered.json() as { blocks: Array<{ id: string }> }).blocks.map((block) => block.id)).toEqual([
      headingResult.block.id,
      paragraphResult.block.id,
    ]);
    await app.close();
  });

  it("database-view cannot point outside a table block on the same page", async () => {
    const db = openSpaceDatabase(":memory:");
    dbs.push(db);
    const app = buildSpaceServer(new SpaceStore(db), { contextUrl: "http://127.0.0.1:1" });
    const page = await createPage(app);
    const response = await app.inject({
      method: "POST",
      url: `/v1/pages/${page.id}/blocks?workspaceId=ws_personal`,
      payload: {
        body: { kind: "database-view", sourceBlockId: "block_missing01" },
        position: 0,
        expectedPageVersion: 1,
      },
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it("resolves Context and Flow links on demand without copying owner data into Space", async () => {
    const db = openSpaceDatabase(":memory:");
    dbs.push(db);
    const context = createServer({ name: "context-test" });
    context.get<{ Params: { id: string } }>("/v1/access/facts/:id", async (req) => ({
      id: req.params.id,
      text: "owner fact",
    }));
    await context.listen({ port: 0, host: "127.0.0.1" });
    const contextAddress = context.server.address();
    if (contextAddress === null || typeof contextAddress === "string") throw new Error("Context address gagal.");

    const flow = createServer({ name: "flow-test" });
    flow.get<{ Params: { id: string } }>("/v1/graphs/:id", async (req) => ({
      graphId: req.params.id,
      version: 1,
      digest: "a".repeat(64),
      graph: {
        id: req.params.id,
        workspaceId: "ws_personal",
        name: "AI block flow",
        scope: "work",
        sensitivity: "INTERNAL",
        maxParallelism: 1,
        nodes: [
          {
            id: "node_trigger01",
            kind: "trigger",
            definitionId: "core/trigger/v1",
            config: {},
            position: { x: 0, y: 0 },
          },
        ],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      },
      validation: { valid: true, issues: [], plan: null },
      createdAt: "2026-09-10T00:00:00.000Z",
    }));
    await flow.listen({ port: 0, host: "127.0.0.1" });
    const flowAddress = flow.server.address();
    if (flowAddress === null || typeof flowAddress === "string") throw new Error("Flow address gagal.");

    const app = buildSpaceServer(new SpaceStore(db), {
      contextUrl: `http://127.0.0.1:${String(contextAddress.port)}`,
      flowUrl: `http://127.0.0.1:${String(flowAddress.port)}`,
    });
    const page = await createPage(app);
    const contextBlock = await app.inject({
      method: "POST",
      url: `/v1/pages/${page.id}/blocks?workspaceId=ws_personal`,
      payload: {
        body: { kind: "context-link", factId: "mem_fact01", label: "Fact" },
        position: 0,
        expectedPageVersion: 1,
      },
    });
    const contextCreated = contextBlock.json() as { block: { id: string }; pageVersion: number };
    const contextResolved = await app.inject({
      method: "GET",
      url: `/v1/blocks/${contextCreated.block.id}/resolve?workspaceId=ws_personal&maxSensitivity=INTERNAL`,
    });
    expect(contextResolved.statusCode).toBe(200);
    expect(contextResolved.json()).toMatchObject({ source: "context", value: { text: "owner fact" } });

    const aiBlock = await app.inject({
      method: "POST",
      url: `/v1/pages/${page.id}/blocks?workspaceId=ws_personal`,
      payload: {
        body: { kind: "ai", graphId: "fg_flowlink01", prompt: "Summarize" },
        position: 1,
        expectedPageVersion: contextCreated.pageVersion,
      },
    });
    const aiCreated = aiBlock.json() as { block: { id: string } };
    const flowResolved = await app.inject({
      method: "GET",
      url: `/v1/blocks/${aiCreated.block.id}/resolve?workspaceId=ws_personal`,
    });
    expect(flowResolved.statusCode).toBe(200);
    expect(flowResolved.json()).toMatchObject({ source: "flow", value: { graphId: "fg_flowlink01" } });

    const rawRows = db.raw.prepare("SELECT content_json FROM blocks ORDER BY position").all() as Array<{ content_json: string }>;
    expect(rawRows[0]?.content_json).not.toContain("owner fact");
    await app.close();
    await context.close();
    await flow.close();
  });

  it("core-memory edit still forwards to Context rather than storing memory in Space", async () => {
    const db = openSpaceDatabase(":memory:");
    dbs.push(db);
    let received: unknown;
    const context = createServer({ name: "context-test" });
    context.put<{ Params: { label: string } }>("/v1/core-memory/:label", async (req) => {
      received = { label: req.params.label, body: req.body };
      return { ok: true };
    });
    await context.listen({ port: 0, host: "127.0.0.1" });
    const address = context.server.address();
    if (address === null || typeof address === "string") throw new Error("Context test address gagal.");
    const app = buildSpaceServer(new SpaceStore(db), {
      contextUrl: `http://127.0.0.1:${String(address.port)}`,
    });
    const response = await app.inject({
      method: "PUT",
      url: "/v1/core-memory/preferences",
      payload: {
        description: "Preferences",
        value: "Jawab ringkas",
        scope: "personal",
        sensitivity: "INTERNAL",
        syncClass: "LOCAL_ONLY",
      },
    });
    expect(response.statusCode).toBe(200);
    expect(received).toMatchObject({ label: "preferences", body: { value: "Jawab ringkas" } });
    await app.close();
    await context.close();
  });
});
