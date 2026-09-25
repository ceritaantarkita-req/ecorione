import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("A-05b.3a Project URL source ingestion contract", () => {
  const connect = readFileSync("services/connect/src/source-fetch.ts", "utf8");
  const connectHttp = readFileSync("services/connect/src/source-fetch-http.ts", "utf8");
  const hub = readFileSync("services/hub/src/project-source-http.ts", "utf8");
  const ai = readFileSync("apps/ai/app/api/projects/[id]/sources/ingest-url/route.ts", "utf8");
  const ui = readFileSync("apps/ai/app/projects/ProjectSources.tsx", "utf8");

  it("keeps external fetch owned by Connect with SSRF and bounded-transfer guards", () => {
    expect(connectHttp).toContain('"/v1/source-fetch/url"');
    expect(connect).toContain('redirect: "error"');
    expect(connect).toContain("AbortSignal.timeout");
    expect(connect).toContain("DEFAULT_EXTERNAL_SOURCE_MAX_BYTES");
    expect(connect).toContain("lookup(hostname");
    expect(connect).toContain("isLocalReachableHost");
    expect(connect).toContain("classifyLocalHost");
  });

  it("snapshots only an already-bound Project URL into Artifact", () => {
    expect(hub).toContain('"/v1/projects/:id/sources/ingest-url"');
    expect(hub).toContain('candidate.resourceType === "url"');
    expect(hub).toContain("`${options.connectUrl}/v1/source-fetch/url`");
    expect(hub).toContain("`${options.artifactUrl}/v1/artifacts`");
    expect(hub).toContain('resourceType: "artifact"');
    expect(hub).toContain('syncClass: "LOCAL_ONLY"');
    expect(hub).toContain('"PROJECT_SOURCE_INGESTED"');
  });

  it("keeps extraction separate and user-triggered from the URL snapshot", () => {
    expect(ai).toContain('makeId("operation")');
    expect(ai).toContain("/sources/ingest-url");
    expect(ai).not.toContain("/v1/multimodal/infer");
    expect(ui).toContain("`${endpoint}/ingest-url`");
    expect(ui).toContain('"Ingest snapshot"');
    expect(ui).toContain("Gunakan Extract pada Artifact");
  });
});
