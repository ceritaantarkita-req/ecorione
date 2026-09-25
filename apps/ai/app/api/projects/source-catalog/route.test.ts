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
const envKeys = [
  "ECORIONE_CONTEXT_URL",
  "ECORIONE_SPACE_URL",
  "ECORIONE_FLOW_URL",
  "ECORIONE_CONNECT_URL",
] as const;
let originals: Partial<Record<(typeof envKeys)[number], string>>;

beforeEach(() => {
  originalDispatcher = getGlobalDispatcher();
  const agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  pool = agent.get("http://owners.local");
  originals = {};
  for (const key of envKeys) {
    const value = process.env[key];
    if (value !== undefined) originals[key] = value;
    process.env[key] = "http://owners.local";
  }
});

afterEach(() => {
  setGlobalDispatcher(originalDispatcher);
  for (const key of envKeys) {
    const value = originals[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("GET /api/projects/source-catalog", () => {
  it("normalizes existing owner resources into picker candidates", async () => {
    pool
      .intercept({
        path: "/v1/artifacts?scope=personal&maxSensitivity=RESTRICTED&hostedEligible=0",
        method: "GET",
      })
      .reply(200, {
        pointers: [{ id: "art_report", description: "Q3 report", mimeType: "application/pdf" }],
      });
    pool
      .intercept({
        path: "/v1/pages?workspaceId=ws_personal",
        method: "GET",
      })
      .reply(200, [
        {
          id: "page_notes",
          workspaceId: "ws_personal",
          title: "Research notes",
          scope: "personal",
        },
      ]);
    pool
      .intercept({
        path: "/v1/graphs?workspaceId=ws_personal",
        method: "GET",
      })
      .reply(200, {
        graphs: [{ graphId: "fg_daily_brief", name: "Daily brief", currentVersion: 3 }],
      });
    pool
      .intercept({
        path: "/v1/mcp-outbound/servers?workspaceId=ws_personal",
        method: "GET",
      })
      .reply(200, {
        servers: [{ id: "docs-server", displayName: "Docs", enabled: true }],
      });

    const response = await GET(
      new Request("http://ai.local/api/projects/source-catalog?workspaceId=ws_personal"),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      items: Array<{ resourceType: string; resourceId: string; label: string }>;
      warnings: string[];
    };
    expect(body.warnings).toEqual([]);
    expect(body.items).toEqual([
      {
        resourceType: "artifact",
        resourceId: "art_report",
        label: "Q3 report",
        detail: "application/pdf",
      },
      {
        resourceType: "space-page",
        resourceId: "page_notes",
        label: "Research notes",
        detail: "personal",
      },
      {
        resourceType: "flow-graph",
        resourceId: "fg_daily_brief",
        label: "Daily brief",
        detail: "v3",
      },
      {
        resourceType: "mcp-server",
        resourceId: "docs-server",
        label: "Docs",
        detail: "enabled",
      },
    ]);
  });

  it("returns partial catalog with warnings when one owner is unavailable", async () => {
    pool
      .intercept({
        path: "/v1/artifacts?scope=personal&maxSensitivity=RESTRICTED&hostedEligible=0",
        method: "GET",
      })
      .reply(503, { error: { message: "down" } });
    pool.intercept({ path: "/v1/pages?workspaceId=ws_personal", method: "GET" }).reply(200, []);
    pool
      .intercept({ path: "/v1/graphs?workspaceId=ws_personal", method: "GET" })
      .reply(200, { graphs: [] });
    pool
      .intercept({
        path: "/v1/mcp-outbound/servers?workspaceId=ws_personal",
        method: "GET",
      })
      .reply(200, { servers: [] });

    const response = await GET(
      new Request("http://ai.local/api/projects/source-catalog?workspaceId=ws_personal"),
    );
    const body = (await response.json()) as { items: unknown[]; warnings: string[] };
    expect(response.status).toBe(200);
    expect(body.items).toEqual([]);
    expect(body.warnings).toEqual(["Artifact catalog tidak tersedia."]);
  });

  it("rejects an invalid workspace before owner egress", async () => {
    const response = await GET(
      new Request("http://ai.local/api/projects/source-catalog?workspaceId=bad"),
    );
    expect(response.status).toBe(400);
  });
});
