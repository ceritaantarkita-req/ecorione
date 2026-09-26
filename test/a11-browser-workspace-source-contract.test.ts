import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("A-11 browser Workspace source contract", () => {
  const layout = readFileSync("apps/ai/app/layout.tsx", "utf8");
  const provider = readFileSync("apps/ai/app/WorkspaceProvider.tsx", "utf8");
  const helper = readFileSync("apps/ai/lib/workspace-selection.ts", "utf8");
  const chat = readFileSync("apps/ai/app/page.tsx", "utf8");
  const projects = readFileSync("apps/ai/app/projects/page.tsx", "utf8");
  const work = readFileSync("apps/ai/app/work/page.tsx", "utf8");
  const brain = readFileSync("apps/ai/app/brain/page.tsx", "utf8");
  const space = readFileSync("apps/ai/app/space/page.tsx", "utf8");
  const flow = readFileSync("apps/ai/app/flow/page.tsx", "utf8");
  const flowModel = readFileSync("apps/ai/app/flow/flow-page-model.ts", "utf8");
  const settings = readFileSync("apps/ai/app/settings/page.tsx", "utf8");
  const settingsController = readFileSync(
    "apps/ai/app/settings/useSettingsController.ts",
    "utf8",
  );

  it("provides one validated browser Workspace context from the root layout", () => {
    expect(layout).toContain("<WorkspaceProvider>");
    expect(provider).toContain("resolveWorkspaceId(");
    expect(provider).toContain("window.localStorage.getItem(WORKSPACE_STORAGE_KEY)");
    expect(provider).toContain("params.get(WORKSPACE_QUERY_KEY)");
    expect(helper).toContain('WORKSPACE_STORAGE_KEY = "ecorione.workspaceId"');
    expect(helper).toContain('WORKSPACE_QUERY_KEY = "workspace"');
    expect(helper).toContain("WorkspaceIdSchema.safeParse(value).success");
  });

  it("removes page-level Personal Workspace constants from browser product surfaces", () => {
    for (const source of [chat, projects, work, brain, space, flow, settingsController]) {
      expect(source).not.toContain('const WORKSPACE_ID = "ws_personal"');
      expect(source).not.toContain('const PERSONAL_WORKSPACE_ID = "ws_personal"');
    }
    expect(flowModel).not.toContain('WORKSPACE_ID = "ws_personal"');
  });

  it("binds owner-facing surfaces to the shared Workspace context", () => {
    for (const source of [chat, projects, work, brain, space, flow]) {
      expect(source).toContain("useWorkspace");
      expect(source).toContain("workspaceId");
    }
    expect(settings).toContain("useWorkspace");
    expect(settings).toContain("useSettingsController(activeWorkspaceId)");
  });

  it("waits for browser Workspace resolution before Workspace-scoped owner reads", () => {
    expect(chat).toContain("if (!hydrated || !workspaceReady) return;");
    expect(projects).toContain("if (!workspaceReady) return;");
    expect(work).toContain("if (!workspaceReady) return;");
    expect(brain).toContain("if (!workspaceReady) return;");
    expect(space).toContain("if (!workspaceReady) return;");
    expect(flow).toContain(
      'if (!workspaceReady) throw new Error("Workspace context belum siap.");',
    );
  });

  it("keeps Personal only as the compatibility default, not a page-owned Workspace decision", () => {
    expect(helper).toContain("return DEFAULT_WORKSPACE_ID;");
    expect(provider).toContain("useState<WorkspaceId>(DEFAULT_WORKSPACE_ID)");
  });
});
