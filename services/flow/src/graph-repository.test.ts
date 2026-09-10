import { describe, expect, it } from "vitest";
import { FlowGraphDocumentSchema } from "@ecorione/shared-schema";
import { openFlowDatabase } from "./db.js";
import { FlowGraphRepository, FlowGraphVersionConflictError } from "./graph-repository.js";

function doc(name = "Graph") {
  return FlowGraphDocumentSchema.parse({
    id: "fg_repository01",
    workspaceId: "ws_personal",
    name,
    scope: "personal",
    sensitivity: "INTERNAL",
    nodes: [
      {
        id: "node_trigger1",
        kind: "trigger",
        version: 1,
        label: "Trigger",
        position: { x: 0, y: 0 },
        config: {},
      },
    ],
    edges: [],
  });
}

describe("FlowGraphRepository", () => {
  it("stores immutable append-only versions and dedupes identical content", () => {
    const db = openFlowDatabase(":memory:");
    try {
      const repo = new FlowGraphRepository(db);
      expect(repo.create(doc(), "2026-09-10T00:00:00.000Z").version.version).toBe(1);
      const dedupe = repo.save(doc(), 1, "2026-09-10T00:00:01.000Z");
      expect(dedupe.deduplicated).toBe(true);
      expect(dedupe.version.version).toBe(1);
      const saved = repo.save(doc("Graph v2"), 1, "2026-09-10T00:00:02.000Z");
      expect(saved.version.version).toBe(2);
      expect(repo.versions("fg_repository01")).toHaveLength(2);
      expect(repo.get("fg_repository01", 1).graph.name).toBe("Graph");
      expect(repo.get("fg_repository01").graph.name).toBe("Graph v2");
    } finally {
      db.close();
    }
  });
  it("fails closed on stale expectedVersion", () => {
    const db = openFlowDatabase(":memory:");
    try {
      const repo = new FlowGraphRepository(db);
      repo.create(doc(), "2026-09-10T00:00:00.000Z");
      repo.save(doc("v2"), 1, "2026-09-10T00:00:01.000Z");
      expect(() => repo.save(doc("stale"), 1, "2026-09-10T00:00:02.000Z")).toThrow(
        FlowGraphVersionConflictError,
      );
    } finally {
      db.close();
    }
  });
});
