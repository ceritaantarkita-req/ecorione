import { assertId } from "@ecorione/shared-schema";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openHubDatabase, type HubDatabase } from "./db.js";
import { HistoryLedger } from "./history-ledger.js";
import { buildHubServer } from "./http.js";

const NOW = "2026-09-20T00:00:00.000Z";
const SESSION_ID = assertId("session", "sess_pcs01_history");

describe("History HTTP Project binding", () => {
  let db: HubDatabase;
  let app: FastifyInstance;

  beforeEach(() => {
    db = openHubDatabase();
    app = buildHubServer(db, {
      contextUrl: "http://context.invalid",
      connectUrl: "http://connect.invalid",
      rndUrl: "http://rnd.invalid",
    });
    const ledger = new HistoryLedger(db);
    ledger.createSession({
      id: SESSION_ID,
      createdAt: NOW,
      workspaceId: "ws_personal" as never,
      projectId: "prj_finance" as never,
      scope: "personal",
      sensitivity: "INTERNAL",
      syncClass: "LOCAL_ONLY",
      title: "Finance review",
    });
    ledger.appendNext(SESSION_ID, {
      id: assertId("event", "evt_pcs01_user"),
      recordedAt: NOW,
      eventType: "user.message",
      actor: "user",
      operationId: null,
      parentEventId: null,
      payload: { text: "hello" },
    });
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it("returns one session only inside its requested Workspace + Project", async () => {
    const allowed = await app.inject({
      method: "GET",
      url: `/v1/history/sessions/${SESSION_ID}?scope=personal&workspaceId=ws_personal&projectId=prj_finance&maxSensitivity=RESTRICTED&hostedEligible=0`,
    });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json()).toMatchObject({
      id: SESSION_ID,
      workspaceId: "ws_personal",
      projectId: "prj_finance",
    });

    const sibling = await app.inject({
      method: "GET",
      url: `/v1/history/sessions/${SESSION_ID}?scope=personal&workspaceId=ws_personal&projectId=prj_other&maxSensitivity=RESTRICTED&hostedEligible=0`,
    });
    expect(sibling.statusCode).toBe(404);
  });

  it("does not disclose events through a sibling Project query", async () => {
    const sibling = await app.inject({
      method: "GET",
      url: `/v1/history/sessions/${SESSION_ID}/events?scope=personal&workspaceId=ws_personal&projectId=prj_other&maxSensitivity=RESTRICTED&hostedEligible=0&afterSeq=-1&limit=100`,
    });
    expect(sibling.statusCode).toBe(404);

    const allowed = await app.inject({
      method: "GET",
      url: `/v1/history/sessions/${SESSION_ID}/events?scope=personal&workspaceId=ws_personal&projectId=prj_finance&maxSensitivity=RESTRICTED&hostedEligible=0&afterSeq=-1&limit=100`,
    });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json().events).toHaveLength(1);
  });
});
