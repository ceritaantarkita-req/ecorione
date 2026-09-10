#!/usr/bin/env node
import { writeFileSync } from "node:fs";

const rawBase = process.env.ECORIONE_PUBLIC_BASE_URL;
const user = process.env.ECORIONE_OPS_USER;
const password = process.env.ECORIONE_OPS_PASSWORD;
if (!rawBase || !user || !password) {
  console.error(
    "production-ops-snapshot: ECORIONE_PUBLIC_BASE_URL, ECORIONE_OPS_USER and ECORIONE_OPS_PASSWORD are required",
  );
  process.exit(2);
}

const base = new URL(rawBase);
const allowLoopbackHttp =
  process.env.ECORIONE_PUBLIC_SMOKE_ALLOW_HTTP === "1" &&
  (base.hostname === "127.0.0.1" || base.hostname === "localhost" || base.hostname === "::1");
if (base.protocol !== "https:" && !(allowLoopbackHttp && base.protocol === "http:")) {
  console.error(
    "production-ops-snapshot: public base URL must use HTTPS (HTTP is test-only on loopback with ECORIONE_PUBLIC_SMOKE_ALLOW_HTTP=1)",
  );
  process.exit(2);
}

const auth = Buffer.from(`${user}:${password}`, "utf8").toString("base64");
const response = await fetch(new URL("/api/ops", base), {
  headers: { authorization: `Basic ${auth}`, "user-agent": "ecorione-ops-snapshot/1" },
  cache: "no-store",
  signal: AbortSignal.timeout(15000),
});
const body = await response.json().catch(() => null);
if (!response.ok || !body || typeof body !== "object") {
  console.error(`production-ops-snapshot: HTTP ${String(response.status)}`, body);
  process.exit(1);
}

const services = Array.isArray(body.services) ? body.services : [];
const unhealthy = services.filter(
  (service) => !service || typeof service !== "object" || service.healthy !== true,
);
const summary = {
  generatedAt: typeof body.generatedAt === "string" ? body.generatedAt : null,
  healthy: body.healthy === true,
  serviceCount: services.length,
  unhealthyServices: unhealthy.map((service) =>
    service && typeof service === "object" ? service.name : "unknown",
  ),
  traceGroups: Array.isArray(body.recentTraces) ? body.recentTraces.length : 0,
};

console.log(JSON.stringify(summary, null, 2));

const outputPath = process.env.ECORIONE_OPS_SNAPSHOT_OUT;
if (outputPath) {
  writeFileSync(outputPath, `${JSON.stringify(body, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  console.log(`production-ops-snapshot: wrote mode-0600 snapshot to ${outputPath}`);
}

if (body.healthy !== true || unhealthy.length > 0) {
  console.error("FAIL production-ops-snapshot: one or more services are unhealthy");
  process.exit(1);
}

console.log("PASS production-ops-snapshot");
