import { describe, expect, it } from "vitest";
import { SpaceBlockSchema, SpaceEmbedBodySchema } from "./space.js";

describe("Space block contract", () => {
  it("rejects block type/body mismatches", () => {
    expect(() =>
      SpaceBlockSchema.parse({
        id: "block_contract01",
        pageId: "page_contract01",
        workspaceId: "ws_personal",
        type: "heading",
        body: { kind: "paragraph", text: "hello" },
        position: 0,
        version: 1,
        createdAt: "2026-09-10T00:00:00.000Z",
        updatedAt: "2026-09-10T00:00:00.000Z",
      }),
    ).toThrow(/Block type/);
  });

  it("fails closed for unsafe embeds", () => {
    expect(() => SpaceEmbedBodySchema.parse({ kind: "embed", url: "http://example.com" })).toThrow();
    expect(() =>
      SpaceEmbedBodySchema.parse({ kind: "embed", url: "https://user:pass@example.com/a" }),
    ).toThrow();
    expect(() =>
      SpaceEmbedBodySchema.parse({ kind: "embed", url: "https://example.com/a#secret" }),
    ).toThrow();
  });
});
