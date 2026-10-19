import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { openContextDatabase } from "./db.js";
import { buildContextServer } from "./http.js";
import { ContextRepository } from "./repository.js";
import { NOW, T0 } from "./test-helpers.js";

describe("durable Project Memory after Context process restart", () => {
  it("recalls eligible L1 facts in a new session, without replay or privacy leakage", async () => {
    const directory = mkdtempSync(join(tmpdir(), "ecorione-project-memory-"));
    const path = join(directory, "context.db");
    const projectId = "prj_durable" as never;
    const firstDb = openContextDatabase({ path });
    const firstRepo = new ContextRepository(firstDb);
    const extractLocal = vi.fn(async (prompt: string) => {
      const payload = JSON.parse(prompt.split("\n").at(-1) ?? "[]") as {
        id: string;
        text: string;
        syncClass: string;
      }[];
      expect(payload).toHaveLength(1);
      const episode = payload[0]!;
      const marker = episode.syncClass === "LOCAL_ONLY" ? "PRIVAT-339" : "BIRU-742";
      expect(episode.text).toContain(marker);
      expect(prompt).not.toContain(marker === "PRIVAT-339" ? "BIRU-742" : "PRIVAT-339");
      return JSON.stringify({
        facts: [
          {
            sourceEpisodeId: episode.id,
            subject: "kode proyek",
            predicate: "adalah",
            object: marker,
            confidence: 1,
            worthRemembering: true,
          },
        ],
        summaries: [],
      });
    });
    const firstApp = buildContextServer(firstRepo, undefined, {
      extractLocal,
      autoConsolidate: true,
    });
    let firstClosed = false;
    let secondDb: ReturnType<typeof openContextDatabase> | undefined;
    let secondApp: ReturnType<typeof buildContextServer> | undefined;

    try {
      async function recordCompletedTurn(
        sessionId: string,
        syncClass: "LOCAL_ONLY" | "CLOUD_ALLOWED",
        marker: string,
      ): Promise<void> {
        const user = await firstApp.inject({
          method: "POST",
          url: "/v1/episodes",
          payload: {
            ts: T0,
            rawText: `Kode proyek adalah ${marker}`,
            projectId,
            provenance: { sourceApp: "ai", sessionId },
            scope: "personal",
            sensitivity: "INTERNAL",
            syncClass,
            trust: "USER",
          },
        });
        expect(user.statusCode).toBe(201);
        const assistant = await firstApp.inject({
          method: "POST",
          url: "/v1/episodes",
          payload: {
            ts: NOW,
            rawText: "Diterima",
            projectId,
            provenance: { sourceApp: "connect:local", sessionId },
            scope: "personal",
            sensitivity: "INTERNAL",
            syncClass,
            trust: "LOCAL_AGENT",
          },
        });
        expect(assistant.statusCode).toBe(201);
      }

      await recordCompletedTurn("sess_durable_private", "LOCAL_ONLY", "PRIVAT-339");
      await vi.waitFor(() =>
        expect(firstRepo.projectMemoryCounts(projectId).savedFacts).toBe(1),
      );
      await recordCompletedTurn("sess_durable_cloud", "CLOUD_ALLOWED", "BIRU-742");
      await vi.waitFor(() => {
        const counts = firstRepo.projectMemoryCounts(projectId);
        expect(counts.savedFacts).toBe(2);
        expect(counts.pendingEpisodes).toBe(0);
      });
      expect(extractLocal).toHaveBeenCalledTimes(2);

      // A real file-backed Context DB is closed, then opened by a new server.
      await firstApp.close();
      firstDb.close();
      firstClosed = true;
      secondDb = openContextDatabase({ path });
      const secondRepo = new ContextRepository(secondDb);
      secondApp = buildContextServer(secondRepo, undefined);

      const status = await secondApp.inject({
        method: "GET",
        url: "/v1/memory/status?projectId=prj_durable",
      });
      expect(status.statusCode).toBe(200);
      expect(status.json()).toMatchObject({
        pendingEpisodes: 0,
        consolidatedEpisodes: 4,
        savedFacts: 2,
        localOnlyFacts: 1,
        cloudEligibleFacts: 1,
        lastAttempt: "unknown",
      });

      // A new chat session has no chronological episodes but still has L1 recall.
      const newSession = await secondApp.inject({
        method: "GET",
        url: "/v1/episodes?sessionId=sess_durable_new&projectId=prj_durable",
      });
      expect(newSession.statusCode).toBe(200);
      expect(newSession.json().episodes).toEqual([]);

      async function retrieve(query: string, hostedEligibleOnly: boolean, project: string) {
        const response = await secondApp!.inject({
          method: "POST",
          url: "/v1/retrieve",
          payload: {
            query,
            scopes: ["personal"],
            projectId: project,
            hostedEligibleOnly,
            maxSensitivity: "INTERNAL",
            now: NOW,
          },
        });
        expect(response.statusCode).toBe(200);
        return response.json().hits as {
          fact: { object: string; syncClass: string };
        }[];
      }

      expect((await retrieve("BIRU-742", true, "prj_durable"))[0]?.fact.object).toBe(
        "BIRU-742",
      );
      expect((await retrieve("PRIVAT-339", false, "prj_durable"))[0]?.fact.object).toBe(
        "PRIVAT-339",
      );
      expect(await retrieve("PRIVAT-339", true, "prj_durable")).toEqual([]);
      expect(await retrieve("BIRU-742", true, "prj_sibling")).toEqual([]);
      expect(await retrieve("PRIVAT-339", false, "prj_sibling")).toEqual([]);
    } finally {
      await secondApp?.close();
      secondDb?.close();
      if (!firstClosed) {
        await firstApp.close();
        firstDb.close();
      }
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
