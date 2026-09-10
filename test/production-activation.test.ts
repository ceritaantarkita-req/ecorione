import { execFile } from "node:child_process";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

async function withServer<T>(handler: Handler, run: (baseUrl: string) => Promise<T>): Promise<T> {
  const server = createServer(handler);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("test server address missing");
  try {
    return await run(`http://127.0.0.1:${String(address.port)}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error === undefined ? resolve() : reject(error))),
    );
  }
}

function json(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(JSON.stringify(body));
}

function runNode(script: string, env: Record<string, string>): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync(process.execPath, [script], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    timeout: 15_000,
  });
}

describe("production activation scripts", () => {
  it("public smoke validates edge routing and protected operator/MCP surfaces", async () => {
    await withServer((req, res) => {
      const origin = `http://${req.headers.host}`;
      const security = { "x-content-type-options": "nosniff", "x-frame-options": "DENY" };
      if (req.url === "/") {
        res.writeHead(200, security);
        res.end("ok");
        return;
      }
      if (req.url === "/ops" || req.url === "/settings") {
        res.writeHead(401);
        res.end();
        return;
      }
      if (req.url === "/.well-known/oauth-protected-resource/mcp") {
        json(res, 200, {
          resource: `${origin}/mcp`,
          authorization_servers: ["https://auth.example.test/"],
        });
        return;
      }
      if (req.url === "/mcp" && req.method === "POST") {
        res.writeHead(401, {
          "www-authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp", scope="memory:read", error="invalid_token"`,
        });
        res.end();
        return;
      }
      res.writeHead(404);
      res.end();
    }, async (baseUrl) => {
      const result = await runNode("scripts/production-public-smoke.mjs", {
        ECORIONE_PUBLIC_BASE_URL: baseUrl,
        ECORIONE_PUBLIC_SMOKE_ALLOW_HTTP: "1",
      });
      expect(result.stdout).toContain("PASS production public smoke");
    });
  });

  it("ops snapshot requires operator auth and fails closed on service health", async () => {
    const user = "operator";
    const password = "test-password";
    const expectedAuth = `Basic ${Buffer.from(`${user}:${password}`, "utf8").toString("base64")}`;
    await withServer((req, res) => {
      if (req.url !== "/api/ops" || req.headers.authorization !== expectedAuth) {
        res.writeHead(401);
        res.end();
        return;
      }
      json(res, 200, {
        generatedAt: "2026-09-10T00:00:00.000Z",
        healthy: true,
        services: [
          { name: "hub", healthy: true },
          { name: "connect", healthy: true },
        ],
        recentTraces: [{ traceId: "trace_test", spans: [] }],
      });
    }, async (baseUrl) => {
      const result = await runNode("scripts/production-ops-snapshot.mjs", {
        ECORIONE_PUBLIC_BASE_URL: baseUrl,
        ECORIONE_PUBLIC_SMOKE_ALLOW_HTTP: "1",
        ECORIONE_OPS_USER: user,
        ECORIONE_OPS_PASSWORD: password,
      });
      expect(result.stdout).toContain('"healthy": true');
      expect(result.stdout).toContain("PASS production-ops-snapshot");
    });
  });

  it("provider matrix validates all configured hosted providers then restores runtime settings", async () => {
    const original = {
      hostedProvider: "anthropic",
      localRuntime: "openai-compatible",
      localBaseUrl: "http://127.0.0.1:11434/v1",
      localModelTag: "local-test",
      hostedCallsEnabled: false,
    };
    let current = { ...original };
    await withServer((req, res) => {
      if (req.headers.authorization !== "Bearer internal-test-token") {
        res.writeHead(401);
        res.end();
        return;
      }
      if (req.url === "/v1/settings/runtime" && req.method === "GET") {
        json(res, 200, { revision: 0, settings: current });
        return;
      }
      if (req.url === "/v1/settings/credentials" && req.method === "GET") {
        json(res, 200, {
          available: true,
          credentials: [
            { provider: "anthropic" },
            { provider: "openrouter" },
            { provider: "openai" },
          ],
        });
        return;
      }
      if (req.url === "/v1/settings/runtime" && req.method === "PUT") {
        let raw = "";
        req.on("data", (chunk) => (raw += String(chunk)));
        req.on("end", () => {
          current = { ...current, ...(JSON.parse(raw) as typeof current) };
          json(res, 200, { revision: 1, settings: current });
        });
        return;
      }
      if (req.url === "/v1/ops/provider-canary" && req.method === "POST") {
        json(res, 200, {
          pass: true,
          provider: current.hostedProvider,
          model: `${current.hostedProvider}-test-model`,
          latencyMs: 10,
        });
        return;
      }
      res.writeHead(404);
      res.end();
    }, async (baseUrl) => {
      const result = await runNode("scripts/provider-matrix-canary.mjs", {
        ECORIONE_CONNECT_URL: baseUrl,
        ECORIONE_INTERNAL_TOKEN: "internal-test-token",
      });
      expect(result.stdout).toContain("PASS provider=anthropic");
      expect(result.stdout).toContain("PASS provider=openrouter");
      expect(result.stdout).toContain("PASS provider=openai");
      expect(result.stdout).toContain("restored original runtime settings");
      expect(current).toEqual(original);
    });
  });

  it("production data evidence requires real-looking ledger, ECX, and provider counters", async () => {
    await withServer((hubReq, hubRes) => {
      if (hubReq.headers.authorization !== "Bearer internal-test-token") {
        hubRes.writeHead(401);
        hubRes.end();
        return;
      }
      if (hubReq.url === "/v1/history/verify") {
        json(hubRes, 200, { sessions: 2, events: 6 });
        return;
      }
      if (hubReq.url === "/v1/ops/observability") {
        json(hubRes, 200, {
          counters: [
            { name: "ecorione_ecx_plans_total", labels: {}, value: 2 },
            { name: "ecorione_ecx_packets_total", labels: {}, value: 3 },
            { name: "ecorione_ecx_packet_bytes_total", labels: {}, value: 600 },
            { name: "ecorione_ecx_hydrations_total", labels: {}, value: 1 },
            { name: "ecorione_ecx_hydrated_items_total", labels: {}, value: 2 },
            { name: "ecorione_ecx_hydration_bytes_total", labels: {}, value: 400 },
          ],
        });
        return;
      }
      hubRes.writeHead(404);
      hubRes.end();
    }, async (hubUrl) => {
      await withServer((connectReq, connectRes) => {
        if (connectReq.headers.authorization !== "Bearer internal-test-token") {
          connectRes.writeHead(401);
          connectRes.end();
          return;
        }
        if (connectReq.url === "/v1/ops/observability") {
          json(connectRes, 200, {
            counters: [
              { name: "ecorione_model_calls_total", labels: {}, value: 5 },
              { name: "ecorione_model_input_tokens_total", labels: {}, value: 1000 },
              { name: "ecorione_model_output_tokens_total", labels: {}, value: 200 },
              { name: "ecorione_model_cache_read_tokens_total", labels: {}, value: 300 },
              { name: "ecorione_model_cache_write_tokens_total", labels: {}, value: 100 },
              { name: "ecorione_model_cost_usd_total", labels: {}, value: 0.1 },
            ],
          });
          return;
        }
        connectRes.writeHead(404);
        connectRes.end();
      }, async (connectUrl) => {
        const result = await runNode("scripts/production-data-evidence.mjs", {
          ECORIONE_HUB_URL: hubUrl,
          ECORIONE_CONNECT_URL: connectUrl,
          ECORIONE_INTERNAL_TOKEN: "internal-test-token",
        });
        expect(result.stdout).toContain('"events": 6');
        expect(result.stdout).toContain('"packets": 3');
        expect(result.stdout).toContain('"modelCalls": 5');
        expect(result.stdout).toContain("does not establish ECX or optimizer savings");
        expect(result.stdout).toContain("PASS production-data-evidence");
      });
    });
  });

  it("all production activation shell scripts are syntactically valid", async () => {
    const scripts = [
      "scripts/production-preflight.sh",
      "scripts/cloudflare-tunnel-install.sh",
      "scripts/cloudflare-origin-lockdown.sh",
      "scripts/host-security-audit.sh",
    ];
    for (const script of scripts) {
      const result = await execFileAsync("bash", ["-n", script], { cwd: process.cwd(), timeout: 5000 });
      expect(result.stderr).toBe("");
    }
  });
});
