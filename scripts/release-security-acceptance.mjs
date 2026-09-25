#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { reviewTrackedWorkflows } from "./github-actions-pin-review.mjs";
import { reviewTrackedRunnerLabels } from "./github-actions-runner-review.mjs";
import { reviewNodeToolchain } from "./node-toolchain-review.mjs";
import { reviewInstallerToolchain } from "./installer-toolchain-review.mjs";
import { reviewGovernedContainerImages } from "./container-image-review.mjs";

const required = [
  "docs/security-review.md",
  "docs/release-operations.md",
  "docs/developer-sdk.md",
  "docs/adr/0033-final-security-release-closure.md",
  "packages/sdk/src/index.ts",
  "scripts/self-host-install.sh",
  "scripts/self-host-upgrade.sh",
  "scripts/self-host-rollback.sh",
  "scripts/staging-host-evidence.mjs",
  "scripts/staging-cd-forced-command.sh",
  "scripts/staging-cd-root-deploy.sh",
  "scripts/staging-cd-host-bootstrap.sh",
  "scripts/staging-pcs09-inventory.mjs",
  "scripts/staging-pcs09-restart-evidence.mjs",
  "scripts/staging-ssh-hardening.sh",
  "scripts/staging-pcs09-backup.sh",
  "docs/staging-hardening-backup-observability.md",
  "scripts/secret-history-scan.mjs",
  "scripts/dependency-security-review.mjs",
  "scripts/github-actions-pin-review.mjs",
  "scripts/github-actions-runner-review.mjs",
  "scripts/node-toolchain-review.mjs",
  "scripts/installer-toolchain-review.mjs",
  "scripts/container-image-review.mjs",
  ".node-version",
  ".inno-setup-version",
  ".github/workflows/desktop-installer.yml",
  ".github/workflows/ci.yml",
  ".github/workflows/staging-deploy.yml",
  "package.json",
  "apps/ai/app/settings/page.tsx",
  "apps/ai/app/api/settings/[...path]/route.ts",
];
const findings = required.filter((path) => !existsSync(path)).map((path) => `missing ${path}`);
const compose = readFileSync("deploy/compose.yml", "utf8");
const caddy = readFileSync("deploy/Caddyfile", "utf8");
const server = readFileSync("packages/shared-server/src/server.ts", "utf8");
const proxy = readFileSync("apps/ai/lib/settings-proxy.ts", "utf8");
const aiFlowProxy = readFileSync("apps/ai/lib/flow-proxy.ts", "utf8");
const flow = readFileSync("services/flow/src/graph-activities.ts", "utf8");
const sharedClient = readFileSync("packages/shared-server/src/client.ts", "utf8");
const hubMcp = readFileSync("services/hub/src/mcp.ts", "utf8");
const hubExchange = readFileSync("services/hub/src/exchange-http.ts", "utf8");
const hubMultimodal = [
  readFileSync("services/hub/src/multimodal-http.ts", "utf8"),
  readFileSync("services/hub/src/multimodal-analysis.ts", "utf8"),
].join("\n");
const brainContextEcx = readFileSync("apps/ai/lib/brain-context-ecx.ts", "utf8");
const syncHttp = readFileSync("services/sync/src/http.ts", "utf8");
const anthropicProvider = readFileSync("services/connect/src/providers/anthropic.ts", "utf8");
const openAiCompatibleProvider = readFileSync(
  "services/connect/src/providers/openai-compatible.ts",
  "utf8",
);
const multimodalAdapter = readFileSync("services/connect/src/multimodal.ts", "utf8");
const localProvider = readFileSync("services/connect/src/providers/local.ts", "utf8");
const localProvenance = readFileSync(
  "services/connect/src/providers/local-model-provenance.ts",
  "utf8",
);
const mcpAuth = readFileSync("services/connect/src/mcp/auth.ts", "utf8");
const mcpHttp = readFileSync("services/connect/src/mcp/http.ts", "utf8");
const mcpTypes = readFileSync("services/connect/src/mcp-client/types.ts", "utf8");
const mcpSdk = readFileSync("services/connect/src/mcp-client/sdk-client.ts", "utf8");
const sandboxClients = readFileSync("services/sandbox/src/clients.ts", "utf8");
const sandboxReceiptStore = readFileSync("services/sandbox/src/receipt-store.ts", "utf8");
const connectWebhook = readFileSync("services/connect/src/webhook-http.ts", "utf8");
const ci = readFileSync(".github/workflows/ci.yml", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

if (compose.includes("docker.sock"))
  findings.push("application baseline must not mount docker.sock");
if (!caddy.includes("/settings*") || !caddy.includes("basic_auth"))
  findings.push("settings must remain behind operator Basic Auth");
if (!server.includes("timingSafeEqual") || !server.includes("RATE_LIMITED"))
  findings.push("shared auth/rate-limit hardening missing");
if (!proxy.includes("const ALLOWED") || !proxy.includes('redirect: "error"'))
  findings.push("settings proxy path/redirect hardening missing");
if (!flow.includes("ECORIONE_FLOW_HTTP_HOST_ALLOWLIST") || !flow.includes('redirect: "error"'))
  findings.push("Flow SSRF boundary missing");
for (const [boundary, source] of [
  ["shared internal HTTP client", sharedClient],
  ["Hub MCP Artifact fetch", hubMcp],
  ["Hub ECX Artifact fetch", hubExchange],
  ["Hub multimodal Artifact fetch", hubMultimodal],
  ["Ai Brain owner fetch", brainContextEcx],
  ["Sync Connect MCP fetch", syncHttp],
  ["Anthropic provider fetch", anthropicProvider],
  ["OpenAI-compatible provider fetch", openAiCompatibleProvider],
  ["Connect multimodal adapter fetch", multimodalAdapter],
  ["Local completion fetch", localProvider],
  ["Local provenance fetch", localProvenance],
  ["MCP JWKS fetch", mcpAuth],
]) {
  if (!source.includes('redirect: "error"')) {
    findings.push(`${boundary} must fail closed on redirects`);
  }
}
if (
  !mcpAuth.includes("keyForKid") ||
  !mcpAuth.includes("unknownKidRefreshCooldownMs") ||
  !mcpAuth.includes("lastUnknownKidRefreshAtMs") ||
  !mcpAuth.includes("lastUnknownKidRefreshFailed")
) {
  findings.push("MCP JWKS rotation refresh must remain bounded");
}
if (
  !mcpAuth.includes("AbortSignal.timeout") ||
  !mcpAuth.includes("fetchTimeoutMs") ||
  !mcpAuth.includes("DEFAULT_JWKS_FETCH_TIMEOUT_MS")
) {
  findings.push("MCP JWKS fetch must remain timeout-bounded");
}
if (
  !aiFlowProxy.includes("AbortSignal.timeout") ||
  !aiFlowProxy.includes("DEFAULT_FLOW_PROXY_TIMEOUT_MS") ||
  !aiFlowProxy.includes("UPSTREAM_UNAVAILABLE")
) {
  findings.push("Ai -> Flow proxy must remain timeout-bounded");
}
if (
  !sandboxClients.includes("AbortSignal.timeout") ||
  !sandboxClients.includes("DEFAULT_SANDBOX_CONTROL_TIMEOUT_MS") ||
  !sandboxClients.includes("signal: signal()")
) {
  findings.push("Sandbox control-plane HTTP must remain timeout-bounded");
}
if (
  !sandboxReceiptStore.includes("cleanupFailedLockAcquisition") ||
  !sandboxReceiptStore.includes("writeLockMetadata")
) {
  findings.push("Sandbox receipt lock acquisition failure must clean stale lock state");
}
if (
  !connectWebhook.includes("AbortSignal.timeout") ||
  !connectWebhook.includes("DEFAULT_WEBHOOK_FORWARD_TIMEOUT_MS") ||
  !connectWebhook.includes("BadGatewayError")
) {
  findings.push("Connect webhook -> Flow forwarding must remain timeout-bounded");
}
if (
  !mcpAuth.includes("McpAuthDependencyError") ||
  !mcpAuth.includes("parseJwtPart") ||
  !mcpHttp.includes("error instanceof McpAuthDependencyError")
) {
  findings.push(
    "MCP auth error semantics must distinguish invalid tokens from JWKS dependency failures",
  );
}
if (
  !multimodalAdapter.includes("isLocalReachableHost") ||
  !multimodalAdapter.includes("localBaseUrlPublicAllowed") ||
  !multimodalAdapter.includes('this.route === "local"')
) {
  findings.push("local multimodal endpoint scope validation missing");
}
if (!mcpTypes.includes("allowInsecureLoopback") || !mcpTypes.includes("credentialRef"))
  findings.push("MCP transport credential/HTTPS schema missing");
if (!mcpSdk.includes("ECORIONE_MCP_STDIO_ALLOWLIST"))
  findings.push("MCP stdio command allowlist missing");
if (/image:\s+\S+:latest\b/.test(compose)) findings.push("latest Docker image is forbidden");
if (
  packageJson?.scripts?.["dependency:review"] !== "node scripts/dependency-security-review.mjs"
) {
  findings.push("dependency:review package script missing or changed");
}
if (
  packageJson?.scripts?.["actions:pin-review"] !== "node scripts/github-actions-pin-review.mjs"
) {
  findings.push("actions:pin-review package script missing or changed");
}
if (
  packageJson?.scripts?.["actions:runner-review"] !==
  "node scripts/github-actions-runner-review.mjs"
) {
  findings.push("actions:runner-review package script missing or changed");
}
if (
  packageJson?.scripts?.["toolchain:node-review"] !== "node scripts/node-toolchain-review.mjs"
) {
  findings.push("toolchain:node-review package script missing or changed");
}
if (
  packageJson?.scripts?.["toolchain:installer-review"] !==
  "node scripts/installer-toolchain-review.mjs"
) {
  findings.push("toolchain:installer-review package script missing or changed");
}
if (
  packageJson?.scripts?.["images:digest-review"] !== "node scripts/container-image-review.mjs"
) {
  findings.push("images:digest-review package script missing or changed");
}
if (
  packageJson?.scripts?.["staging:host-evidence"] !== "node scripts/staging-host-evidence.mjs"
) {
  findings.push("staging:host-evidence package script missing or changed");
}
const pcs09Scripts = {
  "staging:pcs09:inventory": "node scripts/staging-pcs09-inventory.mjs",
  "staging:pcs09:inventory:strict": "node scripts/staging-pcs09-inventory.mjs --strict",
  "staging:pcs09:restart:baseline":
    "node scripts/staging-pcs09-restart-evidence.mjs --phase baseline",
  "staging:pcs09:restart:post": "node scripts/staging-pcs09-restart-evidence.mjs --phase post",
  "staging:pcs09:ssh:check": "bash scripts/staging-ssh-hardening.sh --check",
  "staging:pcs09:backup": "bash scripts/staging-pcs09-backup.sh --apply",
};
for (const [name, expected] of Object.entries(pcs09Scripts)) {
  if (packageJson?.scripts?.[name] !== expected) {
    findings.push(`${name} package script missing or changed`);
  }
}
if (
  !ci.includes("name: Dependency policy review") ||
  !ci.includes("run: pnpm run dependency:review")
) {
  findings.push("normal CI must execute dependency:review");
}
if (
  !ci.includes("name: GitHub Actions pin review") ||
  !ci.includes("run: pnpm run actions:pin-review")
) {
  findings.push("normal CI must execute actions:pin-review");
}
if (
  !ci.includes("name: GitHub Actions runner review") ||
  !ci.includes("run: pnpm run actions:runner-review")
) {
  findings.push("normal CI must execute actions:runner-review");
}
if (
  !ci.includes("name: Node toolchain review") ||
  !ci.includes("run: pnpm run toolchain:node-review")
) {
  findings.push("normal CI must execute toolchain:node-review");
}
if (
  !ci.includes("name: Installer toolchain review") ||
  !ci.includes("run: pnpm run toolchain:installer-review")
) {
  findings.push("normal CI must execute toolchain:installer-review");
}
if (
  !ci.includes("name: Container image digest review") ||
  !ci.includes("run: pnpm run images:digest-review")
) {
  findings.push("normal CI must execute images:digest-review");
}
if (
  !ci.includes("name: Release security acceptance") ||
  !ci.includes("run: node scripts/release-security-acceptance.mjs")
) {
  findings.push("normal CI must execute release-security acceptance");
}

const actionPinReview = reviewTrackedWorkflows();
for (const finding of actionPinReview.findings) {
  findings.push(`mutable GitHub Action ref: ${finding}`);
}

const runnerReview = reviewTrackedRunnerLabels();
for (const finding of runnerReview.findings) {
  findings.push(`mutable GitHub runner label: ${finding}`);
}

try {
  const nodeToolchainReview = reviewNodeToolchain();
  for (const finding of nodeToolchainReview.findings) {
    findings.push(`Node toolchain drift: ${finding}`);
  }
} catch (error) {
  findings.push(
    `Node toolchain review failed: ${error instanceof Error ? error.message : String(error)}`,
  );
}

try {
  const installerToolchainReview = reviewInstallerToolchain();
  for (const finding of installerToolchainReview.findings) {
    findings.push(`Installer toolchain drift: ${finding}`);
  }
} catch (error) {
  findings.push(
    `Installer toolchain review failed: ${error instanceof Error ? error.message : String(error)}`,
  );
}

try {
  const containerImageReview = reviewGovernedContainerImages();
  for (const finding of containerImageReview.findings) {
    findings.push(`Container image drift: ${finding}`);
  }
} catch (error) {
  findings.push(
    `Container image review failed: ${error instanceof Error ? error.message : String(error)}`,
  );
}

if (findings.length > 0) {
  console.error("release-security-acceptance: FAIL");
  for (const finding of findings) console.error(`  - ${finding}`);
  process.exit(1);
}
console.log("release-security-acceptance: PASS");
