import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openHubDatabase } from "./db.js";
import { ProjectRegistry } from "./project-registry.js";
import { ProjectSourceRegistry } from "./project-source-registry.js";

const dirs: string[] = [];
const T0 = "2026-09-19T05:00:00.000Z" as never;

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function createProject(projects: ProjectRegistry, name: string) {
  return projects.create(
    {
      workspaceId: "ws_personal",
      name,
      description: "",
      instruction: "",
      memoryPolicy: "GLOBAL_PLUS_PROJECT",
      autonomyCeiling: "L3",
    },
    T0,
  );
}

describe("PE-02 ProjectSourceRegistry", () => {
  it("creates idempotently, isolates Projects, and detaches only the binding", () => {
    const db = openHubDatabase();
    try {
      const projects = new ProjectRegistry(db);
      const sources = new ProjectSourceRegistry(db);
      const a = createProject(projects, "A");
      const b = createProject(projects, "B");

      const input = {
        projectId: a.id,
        workspaceId: a.workspaceId,
        resourceType: "url" as const,
        resourceId: "https://example.com/source",
        role: "source" as const,
        createdAt: T0,
      };
      expect(sources.attach(input).created).toBe(true);
      expect(sources.attach(input).created).toBe(false);
      expect(sources.list(a.id, a.workspaceId)).toHaveLength(1);
      expect(sources.list(b.id, b.workspaceId)).toEqual([]);

      sources.attach({ ...input, projectId: b.id });
      expect(sources.countForResource("ws_personal" as never, "url", input.resourceId)).toBe(2);

      expect(
        sources.detach({
          projectId: a.id,
          workspaceId: a.workspaceId,
          resourceType: "url",
          resourceId: input.resourceId,
          role: "source",
        }),
      ).not.toBeNull();
      expect(sources.list(a.id, a.workspaceId)).toEqual([]);
      expect(sources.list(b.id, b.workspaceId)).toHaveLength(1);
      expect(sources.countForResource("ws_personal" as never, "url", input.resourceId)).toBe(1);
    } finally {
      db.close();
    }
  });

  it("persists bindings across Hub reopen", () => {
    const dir = mkdtempSync(join(tmpdir(), "ecorione-pe02-source-"));
    dirs.push(dir);
    const path = join(dir, "hub.sqlite");

    const first = openHubDatabase(path);
    const project = createProject(new ProjectRegistry(first), "Persistent");
    new ProjectSourceRegistry(first).attach({
      projectId: project.id,
      workspaceId: project.workspaceId,
      resourceType: "url",
      resourceId: "https://example.com/persistent",
      role: "reference",
      createdAt: T0,
    });
    first.close();

    const second = openHubDatabase(path);
    try {
      expect(
        new ProjectSourceRegistry(second).list(project.id, project.workspaceId),
      ).toMatchObject([
        {
          projectId: project.id,
          resourceType: "url",
          resourceId: "https://example.com/persistent",
          owner: "Connect",
          role: "reference",
        },
      ]);
    } finally {
      second.close();
    }
  });
});
