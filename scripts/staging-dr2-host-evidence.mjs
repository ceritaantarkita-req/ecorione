#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, lstatSync, readFileSync, writeFileSync } from "node:fs";
import { arch, release } from "node:os";
import { resolve } from "node:path";

const ROLE_VALUES = new Set(["backup-target", "replacement-host"]);
const LABEL_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/u;

function fail(message) {
  throw new Error("DR-2 host evidence: " + message);
}

function parseArgs(argv) {
  const values = Object.create(null);
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) {
      fail(
        "use --role backup-target|replacement-host --failure-domain <label> --output <json>",
      );
    }
    values[key.slice(2)] = value;
  }

  const role = values.role ?? "";
  const failureDomain = values["failure-domain"] ?? "";
  const output = values.output ?? "";

  if (!ROLE_VALUES.has(role)) fail("invalid --role");
  if (!LABEL_RE.test(failureDomain)) {
    fail("--failure-domain must be a 3-64 character sanitized label");
  }
  if (!output) fail("--output is required");

  return { role, failureDomain, output: resolve(output) };
}

function sha256Text(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function readTrimmed(path) {
  if (!existsSync(path)) return null;
  const info = lstatSync(path);
  if (!info.isFile() || info.isSymbolicLink()) return null;
  const value = readFileSync(path, "utf8").trim();
  return value || null;
}

function detectVirtualization() {
  const result = spawnSync("systemd-detect-virt", [], {
    encoding: "utf8",
    timeout: 5000,
  });
  if (result.error) return "unknown";
  const value = String(result.stdout || "").trim();
  if (result.status === 0 && value) return value;
  return "none";
}

function readOsId() {
  const raw = readTrimmed("/etc/os-release");
  if (!raw) return "unknown";
  for (const line of raw.split(/\r?\n/u)) {
    if (!line.startsWith("ID=")) continue;
    return line
      .slice(3)
      .replace(/^"/u, "")
      .replace(/"$/u, "")
      .replace(/[^A-Za-z0-9._-]/gu, "_");
  }
  return "unknown";
}

const { role, failureDomain, output } = parseArgs(process.argv.slice(2));

if (process.platform !== "linux") {
  fail("host evidence capture is supported only on Linux recovery/target hosts");
}
if (existsSync(output)) fail("refusing to overwrite existing host evidence output");

const machineId = readTrimmed("/etc/machine-id");
if (!machineId) fail("/etc/machine-id is missing or unsafe");

const systemUuid =
  readTrimmed("/sys/class/dmi/id/product_uuid") ??
  readTrimmed("/sys/devices/virtual/dmi/id/product_uuid");

const evidence = {
  schemaVersion: 1,
  kind: "ecorione-dr2-host-evidence",
  role,
  failureDomain,
  capturedAt: new Date().toISOString(),
  hostIdentity: {
    machineIdSha256: sha256Text(machineId),
    systemUuidSha256: systemUuid ? sha256Text(systemUuid.toLowerCase()) : null,
    virtualization: detectVirtualization(),
    osId: readOsId(),
    kernelRelease: release(),
    architecture: arch(),
  },
  claimBoundary:
    "Sanitized local host-identity evidence only. Distinct hashes and operator labels do not by themselves prove physical independence; DR-2 preflight plus a real recovery drill are still required.",
};

writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`, {
  mode: 0o600,
  flag: "wx",
});
chmodSync(output, 0o600);

console.log("PASS ECORIONE DR-2 sanitized host evidence capture");
console.log(`role=${role}`);
console.log(`failure_domain=${failureDomain}`);
console.log(`virtualization=${evidence.hostIdentity.virtualization}`);
console.log(`system_uuid_fingerprint_present=${systemUuid ? "1" : "0"}`);
console.log(`output=${output}`);
