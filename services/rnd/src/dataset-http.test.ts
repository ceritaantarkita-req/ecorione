import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openRndDatabase } from "./db.js";
import { buildRndServer } from "./http.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("RnD dataset governance HTTP", () => {
  it("creates and lists an immutable governed release", async () => {
    const root = mkdtempSync(join(tmpdir(), "ecorione-rnd-http-dataset-"));
    roots.push(root);
    const db = openRndDatabase();
    const app = buildRndServer(db, { token: "secret", datasetRoot: join(root, "datasets") });
    try {
      const created = await app.inject({
        method: "POST",
        url: "/v1/datasets/releases",
        headers: { authorization: "Bearer secret" },
        payload: {
          dataset: "quality-eval",
          schemaName: "quality-example",
          schemaVersion: "1",
          sources: [
            {
              owner: "rnd",
              kind: "trace-export",
              identity: "source-1",
              digest: "b".repeat(64),
            },
          ],
          records: [{ id: "r1", payload: { answer: "ok", apiKey: "must-redact" } }],
        },
      });
      expect(created.statusCode).toBe(201);
      expect(created.json().quality.sanitation.secretFieldsRedacted).toBe(1);
      const releaseId = created.json().releaseId as string;

      const listed = await app.inject({
        method: "GET",
        url: "/v1/datasets/releases?dataset=quality-eval",
        headers: { authorization: "Bearer secret" },
      });
      expect(listed.statusCode).toBe(200);
      expect(listed.json().releases).toHaveLength(1);
      expect(listed.json().releases[0].releaseId).toBe(releaseId);
    } finally {
      await app.close();
      db.close();
    }
  });
});
