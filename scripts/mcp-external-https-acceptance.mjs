import { spawn } from "node:child_process";
import { generateKeyPairSync, randomBytes, sign } from "node:crypto";
import { once } from "node:events";
import { createServer as createHttpServer } from "node:http";
import { createServer as createNetServer } from "node:net";

import { MCP_PROTOCOL_VERSION } from "../packages/shared-schema/dist/index.js";
import { buildMcpHttpServer, mcpAuthConfig } from "../services/connect/dist/mcp/http.js";
import { openSyncDatabase } from "../services/sync/dist/db.js";
import { buildSyncServer } from "../services/sync/dist/http.js";

const LOOPBACK = "127.0.0.1";
const CLIENT_ORIGIN = "https://client.acceptance.example";
const CLOUDFLARED_BIN = process.env.CLOUDFLARED_BIN;

if (!CLOUDFLARED_BIN) {
  throw new Error(
    "CLOUDFLARED_BIN wajib menunjuk binary cloudflared yang sudah diverifikasi checksum-nya.",
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function httpPort(server) {
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Tidak bisa menentukan port server acceptance.");
  }
  return address.port;
}

async function listenHttp(server) {
  server.listen(0, LOOPBACK);
  await once(server, "listening");
  return httpPort(server);
}

async function freePort() {
  const server = createNetServer();
  server.listen(0, LOOPBACK);
  await once(server, "listening");
  const port = httpPort(server);
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

async function closeHttp(server) {
  if (!server.listening) return;
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

async function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  const exited = once(child, "exit");
  const timeout = new Promise((resolve) => setTimeout(resolve, 5_000, "timeout"));
  if ((await Promise.race([exited, timeout])) === "timeout") {
    child.kill("SIGKILL");
    await once(child, "exit").catch(() => undefined);
  }
}

async function startTunnel(localUrl, label) {
  const child = spawn(CLOUDFLARED_BIN, ["tunnel", "--no-autoupdate", "--url", localUrl], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const chunks = [];
  const urlPattern = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/iu;
  const logTail = () => chunks.join("").slice(-4000);

  return await new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      void stopChild(child);
      reject(new Error(`Timeout menunggu public HTTPS tunnel ${label}. Log: ${logTail()}`));
    }, 60_000);

    const inspect = (data) => {
      const text = data.toString("utf8");
      chunks.push(text);
      const match = text.match(urlPattern);
      if (match && !settled) {
        settled = true;
        clearTimeout(timer);
        resolve({ child, publicUrl: match[0], logTail });
      }
    };
    child.stdout.on("data", inspect);
    child.stderr.on("data", inspect);
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(
        new Error(
          `cloudflared ${label} berhenti sebelum URL tersedia (code=${String(code)}, signal=${String(signal)}). Log: ${logTail()}`,
        ),
      );
    });
  });
}

async function waitForPublic(url, label, tunnel) {
  const deadline = Date.now() + 60_000;
  let lastError = "belum ada response";
  while (Date.now() < deadline) {
    if (tunnel.child.exitCode !== null || tunnel.child.signalCode !== null) {
      throw new Error(
        `Public HTTPS ${label} tunnel berhenti sebelum ready. Log: ${tunnel.logTail()}`,
      );
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
      if (response.ok) return;
      lastError = `HTTP ${String(response.status)}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error(
    `Public HTTPS ${label} tidak ready: ${lastError}. Tunnel log: ${tunnel.logTail()}`,
  );
}

async function startReadyTunnel(localUrl, label) {
  const failures = [];
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const tunnel = await startTunnel(localUrl, `${label} attempt ${String(attempt)}`);
    try {
      await waitForPublic(
        `${tunnel.publicUrl}/healthz`,
        `${label} attempt ${String(attempt)}`,
        tunnel,
      );
      return tunnel;
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
      await stopChild(tunnel.child);
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1_500));
    }
  }
  throw new Error(
    `Public HTTPS ${label} gagal setelah 2 tunnel attempts: ${failures.join(" | ")}`,
  );
}

function b64urlJson(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function mintJwt({ privateKey, issuer, audience, scope }) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64urlJson({ alg: "RS256", kid: "acceptance-k1", typ: "JWT" });
  const payload = b64urlJson({
    iss: issuer,
    sub: "external-acceptance-user",
    aud: audience,
    exp: now + 600,
    nbf: now - 5,
    scope,
    ecorione_scopes: ["personal"],
    ecorione_max_sensitivity: "INTERNAL",
  });
  const signingInput = `${header}.${payload}`;
  const signature = sign("RSA-SHA256", Buffer.from(signingInput, "utf8"), privateKey).toString(
    "base64url",
  );
  return `${signingInput}.${signature}`;
}

function requestBody(id, method, extraParams = {}) {
  return {
    jsonrpc: "2.0",
    id,
    method,
    params: {
      ...extraParams,
      _meta: {
        "io.modelcontextprotocol/protocolVersion": MCP_PROTOCOL_VERSION,
        "io.modelcontextprotocol/clientInfo": {
          name: "ecorione-external-acceptance",
          version: "1.0.0",
        },
        "io.modelcontextprotocol/clientCapabilities": {},
      },
    },
  };
}

async function mcpRequest(baseUrl, body, { token, origin = CLIENT_ORIGIN, name } = {}) {
  const headers = {
    "content-type": "application/json",
    origin,
    "mcp-protocol-version": MCP_PROTOCOL_VERSION,
    "mcp-method": body.method,
  };
  if (name) headers["mcp-name"] = name;
  if (token) headers.authorization = `Bearer ${token}`;
  return fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
}

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicJwk = {
  ...publicKey.export({ format: "jwk" }),
  kid: "acceptance-k1",
  alg: "RS256",
  use: "sig",
};

let oauthPublicUrl = "";
const oauthServer = createHttpServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }
  if (req.url === "/jwks") {
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify({ keys: [publicJwk] }));
    return;
  }
  if (req.url === "/.well-known/oauth-authorization-server") {
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(
      JSON.stringify({
        issuer: oauthPublicUrl,
        jwks_uri: `${oauthPublicUrl}/jwks`,
        token_endpoint: `${oauthPublicUrl}/token-not-used-by-acceptance`,
        scopes_supported: ["memory:read", "memory:write", "memory:delete"],
      }),
    );
    return;
  }
  res.writeHead(404).end();
});

let hubCalls = 0;
const hubServer = createHttpServer((req, res) => {
  if (req.method !== "POST" || req.url !== "/v1/mcp/memory/search") {
    res.writeHead(404).end();
    return;
  }
  let body = "";
  req.setEncoding("utf8");
  req.on("data", (chunk) => {
    body += chunk;
  });
  req.on("end", () => {
    const parsed = JSON.parse(body);
    assert(
      parsed.access?.principalId === "external-acceptance-user",
      "Principal tidak sampai ke Hub.",
    );
    assert(parsed.query === "external https proof", "Query tools/call berubah di bridge.");
    hubCalls += 1;
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        items: [
          {
            id: "mem_external_acceptance",
            text: "MCP reached Hub through public HTTPS Sync bridge.",
          },
        ],
      }),
    );
  });
});

const syncDb = openSyncDatabase(":memory:");
let connectApp;
let syncApp;
let oauthTunnel;
let syncTunnel;

try {
  const oauthPort = await listenHttp(oauthServer);
  const hubPort = await listenHttp(hubServer);

  oauthTunnel = await startReadyTunnel(`http://${LOOPBACK}:${String(oauthPort)}`, "OAuth/JWKS");
  oauthPublicUrl = oauthTunnel.publicUrl;

  const connectPort = await freePort();
  syncApp = buildSyncServer(syncDb, {
    ownerToken: "external-acceptance-owner-token",
    connectMcpUrl: `http://${LOOPBACK}:${String(connectPort)}`,
    logger: false,
  });
  await syncApp.listen({ host: LOOPBACK, port: 0 });
  const syncPort = httpPort(syncApp.server);

  syncTunnel = await startReadyTunnel(
    `http://${LOOPBACK}:${String(syncPort)}`,
    "Sync MCP bridge",
  );
  const syncPublicUrl = syncTunnel.publicUrl;

  const resource = `${syncPublicUrl}/mcp`;
  connectApp = buildMcpHttpServer({
    hubUrl: `http://${LOOPBACK}:${String(hubPort)}`,
    handleKey: randomBytes(32),
    logger: false,
    auth: mcpAuthConfig({
      issuer: oauthPublicUrl,
      resource,
      jwksUrl: `${oauthPublicUrl}/jwks`,
      allowedOrigins: [CLIENT_ORIGIN],
      defaultMemoryScopes: ["personal"],
      defaultMaxSensitivity: "INTERNAL",
    }),
  });
  await connectApp.listen({ host: LOOPBACK, port: connectPort });

  const unauthenticated = await mcpRequest(
    syncPublicUrl,
    requestBody("challenge", "server/discover"),
  );
  assert(unauthenticated.status === 401, "Request tanpa token harus 401 melalui HTTPS bridge.");
  const challenge = unauthenticated.headers.get("www-authenticate") ?? "";
  const metadataUrl = `${syncPublicUrl}/.well-known/oauth-protected-resource/mcp`;
  assert(
    challenge.includes(`resource_metadata="${metadataUrl}"`),
    "401 challenge tidak menunjuk Protected Resource Metadata publik.",
  );
  assert(
    challenge.includes('scope="memory:read"'),
    "401 challenge tidak mengiklankan scope minimum.",
  );
  assert(
    challenge.includes('error="invalid_token"'),
    "401 challenge tidak menandai invalid_token.",
  );

  const metadataResponse = await fetch(metadataUrl, { signal: AbortSignal.timeout(15_000) });
  assert(
    metadataResponse.ok,
    "Protected Resource Metadata tidak reachable lewat public HTTPS.",
  );
  const metadata = await metadataResponse.json();
  assert(
    metadata.resource === resource,
    "Protected Resource Metadata resource tidak sama dengan MCP publik.",
  );
  assert(
    metadata.authorization_servers?.[0] === oauthPublicUrl,
    "Authorization server metadata berubah di bridge.",
  );

  const token = mintJwt({
    privateKey,
    issuer: oauthPublicUrl,
    audience: resource,
    scope: "memory:read memory:write",
  });

  const discoverResponse = await mcpRequest(
    syncPublicUrl,
    requestBody("discover", "server/discover"),
    { token },
  );
  assert(discoverResponse.status === 200, "server/discover gagal lewat public HTTPS.");
  const discover = await discoverResponse.json();
  assert(discover.result, "server/discover tidak mengembalikan result.");

  const listResponse = await mcpRequest(syncPublicUrl, requestBody("list", "tools/list"), {
    token,
  });
  assert(listResponse.status === 200, "tools/list gagal lewat public HTTPS.");
  const listed = await listResponse.json();
  assert(
    Array.isArray(listed.result?.tools) && listed.result.tools.length >= 5,
    "tools/list tidak mengembalikan tool set MCP.",
  );

  const callBody = requestBody("call", "tools/call", {
    name: "memory_search",
    arguments: { query: "external https proof", scopes: ["personal"], k: 1 },
  });
  const callResponse = await mcpRequest(syncPublicUrl, callBody, {
    token,
    name: "memory_search",
  });
  assert(callResponse.status === 200, "tools/call memory_search gagal lewat public HTTPS.");
  const called = await callResponse.json();
  assert(called.result?.isError === false, "tools/call menghasilkan MCP error result.");
  assert(hubCalls === 1, "Public MCP tools/call tidak mencapai Hub tepat satu kali.");

  const insufficientToken = mintJwt({
    privateKey,
    issuer: oauthPublicUrl,
    audience: resource,
    scope: "memory:write",
  });
  const insufficientResponse = await mcpRequest(syncPublicUrl, callBody, {
    token: insufficientToken,
    name: "memory_search",
  });
  assert(insufficientResponse.status === 403, "Token tanpa memory:read harus ditolak 403.");
  const insufficientChallenge = insufficientResponse.headers.get("www-authenticate") ?? "";
  assert(
    insufficientChallenge.includes('error="insufficient_scope"'),
    "403 tidak mengiklankan insufficient_scope.",
  );
  assert(
    insufficientChallenge.includes('scope="memory:read"'),
    "403 tidak mengiklankan scope yang dibutuhkan.",
  );

  const invalidResponse = await mcpRequest(
    syncPublicUrl,
    requestBody("invalid-token", "server/discover"),
    { token: "not-a-jwt" },
  );
  assert(invalidResponse.status === 401, "JWT malformed harus ditolak 401.");

  const badOriginResponse = await mcpRequest(
    syncPublicUrl,
    requestBody("bad-origin", "server/discover"),
    { token, origin: "https://evil.example" },
  );
  assert(badOriginResponse.status === 403, "Origin yang tidak diizinkan harus ditolak 403.");

  const badRoutingResponse = await fetch(`${syncPublicUrl}/mcp`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      origin: CLIENT_ORIGIN,
      "mcp-protocol-version": MCP_PROTOCOL_VERSION,
      "mcp-method": "tools/list",
    },
    body: JSON.stringify(requestBody("bad-routing", "server/discover")),
    signal: AbortSignal.timeout(15_000),
  });
  assert(badRoutingResponse.status === 400, "Routing header mismatch harus fail closed 400.");

  console.log(
    JSON.stringify(
      {
        status: "PASS",
        transport: "public-https",
        connectBind: `http://${LOOPBACK}:${String(connectPort)}`,
        syncPublicHost: new URL(syncPublicUrl).host,
        oauthPublicHost: new URL(oauthPublicUrl).host,
        checks: [
          "public protected-resource discovery",
          "401 resource_metadata challenge",
          "public JWKS fetch and JWT verification",
          "server/discover",
          "tools/list",
          "tools/call memory_search through Sync to Hub",
          "insufficient scope rejection",
          "malformed JWT rejection",
          "origin rejection",
          "routing header mismatch rejection",
        ],
      },
      null,
      2,
    ),
  );
} finally {
  if (connectApp) await connectApp.close().catch(() => undefined);
  if (syncApp) await syncApp.close().catch(() => undefined);
  syncDb.close();
  if (syncTunnel) await stopChild(syncTunnel.child).catch(() => undefined);
  if (oauthTunnel) await stopChild(oauthTunnel.child).catch(() => undefined);
  await closeHttp(hubServer).catch(() => undefined);
  await closeHttp(oauthServer).catch(() => undefined);
}
