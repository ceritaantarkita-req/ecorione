#!/usr/bin/env node
import { chmodSync, existsSync, lstatSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

const HASH_RE = /^[0-9a-f]{64}$/u;
const LABEL_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/u;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const FUTURE_SKEW_MS = 5 * 60 * 1000;

function fail(message) {
  throw new Error("DR-2 physical-independence preflight: " + message);
}

function parseArgs(argv) {
  const values = Object.create(null);
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) {
      fail("use --backup-target <json> --replacement-host <json> --output <json>");
    }
    values[key.slice(2)] = value;
  }

  for (const key of ["backup-target", "replacement-host", "output"]) {
    if (!values[key]) fail(`--${key} is required`);
  }

  return {
    backupTarget: resolve(values["backup-target"]),
    replacementHost: resolve(values["replacement-host"]),
    output: resolve(values.output),
  };
}

function assertMode600(path, label) {
  if (!existsSync(path)) fail(`${label} is missing`);
  const info = lstatSync(path);
  if (!info.isFile() || info.isSymbolicLink()) {
    fail(`${label} must be a regular non-symlink file`);
  }
  if ((info.mode & 0o777) !== 0o600) {
    fail(`${label} must be mode 600`);
  }
}

function parseEvidence(path, expectedRole) {
  assertMode600(path, `${expectedRole} evidence`);
  let value;
  try {
    value = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    fail(`${expectedRole} evidence is not valid JSON`);
  }

  if (
    value?.schemaVersion !== 1 ||
    value?.kind !== "ecorione-dr2-host-evidence" ||
    value?.role !== expectedRole ||
    !LABEL_RE.test(value?.failureDomain ?? "") ||
    !HASH_RE.test(value?.hostIdentity?.machineIdSha256 ?? "") ||
    !["string", "object"].includes(
      typeof value?.hostIdentity?.systemUuidSha256,
    ) ||
    typeof value?.hostIdentity?.virtualization !== "string" ||
    typeof value?.capturedAt !== "string"
  ) {
    fail(`${expectedRole} evidence schema is invalid`);
  }

  if (
    value.hostIdentity.systemUuidSha256 !== null &&
    !HASH_RE.test(value.hostIdentity.systemUuidSha256)
  ) {
    fail(`${expectedRole} system UUID fingerprint is invalid`);
  }

  const capturedMs = Date.parse(value.capturedAt);
  const now = Date.now();
  if (!Number.isFinite(capturedMs)) {
    fail(`${expectedRole} capturedAt is invalid`);
  }
  if (capturedMs > now + FUTURE_SKEW_MS) {
    fail(`${expectedRole} evidence is unexpectedly future-dated`);
  }
  if (now - capturedMs > MAX_AGE_MS) {
    fail(`${expectedRole} evidence is older than 24 hours`);
  }

  return value;
}

if (process.platform !== "linux") {
  fail("physical-independence preflight is supported only on Linux");
}
if (process.env.ECORIONE_DR_PHYSICAL_INDEPENDENCE_ACK !== "1") {
  fail(
    "set ECORIONE_DR_PHYSICAL_INDEPENDENCE_ACK=1 only after confirming backup target and replacement compute are on different physical failure domains",
  );
}

const { backupTarget, replacementHost, output } = parseArgs(process.argv.slice(2));
if (existsSync(output)) fail("refusing to overwrite existing preflight output");

const backup = parseEvidence(backupTarget, "backup-target");
const replacement = parseEvidence(replacementHost, "replacement-host");

if (backup.failureDomain === replacement.failureDomain) {
  fail("backup target and replacement host use the same failure-domain label");
}
if (
  backup.hostIdentity.machineIdSha256 ===
  replacement.hostIdentity.machineIdSha256
) {
  fail("backup target and replacement host have the same machine-id fingerprint");
}

const backupSystem = backup.hostIdentity.systemUuidSha256;
const replacementSystem = replacement.hostIdentity.systemUuidSha256;

if (
  backupSystem !== null &&
  replacementSystem !== null &&
  backupSystem === replacementSystem
) {
  fail("backup target and replacement host have the same system UUID fingerprint");
}

const bothWsl =
  backup.hostIdentity.virtualization === "wsl" &&
  replacement.hostIdentity.virtualization === "wsl";
if (bothWsl && (backupSystem === null || replacementSystem === null)) {
  fail(
    "two WSL hosts require distinct system UUID fingerprints before DR-2 can accept the physical-independence preflight",
  );
}

const result = {
  schemaVersion: 1,
  kind: "ecorione-dr2-physical-independence-preflight",
  generatedAt: new Date().toISOString(),
  inputs: {
    backupTargetEvidence: basename(backupTarget),
    replacementHostEvidence: basename(replacementHost),
  },
  backupTarget: {
    failureDomain: backup.failureDomain,
    machineIdSha256: backup.hostIdentity.machineIdSha256,
    systemUuidSha256: backupSystem,
    virtualization: backup.hostIdentity.virtualization,
  },
  replacementHost: {
    failureDomain: replacement.failureDomain,
    machineIdSha256: replacement.hostIdentity.machineIdSha256,
    systemUuidSha256: replacementSystem,
    virtualization: replacement.hostIdentity.virtualization,
  },
  checks: {
    operatorPhysicalIndependenceAttested: true,
    distinctFailureDomainLabels: true,
    distinctMachineIdFingerprints: true,
    distinctSystemUuidFingerprints:
      backupSystem !== null && replacementSystem !== null
        ? backupSystem !== replacementSystem
        : null,
    wslSystemIdentityRequirementSatisfied:
      !bothWsl || (backupSystem !== null && replacementSystem !== null),
  },
  preflightPassed: true,
  claimBoundary:
    "Repository/runtime preflight only. This receipt records operator-attested distinct physical failure domains backed by sanitized host fingerprints; final DR-2 closure still requires fresh independent retention and a real clean-host recovery drill.",
};

writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, {
  mode: 0o600,
  flag: "wx",
});
chmodSync(output, 0o600);

console.log("PASS ECORIONE DR-2 physical-independence preflight");
console.log(`backup_failure_domain=${backup.failureDomain}`);
console.log(`replacement_failure_domain=${replacement.failureDomain}`);
console.log("distinct_machine_id_fingerprints=1");
console.log(
  `distinct_system_uuid_fingerprints=${
    result.checks.distinctSystemUuidFingerprints === null
      ? "not_available"
      : result.checks.distinctSystemUuidFingerprints
        ? "1"
        : "0"
  }`,
);
console.log("physical_independence_operator_attested=1");
console.log(`output=${output}`);
