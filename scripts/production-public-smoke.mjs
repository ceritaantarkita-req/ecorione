import assert from "node:assert/strict";

const rawBase = process.env.ECORIONE_PUBLIC_BASE_URL;
if (!rawBase) {
  throw new Error(
    "ECORIONE_PUBLIC_BASE_URL is required, for example https://ecorione.example.com",
  );
}

const base = new URL(rawBase);
const allowLoopbackHttp =
  process.env.ECORIONE_PUBLIC_SMOKE_ALLOW_HTTP === "1" &&
  (base.hostname === "127.0.0.1" || base.hostname === "localhost" || base.hostname === "::1");
assert(
  base.protocol === "https:" || (allowLoopbackHttp && base.protocol === "http:"),
  "production public base URL must use HTTPS (HTTP is test-only on loopback with ECORIONE_PUBLIC_SMOKE_ALLOW_HTTP=1)",
);
assert.equal(base.username, "", "credentials must not be embedded in the public URL");
assert.equal(base.password, "", "credentials must not be embedded in the public URL");
base.pathname = "/";
base.search = "";
base.hash = "";

const timeoutMs = Number(process.env.ECORIONE_PUBLIC_SMOKE_TIMEOUT_MS ?? 15000);
if (!Number.isFinite(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60000) {
  throw new Error("ECORIONE_PUBLIC_SMOKE_TIMEOUT_MS must be between 1000 and 60000");
}

async function request(path, init = {}) {
  const url = new URL(path, base);
  const controller = new globalThis.AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      redirect: "manual",
      ...init,
      signal: controller.signal,
      headers: {
        "user-agent": "ecorione-production-smoke/1",
        ...(init.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

function pass(label, detail = "") {
  console.log(`PASS ${label}${detail ? ` — ${detail}` : ""}`);
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
pass("public home", `HTTP ${home.status}`);

for (const operatorPath of ["/ops", "/settings"]) {
  const response = await request(operatorPath);
  assert.equal(response.status, 401, `${operatorPath} must remain protected with HTTP 401`);
  pass(`${operatorPath} protected`, "HTTP 401");
}

const metadataPath = "/.well-known/oauth-protected-resource/mcp";
const metadata = await request(metadataPath);
assert.equal(
  metadata.status,
  200,
  `protected-resource metadata expected HTTP 200, got ${metadata.status}`,
);
const metadataJson = await metadata.json();
assert.equal(
  metadataJson.resource,
  new URL("/mcp", base).toString(),
  "metadata resource URL mismatch",
);
assert(
  Array.isArray(metadataJson.authorization_servers),
  "metadata authorization_servers must be an array",
);
pass("MCP protected-resource metadata", "HTTP 200");

const unauthenticated = await request("/mcp", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: "production-smoke",
    method: "tools/list",
    params: {},
  }),
});
assert.equal(
  unauthenticated.status,
  401,
  `unauthenticated MCP must return 401, got ${unauthenticated.status}`,
);
const challenge = unauthenticated.headers.get("www-authenticate") ?? "";
const expectedMetadata = new URL(metadataPath, base).toString();
assert(
  challenge.includes(`resource_metadata="${expectedMetadata}"`),
  "MCP challenge does not advertise public resource metadata URL",
);
assert(
  challenge.includes("memory:read"),
  "MCP challenge does not advertise minimum memory:read scope",
);
pass("MCP unauthenticated challenge", "HTTP 401 + resource_metadata");

console.log(`PASS production public smoke for ${base.origin}`);
