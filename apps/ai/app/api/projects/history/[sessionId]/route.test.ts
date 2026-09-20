import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MockAgent,
  getGlobalDispatcher,
  setGlobalDispatcher,
  type Interceptable,
} from "undici";
import { GET } from "./route";

let originalDispatcher: ReturnType<typeof getGlobalDispatcher>;
let pool: Interceptable;
let originalHubUrl: string | undefined;

const SESSION = {
  id: "sess_replay",
  createdAt: "2026-09-20T00:00:00.000Z",
  updatedAt: "2026-09-20T00:01:00.000Z",
  workspaceId: "ws_personal",
  projectId: "prj_finance",
  title: "Finance review",
  scope: "personal",
  sensitivity: "INTERNAL",
  syncClass: "LOCAL_ONLY",
  nextSeq: 3,
  headHash: "c".repeat(64),
};

beforeEach(() => {
  originalDispatcher = getGlobalDispatcher();
  const agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  pool = agent.get("http://hub.local");
  originalHubUrl = process.env.ECORIONE_HUB_URL;
  process.env.ECORIONE_HUB_URL = "http://hub.local";
});

afterEach(() => {
  setGlobalDispatcher(originalDispatcher);
  if (originalHubUrl === undefined) delete process.env.ECORIONE_HUB_URL;
  else process.env.ECORIONE_HUB_URL = originalHubUrl;
});

describe("GET /api/projects/history/[sessionId]", () => {
  it("returns a Project-scoped session and bounded replay", async () => {
    const grant =
      "scope=personal&workspaceId=ws_personal&projectId=prj_finance&maxSensitivity=RESTRICTED&hostedEligible=0";
    pool
      .intercept({
        path: `/v1/history/sessions/sess_replay?${grant}`,
        method: "GET",
      })
      .reply(200, SESSION);
    pool
      .intercept({
        path: `/v1/history/sessions/sess_replay/events?${grant}&afterSeq=-1&limit=500`,
        method: "GET",
      })
      .reply(200, {
        sessionId: "sess_replay",
        afterSeq: -1,
        throughSeq: 2,
        nextSeq: 3,
        events: [
          {
            id: "evt_replay_user",
            sessionId: "sess_replay",
            seq: 0,
            recordedAt: "2026-09-20T00:00:00.000Z",
            eventType: "user.message",
            actor: "user",
            operationId: "op_replay",
            parentEventId: null,
            payload: { text: "hello", target: "local" },
            prevHash: null,
            hash: "a".repeat(64),
          },
          {
            id: "evt_replay_model",
            sessionId: "sess_replay",
            seq: 1,
            recordedAt: "2026-09-20T00:00:01.000Z",
            eventType: "model.called",
            actor: "hub",
            operationId: "op_replay",
            parentEventId: "evt_replay_user",
            payload: {
              responseModel: "gemma4:latest",
              cacheHit: false,
              actualUsd: 0,
              naiveUsd: 0,
              routeReason: "local-consolidation",
            },
            prevHash: "a".repeat(64),
            hash: "b".repeat(64),
          },
          {
            id: "evt_replay_assistant",
            sessionId: "sess_replay",
            seq: 2,
            recordedAt: "2026-09-20T00:00:02.000Z",
            eventType: "agent.message",
            actor: "assistant",
            operationId: "op_replay",
            parentEventId: "evt_replay_model",
            payload: { text: "hi" },
            prevHash: "b".repeat(64),
            hash: "c".repeat(64),
          },
        ],
      });

    const res = await GET(
      new Request(
        "http://ai.local/api/projects/history/sess_replay?workspaceId=ws_personal&projectId=prj_finance",
      ),
      { params: Promise.resolve({ sessionId: "sess_replay" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.session).toMatchObject({
      id: "sess_replay",
      projectId: "prj_finance",
    });
    expect(body.range.events).toHaveLength(3);
    expect(body.truncated).toBe(false);
  });

  it("forwards a fail-closed sibling Project response", async () => {
    const grant =
      "scope=personal&workspaceId=ws_personal&projectId=prj_other&maxSensitivity=RESTRICTED&hostedEligible=0";
    pool
      .intercept({
        path: `/v1/history/sessions/sess_replay?${grant}`,
        method: "GET",
      })
      .reply(404, { error: { code: "NOT_FOUND", message: "History session/range tidak tersedia." } });

    const res = await GET(
      new Request(
        "http://ai.local/api/projects/history/sess_replay?workspaceId=ws_personal&projectId=prj_other",
      ),
      { params: Promise.resolve({ sessionId: "sess_replay" }) },
    );
    expect(res.status).toBe(404);
  });
});
