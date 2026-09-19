import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { BrainQuerySchema, DEFAULT_WORKSPACE_ID } from "../packages/shared-schema/src/index.js";
import { buildBrainGraph } from "../apps/ai/lib/brain-projection.js";
import { backupContextDatabase, restoreContextDatabase } from "../services/context/src/backup.js";
import { openContextDatabase, type ContextDatabase } from "../services/context/src/db.js";
import { ContextRepository } from "../services/context/src/repository.js";
import { factInput } from "../services/context/src/test-helpers.js";
import { backupFlowGraphRegistry, restoreFlowGraphRegistry } from "../services/flow/src/backup.js";
import { openFlowDatabase, type FlowDatabase } from "../services/flow/src/db.js";
import { FlowGraphRepository } from "../services/flow/src/graph-repository.js";
import { TriggerRepository } from "../services/flow/src/trigger-repository.js";
import { backupHubDatabase, restoreHubDatabase } from "../services/hub/src/backup.js";
import { openHubDatabase, type HubDatabase } from "../services/hub/src/db.js";
import { ProjectRegistry } from "../services/hub/src/project-registry.js";
import { ProjectSourceRegistry } from "../services/hub/src/project-source-registry.js";

const NOW = "2026-09-19T14:40:00.000Z" as never;
const LATER = "2026-09-19T14:41:00.000Z" as never;
const SOURCE_URL = "https://example.com/pe08-product-closure";

const roots: string[] = [];
const openDatabases: Array<{ close(): void }> = [];

afterEach(() => {
  for (const db of openDatabases.splice(0).reverse()) {
    try {
      db.close();
    } catch {
      // Already closed by the restore drill.
    }
  }
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function track<T extends HubDatabase | ContextDatabase | FlowDatabase>(db: T): T {
  openDatabases.push(db);
  return db;
}

function closeTracked(db: { close(): void }): void {
  const index = openDatabases.indexOf(db);
  if (index >= 0) openDatabases.splice(index, 1);
  db.close();
}

function graph(projectId: string) {
  return {
    id: "fg_pe08closure01",
    workspaceId: DEFAULT_WORKSPACE_ID,
    projectId,
    name: "PE-08 closure flow",
    scope: "personal",
    sensitivity: "INTERNAL",
    maxParallelism: 1,
    nodes: [
      {
        id: "node_trigger1",
        kind: "trigger",
        version: 1,
        label: "Trigger",
        position: { x: 0, y: 0 },
        config: {},
        secretRefs: [],
        limits: {},
        retry: {},
      },
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  } as never;
}

describe("PE-08 Product Evolution restore and rebuild closure", () => {
  it("restores canonical Project/Context/Flow state and rebuilds Brain without Brain persistence", async () => {
    const root = mkdtempSync(join(tmpdir(), "ecorione-pe08-closure-"));
    roots.push(root);
    const backupRoot = join(root, "backups");
    const hubPath = join(root, "hub.sqlite");
    const contextPath = join(root, "context.sqlite");
    const flowPath = join(root, "flow.sqlite");

    const hub = track(openHubDatabase(hubPath));
    const projects = new ProjectRegistry(hub);
    const project = projects.create(
      {
        workspaceId: DEFAULT_WORKSPACE_ID,
        name: "PE-08 closure",
        description: "baseline",
        instruction: "",
        memoryPolicy: "GLOBAL_PLUS_PROJECT",
        autonomyCeiling: "L3",
      },
      NOW,
    );
    const sources = new ProjectSourceRegistry(hub);
    sources.attach({
      projectId: project.id,
      workspaceId: project.workspaceId,
      resourceType: "url",
      resourceId: SOURCE_URL,
      role: "source",
      createdAt: NOW,
    });

    const context = track(openContextDatabase({ path: contextPath }));
    const memory = new ContextRepository(context);
    memory.insertFact(
      factInput({
        id: "mem_pe08_baseline",
        text: "PE08_RESTORE baseline",
        object: "baseline",
        projectId: project.id,
        provenance: { sourceApp: "pe08", sourceUri: SOURCE_URL },
      }),
    );

    const flow = track(openFlowDatabase(flowPath));
    const graphs = new FlowGraphRepository(flow);
    graphs.create(graph(project.id), NOW);
    const triggers = new TriggerRepository(flow);
    const trigger = triggers.create(
      {
        workspaceId: DEFAULT_WORKSPACE_ID,
        projectId: project.id,
        name: "PE-08 manual",
        kind: "manual",
        graphId: "fg_pe08closure01",
        graphVersion: 1,
        versionPolicy: "PINNED",
        requestedAutonomy: "L2",
        enabled: true,
        configuration: {},
      } as never,
      NOW,
    );

    const [hubBackup, contextBackup, flowBackup] = await Promise.all([
      backupHubDatabase(hub, backupRoot, NOW),
      backupContextDatabase(context, backupRoot, NOW),
      backupFlowGraphRegistry(flow, backupRoot, NOW),
    ]);

    projects.update(
      project.id,
      {
        workspaceId: DEFAULT_WORKSPACE_ID,
        description: "mutated-after-backup",
      },
      LATER,
    );
    sources.detach({
      projectId: project.id,
      workspaceId: DEFAULT_WORKSPACE_ID,
      resourceType: "url",
      resourceId: SOURCE_URL,
      role: "source",
    });
    memory.insertFact(
      factInput({
        id: "mem_pe08_after_backup",
        text: "PE08_RESTORE should disappear",
        object: "post-backup",
        projectId: project.id,
      }),
    );
    const secondTrigger = triggers.create(
      {
        workspaceId: DEFAULT_WORKSPACE_ID,
        projectId: project.id,
        name: "PE-08 post-backup",
        kind: "manual",
        graphId: "fg_pe08closure01",
        graphVersion: 1,
        versionPolicy: "PINNED",
        requestedAutonomy: "L1",
        enabled: true,
        configuration: {},
      } as never,
      LATER,
    );

    closeTracked(flow);
    closeTracked(context);
    closeTracked(hub);

    const hubReceipt = restoreHubDatabase(backupRoot, hubBackup.backupId, hubPath, LATER);
    const contextReceipt = restoreContextDatabase(
      backupRoot,
      contextBackup.backupId,
      contextPath,
      LATER,
    );
    const flowReceipt = restoreFlowGraphRegistry(backupRoot, flowBackup.backupId, flowPath, LATER);

    expect(hubReceipt.safetyBackupId).not.toBeNull();
    expect(contextReceipt.safetyBackupId).not.toBeNull();
    expect(flowReceipt.safetyBackupId).not.toBeNull();

    const restoredHub = track(openHubDatabase(hubPath));
    const restoredProjects = new ProjectRegistry(restoredHub);
    const restoredProject = restoredProjects.require(project.id, DEFAULT_WORKSPACE_ID);
    expect(restoredProject.description).toBe("baseline");
    const restoredBindings = new ProjectSourceRegistry(restoredHub).list(
      project.id,
      DEFAULT_WORKSPACE_ID,
    );
    expect(restoredBindings).toMatchObject([
      {
        projectId: project.id,
        workspaceId: DEFAULT_WORKSPACE_ID,
        resourceType: "url",
        resourceId: SOURCE_URL,
        owner: "Connect",
        role: "source",
      },
    ]);

    const restoredContext = track(openContextDatabase({ path: contextPath }));
    const restoredMemory = new ContextRepository(restoredContext);
    expect(
      restoredMemory.getFactForProject("mem_pe08_baseline" as never, project.id)?.text,
    ).toContain("PE08_RESTORE baseline");
    expect(
      restoredMemory.getFactForProject("mem_pe08_after_backup" as never, project.id),
    ).toBeNull();

    const restoredFlow = track(openFlowDatabase(flowPath));
    const restoredGraphs = new FlowGraphRepository(restoredFlow);
    const restoredTriggers = new TriggerRepository(restoredFlow);
    expect(restoredGraphs.list(DEFAULT_WORKSPACE_ID, project.id).map((item) => item.graphId)).toEqual([
      "fg_pe08closure01",
    ]);
    expect(restoredTriggers.list(DEFAULT_WORKSPACE_ID, project.id).map((item) => item.id)).toEqual([
      trigger.id,
    ]);
    expect(restoredTriggers.get(secondTrigger.id)).toBeNull();

    const query = BrainQuerySchema.parse({
      workspaceId: DEFAULT_WORKSPACE_ID,
      projectId: project.id,
      limit: 64,
      runLimit: 20,
    });
    const rebuilt = buildBrainGraph(query, {
      project: restoredProject,
      sources: restoredBindings.map((binding) => ({
        binding,
        availability: "AVAILABLE" as const,
        metadata: { url: binding.resourceId },
        unavailableReason: null,
      })),
      graphs: restoredGraphs.list(DEFAULT_WORKSPACE_ID, project.id),
      triggers: restoredTriggers.list(DEFAULT_WORKSPACE_ID, project.id),
      runs: [],
    });

    expect(rebuilt.nodes.map((node) => node.type)).toEqual([
      "Project",
      "Source",
      "Flow",
      "Trigger",
    ]);
    expect(rebuilt.nodes.some((node) => node.canonicalId === SOURCE_URL)).toBe(false);
    expect(
      rebuilt.nodes.some(
        (node) =>
          node.type === "Source" &&
          node.metadata.resourceId === SOURCE_URL &&
          node.projectId === project.id,
      ),
    ).toBe(true);
    expect(rebuilt.edges.every((edge) => edge.type === "BELONGS_TO" || edge.type === "USES")).toBe(
      true,
    );
  });
});
