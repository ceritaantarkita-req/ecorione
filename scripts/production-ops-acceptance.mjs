#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const composePath = "deploy/compose.yml";
const compose = readFileSync(composePath, "utf8");
const caddy = readFileSync("deploy/Caddyfile", "utf8");
const dockerfile = readFileSync("Dockerfile", "utf8");

const NODE_IMAGE = "node:22.20.0-bookworm-slim@sha256:b21fe589dfbe5cc39365d0544b9be3f1f33f55f3c86c87a76ff65a02f8f5848e";
const POSTGRES_IMAGE = "postgres:17.6-alpine@sha256:ef257d85f76e48da1c64832459b59fcaba1a4dac97bf5d7450c77753542eee94";
const TEMPORAL_IMAGE = "temporalio/auto-setup:1.29.7@sha256:f14912b699cf73015ad5c4fc18d522d4b014db90e794039214dfb7c022c2644f";
const CADDY_IMAGE = "caddy:2.11.4-alpine@sha256:ad27e531c8b286ff153c0e6e16587a1583e4111bb58c4d83bd73d6d3ef0a0ce1";

function assert(condition, message) {
  if (!condition) throw new Error(`production-ops acceptance: ${message}`);
}
function count(value, needle) {
  return value.split(needle).length - 1;
}

assert(!compose.includes("docker.sock"), "host Docker socket tidak boleh dimount");
assert(count(compose, "\n    ports:\n") === 1, "hanya reverse proxy yang boleh publish ports");
assert(
  compose.includes(`image: ${TEMPORAL_IMAGE}`),
  "Temporal harus exact-pinned ke readable tag + digest",
);
assert(
  !compose.includes("temporalio/auto-setup:1.31.2"),
  "Temporal tag 1.31.2 yang tidak tersedia tidak boleh kembali",
);
assert(
  compose.includes(`image: ${POSTGRES_IMAGE}`),
  "PostgreSQL harus exact-pinned ke readable tag + digest",
);
assert(
  compose.includes(`image: ${CADDY_IMAGE}`),
  "Caddy harus exact-pinned ke readable tag + digest",
);
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
assert(dockerfile.includes(`FROM ${NODE_IMAGE}`), "Node image harus exact-pinned ke readable tag + digest");

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
