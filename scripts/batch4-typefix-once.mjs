import { readFileSync, writeFileSync } from "node:fs";

function patch(path, from, to) {
  const text = readFileSync(path, "utf8");
  if (!text.includes(from)) throw new Error(`Anchor not found: ${path}`);
  writeFileSync(path, text.replace(from, to));
}

patch(
  "services/hub/src/capability-registry.test.ts",
  '  ExtensionManifestSchema,\n} from "@ecorione/shared-schema";',
  '  ExtensionManifestSchema,\n  WorkspaceIdSchema,\n} from "@ecorione/shared-schema";',
);
patch(
  "services/hub/src/capability-registry.test.ts",
  '    registry.syncExtensionManifest("ws_alpha", manifest.id, manifest, T0);',
  '    const workspaceId = WorkspaceIdSchema.parse("ws_alpha");\n    registry.syncExtensionManifest(workspaceId, manifest.id, manifest, T0);',
);
patch(
  "services/hub/src/capability-registry.test.ts",
  '    registry.syncExtensionManifest("ws_alpha", changed.id, changed, T0);',
  '    registry.syncExtensionManifest(workspaceId, changed.id, changed, T0);',
);
patch(
  "services/hub/src/capability-registry.test.ts",
  '    expect(registry.listGrants({ workspaceId: "ws_alpha", subject: { kind: "extension", id: manifest.id } })).toHaveLength(0);',
  '    expect(registry.listGrants({ workspaceId, subject: { kind: "extension", id: manifest.id } })).toHaveLength(0);',
);
patch(
  "services/hub/src/orchestrate.test.ts",
  'import { openHubDatabase, type HubDatabase } from "./db.js";',
  'import { CapabilityRegistry } from "./capability-registry.js";\nimport { openHubDatabase, type HubDatabase } from "./db.js";',
);
patch(
  "services/hub/src/orchestrate.test.ts",
  '    history: new HistoryLedger(db),\n    contextUrl:',
  '    history: new HistoryLedger(db),\n    authority: new CapabilityRegistry(db),\n    contextUrl:',
);

console.log("Batch 4 strict type fixtures patched.");
