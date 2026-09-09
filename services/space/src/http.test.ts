import { createServer } from "@ecorione/shared-server";
import { afterEach, describe, expect, it } from "vitest";
import { openSpaceDatabase, type SpaceDatabase } from "./db.js";
import { buildSpaceServer } from "./http.js";
import { SpaceStore } from "./store.js";

const dbs: SpaceDatabase[] = [];
afterEach(() => {
  for (const db of dbs.splice(0)) db.close();
});

describe("Space", () => {
  it("CRUD pages and blocks uses Space-owned database", async () => {
    const db = openSpaceDatabase(":memory:");
    dbs.push(db);
    const app = buildSpaceServer(new SpaceStore(db), { contextUrl: "http://127.0.0.1:1" });
    const created = await app.inject({
      method: "POST",
      url: "/v1/pages",
      payload: { title: "Project notes", scope: "work" },
    });
    expect(created.statusCode).toBe(201);
    const page = created.json() as { id: string };
    const block = await app.inject({
      method: "POST",
      url: `/v1/pages/${page.id}/blocks`,
      payload: { type: "heading", content: "Decision", position: 0 },
    });
    expect(block.statusCode).toBe(201);
    const fetched = await app.inject({ method: "GET", url: `/v1/pages/${page.id}` });
    expect((fetched.json() as { blocks: unknown[] }).blocks).toHaveLength(1);
    await app.close();
  });

  it("core-memory edit forwards to the existing Context PUT endpoint", async () => {
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
    if (address === null || typeof address === "string")
      throw new Error("Context test address gagal.");
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
    expect(received).toMatchObject({
      label: "preferences",
      body: {
        description: "Preferences",
        value: "Jawab ringkas",
        scope: "personal",
      },
    });
    await app.close();
    await context.close();
  });
});
