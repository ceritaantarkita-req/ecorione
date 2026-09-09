import { readFileSync, writeFileSync } from "node:fs";

function patch(path, from, to) {
  const text = readFileSync(path, "utf8");
  if (!text.includes(from)) throw new Error(`Anchor not found: ${path}`);
  writeFileSync(path, text.replace(from, to));
}

patch(
  "services/hub/src/orchestrate.ts",
  '  if (authority.outcome === "DENY") {\n    throw new CapabilityAuthorityDeniedError(authority.reason);\n  }',
  '  deps.repo.recordAuditEvent({\n    type: authority.outcome === "ALLOW" ? "CAPABILITY_AUTHORIZED" : "CAPABILITY_DENIED",\n    operationId,\n    module: "Hub",\n    detail: {\n      workspaceId,\n      subject: { kind: "model", id: "hosted" },\n      capabilityId: "model.invoke.hosted",\n      permissionIds: ["model.invoke", "network.connect", "provider.spend"],\n      scope: req.scope,\n      sensitivity: req.maxSensitivity,\n      outcome: authority.outcome,\n    },\n    now,\n  });\n  if (authority.outcome === "DENY") {\n    throw new CapabilityAuthorityDeniedError(authority.reason);\n  }',
);

patch(
  "services/hub/src/orchestrate.test.ts",
  'import { chat, hubPrefixDigest, UpstreamError, type OrchestrateDeps } from "./orchestrate.js";',
  'import {\n  CapabilityAuthorityDeniedError,\n  chat,\n  hubPrefixDigest,\n  UpstreamError,\n  type OrchestrateDeps,\n} from "./orchestrate.js";',
);
patch(
  "services/hub/src/orchestrate.test.ts",
  '    ).toEqual(["ACTION_REQUESTED", "POLICY_EVALUATED", "MODEL_CALLED"]);',
  '    ).toEqual([\n      "ACTION_REQUESTED",\n      "POLICY_EVALUATED",\n      "CAPABILITY_AUTHORIZED",\n      "MODEL_CALLED",\n    ]);',
);
patch(
  "services/hub/src/orchestrate.test.ts",
  '  it("Context tidak bisa dihubungi → UpstreamError Context", async () => {',
  '  it("authority deny stops hosted chat before Context or Connect egress", async () => {\n    const err = await chat(\n      deps,\n      chatRequest({ workspaceId: "ws_denied" as never }),\n      NOW,\n    ).catch((e: unknown) => e);\n    expect(err).toBeInstanceOf(CapabilityAuthorityDeniedError);\n    const denied = deps.repo.listAuditEvents({}).filter((event) => event.type === "CAPABILITY_DENIED");\n    expect(denied).toHaveLength(1);\n  });\n\n  it("Context tidak bisa dihubungi → UpstreamError Context", async () => {',
);

console.log("Batch 4 regression hardening applied.");
