#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { reviewTrackedWorkflows } from "./github-actions-pin-review.mjs";
import { reviewTrackedRunnerLabels } from "./github-actions-runner-review.mjs";
import { reviewNodeToolchain } from "./node-toolchain-review.mjs";

const required = [
  "docs/security-review.md",
  "docs/release-operations.md",
  "docs/developer-sdk.md",
  "docs/adr/0033-final-security-release-closure.md",
  "packages/sdk/src/index.ts",
  "scripts/self-host-install.sh",
  "scripts/self-host-upgrade.sh",
  "scripts/self-host-rollback.sh",
  "scripts/secret-history-scan.mjs",
  "scripts/dependency-security-review.mjs",
  "scripts/github-actions-pin-review.mjs",
  "scripts/github-actions-runner-review.mjs",
  "scripts/node-toolchain-review.mjs",
  ".node-version",
  ".github/workflows/ci.yml",
  "package.json",
  "apps/ai/app/settings/page.tsx",
  "apps/ai/app/api/settings/[...path]/route.ts",
];
const findings = required.filter((path) => !existsSync(path)).map((path) => `missing ${path}`);
const compose = readFileSync("deploy/compose.yml", "utf8");
const caddy = readFileSync("deploy/Caddyfile", "utf8");
const server = readFileSync("packages/shared-server/src/server.ts", "utf8");
const proxy = readFileSync("apps/ai/lib/settings-proxy.ts", "utf8");
const flow = readFileSync("services/flow/src/graph-activities.ts", "utf8");
const mcpTypes = readFileSync("services/connect/src/mcp-client/types.ts", "utf8");
const mcpSdk = readFileSync("services/connect/src/mcp-client/sdk-client.ts", "utf8");
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
  findings.push(`Node toolchain review failed: ${error instanceof Error ? error.message : String(error)}`);
}

if (findings.length > 0) {
  console.error("release-security-acceptance: FAIL");
  for (const finding of findings) console.error(`  - ${finding}`);
  process.exit(1);
}
console.log("release-security-acceptance: PASS");
