import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MockAgent,
  getGlobalDispatcher,
  setGlobalDispatcher,
  type Interceptable,
} from "undici";
import { DELETE, GET, POST } from "./route";

let originalDispatcher: ReturnType<typeof getGlobalDispatcher>;
let pool: Interceptable;
let originalHubUrl: string | undefined;

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

describe("/api/projects/:id/sources", () => {
  it("lists Project Sources from Hub", async () => {
    pool
      .intercept({
        path: "/v1/projects/prj_finance/sources?workspaceId=ws_personal",
        method: "GET",
      })
      .reply(200, { sources: [] });

    const res = await GET(
      new Request("http://ai.local/api/projects/prj_finance/sources?workspaceId=ws_personal"),
      { params: Promise.resolve({ id: "prj_finance" }) },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sources: [] });
  });

  it("forwards validated attach and detach requests", async () => {
    const body = {
      workspaceId: "ws_personal",
      resourceType: "url",
      resourceId: "https://example.com/source",
      role: "source",
    };
    pool
      .intercept({
        path: "/v1/projects/prj_finance/sources",
        method: "POST",
        body: JSON.stringify(body),
      })
      .reply(201, {
        availability: "AVAILABLE",
        binding: {
          projectId: "prj_finance",
          ...body,
          owner: "Connect",
          createdAt: "2026-09-19T00:00:00.000Z",
        },
        metadata: { url: body.resourceId },
        unavailableReason: null,
      });
    pool
      .intercept({
        path: "/v1/projects/prj_finance/sources",
        method: "DELETE",
        body: JSON.stringify(body),
      })
      .reply(200, { detached: true });

    const post = await POST(
      new Request("http://ai.local/api/projects/prj_finance/sources", {
        method: "POST",
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id: "prj_finance" }) },
    );
    expect(post.status).toBe(201);

    const del = await DELETE(
      new Request("http://ai.local/api/projects/prj_finance/sources", {
        method: "DELETE",
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id: "prj_finance" }) },
    );
    expect(del.status).toBe(200);
  });

  it("rejects invalid URL source before Hub egress", async () => {
    const res = await POST(
      new Request("http://ai.local/api/projects/prj_finance/sources", {
        method: "POST",
        body: JSON.stringify({
          workspaceId: "ws_personal",
          resourceType: "url",
          resourceId: "http://example.com/nope",
          role: "source",
        }),
      }),
      { params: Promise.resolve({ id: "prj_finance" }) },
    );
    expect(res.status).toBe(400);
  });
});
