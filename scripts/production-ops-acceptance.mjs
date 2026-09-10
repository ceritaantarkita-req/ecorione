#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const composePath = "deploy/compose.yml";
const compose = readFileSync(composePath, "utf8");
const caddy = readFileSync("deploy/Caddyfile", "utf8");
const dockerfile = readFileSync("Dockerfile", "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(`production-ops acceptance: ${message}`);
}
function count(value, needle) {
  return value.split(needle).length - 1;
}

assert(!compose.includes("docker.sock"), "host Docker socket tidak boleh dimount");
assert(count(compose, "\n    ports:\n") === 1, "hanya reverse proxy yang boleh publish ports");
assert(compose.includes("image: temporalio/auto-setup:1.29.7"), "Temporal harus exact-pinned ke tag pull/run-verified");
assert(!compose.includes("temporalio/auto-setup:1.31.2"), "Temporal tag 1.31.2 yang tidak tersedia tidak boleh kembali");
assert(compose.includes("image: postgres:17.6-alpine"), "PostgreSQL harus exact-pinned");
assert(compose.includes("image: caddy:2.11.4-alpine"), "Caddy harus exact-pinned");
assert(
  compose.includes("network_mode: service:sync"),
  "MCP harus berbagi namespace dengan Sync",
);
assert(compose.includes("ECORIONE_MCP_HOST: 127.0.0.1"), "MCP inbound harus loopback-only");
for (const volume of [
  "rnd_data",
  "context_data",
  "connect_data",
  "hub_data",
  "artifact_data",
  "sandbox_data",
  "space_data",
  "flow_data",
  "sync_data",
  "temporal_db",
]) {
  assert(compose.includes(`${volume}:`), `persistent volume ${volume} hilang`);
}
assert(caddy.includes("basic_auth"), "operator routes harus dilindungi auth reverse proxy");
assert(caddy.includes("X-Content-Type-Options"), "security headers Caddy hilang");
assert(caddy.includes("reverse_proxy sync:17011"), "public MCP harus lewat Sync");
assert(!caddy.includes("connect:17023"), "Connect tidak boleh diekspos reverse proxy");
assert(dockerfile.includes("node:22.20.0-bookworm-slim"), "Node image harus exact-pinned");

const env = {
  ...process.env,
  ECORIONE_INTERNAL_TOKEN: "acceptance-internal-token-long-enough",
  ECORIONE_SYNC_OWNER_TOKEN: "acceptance-sync-owner-token-long-enough",
  TEMPORAL_POSTGRES_PASSWORD: "acceptance-temporal-password",
  ECORIONE_DOMAIN: "localhost",
  ECORIONE_OPS_PASSWORD_HASH: "acceptance-hash",
  ECORIONE_MCP_OAUTH_ISSUER: "https://auth.example.test/",
  ECORIONE_MCP_RESOURCE: "https://localhost/mcp",
  ECORIONE_MCP_JWKS_URL: "https://auth.example.test/jwks.json",
  ECORIONE_MCP_HANDLE_KEY: "acceptance-handle-key-long-enough",
  ECORIONE_MCP_ALLOWED_ORIGINS: "https://chatgpt.com",
};
const result = spawnSync("docker", ["compose", "-f", composePath, "config", "--quiet"], {
  cwd: process.cwd(),
  env,
  encoding: "utf8",
});
if (result.error !== undefined) {
  throw new Error(`docker compose tidak tersedia: ${result.error.message}`);
}
assert(
  result.status === 0,
  `docker compose config gagal: ${(result.stderr || result.stdout).trim()}`,
);
console.log("production-ops acceptance: PASS");
