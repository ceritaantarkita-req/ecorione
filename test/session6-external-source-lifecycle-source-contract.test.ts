import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Session 6 external-source lifecycle contract", () => {
  const ui = readFileSync("apps/ai/app/projects/ProjectSources.tsx", "utf8");
  const hub = readFileSync("services/hub/src/project-source-http.ts", "utf8");
  const registry = readFileSync("services/hub/src/project-source-registry.ts", "utf8");
  const db = readFileSync("services/hub/src/db.ts", "utf8");

  it("loads lifecycle state alongside Project Source bindings", () => {
    expect(ui).toContain("loadLifecycle");
    expect(ui).toContain("/lifecycle?workspaceId=");
    expect(ui).toContain("ProjectExternalSourceLifecycle");
    expect(hub).toContain("/v1/projects/:id/sources/lifecycle");
  });

  it("exposes explicit snapshot, index, refresh, and detach states", () => {
    expect(ui).toContain('"Snapshot ready"');
    expect(ui).toContain('"Indexed"');
    expect(ui).toContain('"Snapshot detached"');
    expect(ui).toContain('"Refresh snapshot"');
    expect(ui).toContain('"Re-index"');
    expect(registry).toContain("'SNAPSHOT_READY'");
    expect(registry).toContain("'INDEXED'");
    expect(registry).toContain("'DETACHED'");
  });

  it("keeps external origin lifecycle separate from Project bindings and owner content", () => {
    expect(db).toContain("project_external_source_lifecycle");
    expect(db).toContain("latest_artifact_id");
    expect(db).toContain("latest_context_episode_id");
    expect(db).not.toContain("external_source_content");
    expect(registry).toContain("upsertExternalLifecycle");
    expect(registry).toContain("markExternalIndexed");
  });

  it("reuses governed ingestion and extraction paths instead of bypassing owners", () => {
    expect(ui).toContain("/ingest-url");
    expect(ui).toContain("/ingest-mcp-resource");
    expect(ui).toContain("/extract");
    expect(hub).toContain("ArtifactUploadResponseSchema");
    expect(hub).toContain("`${options.contextUrl}/v1/episodes`");
    expect(hub).toContain("`${options.contextUrl}/v1/multimodal/derivations`");
  });
});
