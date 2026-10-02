import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Session 9 Automation product convergence", () => {
  const page = readFileSync("apps/ai/app/automations/page.tsx", "utf8");
  const nav = readFileSync("apps/ai/app/ProductNav.tsx", "utf8");
  const settingsProxy = readFileSync("apps/ai/lib/settings-proxy.ts", "utf8");
  const webhookProxy = readFileSync("apps/ai/app/api/webhooks/[hookId]/route.ts", "utf8");
  const caddy = readFileSync("deploy/Caddyfile", "utf8");
  const caddyStaging = readFileSync("deploy/Caddyfile.sumopod", "utf8");

  it("keeps the first-class Automation surface without turning Schedule into non-time execution", () => {
    expect(nav).toContain('["Automation", "/automations", "automation"]');
    expect(page).toContain("<h1>Automation</h1>");
    expect(page).toContain('trigger.kind === "event"');
    expect(page).toContain('trigger.kind === "webhook"');
    expect(page).toContain("Schedule tetap");
    expect(page).toContain("khusus time Trigger");
    expect(page).not.toContain('"L4"');
  });

  it("keeps Project, Flow, Hub and Temporal owner boundaries visible", () => {
    expect(page).toContain("<ProjectPicker");
    expect(page).toContain("onCreated={useCreatedProject}");
    expect(page).toContain("/api/flow/triggers");
    expect(page).toContain('versionPolicy: "PINNED"');
    expect(page).toContain("/flow?graph=");
    expect(page).toContain("Hub policy");
    expect(page).toContain("Temporal tetap execution truth");
  });

  it("exposes only the existing Connect-owned per-hook token read to the operator UI", () => {
    expect(page).toContain("/api/settings/settings/webhooks/");
    expect(page).toContain("Reveal token");
    expect(settingsProxy).toContain(
      "/^\\/v1\\/settings\\/webhooks\\/[a-z0-9][a-z0-9_-]{15,63}\\/token$/",
    );
    expect(settingsProxy).toContain('method !== "GET"');
    expect(page).toContain("jangan simpan di Trigger");
  });

  it("routes public webhook ingress through Ai while Connect remains private", () => {
    for (const config of [caddy, caddyStaging]) {
      const ingress = config.indexOf("handle_path /webhooks/*");
      const operator = config.indexOf("@operator path");
      expect(ingress).toBeGreaterThan(-1);
      expect(operator).toBeGreaterThan(ingress);
      expect(config).toContain("max_size 96KB");
      expect(config).toContain("rewrite * /api/webhooks{path}");
      expect(config).toContain("reverse_proxy ai:3000");
      expect(config).not.toContain("reverse_proxy connect:17023");
    }
    expect(webhookProxy).toContain("connectUrl()");
    expect(webhookProxy).toContain("/v1/webhooks/");
    expect(webhookProxy).toContain("x-ecorione-webhook-token");
    expect(webhookProxy).toContain("MAX_BODY_BYTES = 96 * 1024");
    expect(webhookProxy).not.toContain("internalToken");
    expect(webhookProxy).not.toContain("authorization");
  });

  it("keeps external caller authority out of the automation configuration", () => {
    expect(page).toContain("X-ECORIONE-Webhook-Token");
    expect(page).toMatch(
      /Workspace, Project, Flow, dan\s+autonomy tidak diterima dari caller\./,
    );
    expect(page).toContain('adapter: "generic" as const');
    expect(page).not.toContain("workspaceId: config.");
    expect(page).not.toContain("projectId: config.");
  });
});
