#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";

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

if (findings.length > 0) {
  console.error("release-security-acceptance: FAIL");
  for (const finding of findings) console.error(`  - ${finding}`);
  process.exit(1);
}
console.log("release-security-acceptance: PASS");
