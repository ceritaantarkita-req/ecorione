#!/usr/bin/env node
import assert from "node:assert/strict";

const rawBase = process.env.ECORIONE_DR_LOOPBACK_BASE_URL ?? "http://127.0.0.1:18080";
const rawResource = process.env.ECORIONE_DR_EXPECTED_MCP_RESOURCE;

if (!rawResource) {
  throw new Error(
    "ECORIONE_DR_EXPECTED_MCP_RESOURCE is required, for example https://ecorione.example.com/mcp",
  );
}

const base = new URL(rawBase);
assert.equal(base.protocol, "http:", "DR loopback base must use HTTP");
assert(
  base.hostname === "127.0.0.1" || base.hostname === "localhost" || base.hostname === "::1",
  "DR loopback base must stay on loopback",
);
assert.equal(base.username, "", "credentials must not be embedded in the DR loopback URL");
assert.equal(base.password, "", "credentials must not be embedded in the DR loopback URL");
base.pathname = "/";
base.search = "";
base.hash = "";

const expectedResource = new URL(rawResource);
assert.equal(
  expectedResource.protocol,
  "https:",
  "the configured MCP resource must remain the reviewed HTTPS resource",
);
assert.equal(expectedResource.username, "", "MCP resource must not embed credentials");
assert.equal(expectedResource.password, "", "MCP resource must not embed credentials");
assert.equal(expectedResource.search, "", "MCP resource must not include a query");
assert.equal(expectedResource.hash, "", "MCP resource must not include a fragment");

function protectedResourceMetadataUrl(resource) {
  const url = new URL(resource);
  const suffix = url.pathname === "/" ? "" : url.pathname.replace(/\/$/u, "");
  url.pathname = `/.well-known/oauth-protected-resource${suffix}`;
  return url.toString();
}

async function request(path, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    return await fetch(new URL(path, base), {
      redirect: "manual",
      ...init,
      signal: controller.signal,
      headers: {
        "user-agent": "ecorione-dr-loopback-smoke/1",
        ...(init.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

function expectSecurityHeaders(response, label) {
  assert.equal(
    response.headers.get("x-content-type-options"),
    "nosniff",
    `${label}: missing nosniff`,
  );
  assert.equal(response.headers.get("x-frame-options"), "DENY", `${label}: missing frame deny`);
}

const home = await request("/");
assert(home.status >= 200 && home.status < 400, `home expected 2xx/3xx, got ${home.status}`);
expectSecurityHeaders(home, "home");
console.log(`PASS DR loopback home — HTTP ${home.status}`);

for (const operatorPath of ["/ops", "/settings"]) {
  const response = await request(operatorPath);
  assert.equal(response.status, 401, `${operatorPath} must remain protected with HTTP 401`);
  console.log(`PASS DR loopback ${operatorPath} protected — HTTP 401`);
}

const metadataPath = "/.well-known/oauth-protected-resource/mcp";
const metadata = await request(metadataPath);
assert.equal(metadata.status, 200, `protected-resource metadata got HTTP ${metadata.status}`);
const metadataJson = await metadata.json();
assert.equal(
  metadataJson.resource,
  expectedResource.toString(),
  "recovered MCP resource identity changed",
);
assert(
  Array.isArray(metadataJson.authorization_servers) &&
    metadataJson.authorization_servers.length > 0,
  "recovered MCP metadata has no authorization server",
);
console.log("PASS DR loopback MCP protected-resource metadata");

const unauthenticated = await request("/mcp", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "mcp-protocol-version": "2026-07-28",
    "mcp-method": "tools/list",
  },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: "dr-loopback-smoke",
    method: "tools/list",
    params: {
      _meta: {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientInfo": {
          name: "ecorione-dr-loopback-smoke",
          version: "1.0.0",
        },
        "io.modelcontextprotocol/clientCapabilities": {},
      },
    },
  }),
});
assert.equal(unauthenticated.status, 401, "unauthenticated recovered MCP must return 401");
const challenge = unauthenticated.headers.get("www-authenticate") ?? "";
const expectedMetadataUrl = protectedResourceMetadataUrl(expectedResource);
assert(
  challenge.includes(`resource_metadata="${expectedMetadataUrl}"`),
  "recovered MCP challenge resource_metadata changed",
);
assert(
  challenge.includes('scope="memory:read"'),
  "recovered MCP challenge lost memory:read scope",
);
console.log("PASS DR loopback MCP unauthenticated challenge");

console.log(
  `PASS ECORIONE replacement-host loopback edge smoke for ${base.origin}; configured resource remains ${expectedResource.origin}`,
);
