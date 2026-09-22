#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { basename, resolve } from "node:path";

const SHA_RE = /^[0-9a-f]{40}$/;
const HASH_RE = /^[0-9a-f]{64}$/;
const TAG_RE = /^staging-[0-9a-f]{12}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

function fail(message) {
  throw new Error("Off-host DR closure evidence: " + message);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i]?.startsWith("--") || argv[i + 1] === undefined) {
      fail(
        "use --export-manifest <env> --canary-state <json> --retrieval-receipt <env> --restore-receipt <json> --acceptance-receipt <json> --loss-marker <json> --output <json>",
      );
    }
    out[argv[i].slice(2)] = argv[i + 1];
  }
  for (const key of [
    "export-manifest",
    "canary-state",
    "retrieval-receipt",
    "restore-receipt",
    "acceptance-receipt",
    "loss-marker",
    "output",
  ]) {
    if (!out[key]) fail(`missing --${key}`);
  }
  return out;
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

function parseEnv(path) {
  const values = Object.create(null);
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/u)) {
    if (!raw) continue;
    const at = raw.indexOf("=");
    if (at <= 0) fail(`invalid env receipt line in ${basename(path)}`);
    const key = raw.slice(0, at);
    const value = raw.slice(at + 1);
    if (!/^[A-Za-z0-9_]+$/u.test(key)) {
      fail(`invalid env receipt key in ${basename(path)}`);
    }
    if (Object.hasOwn(values, key)) {
      fail(`duplicate env receipt key ${key} in ${basename(path)}`);
    }
    values[key] = value;
  }
  return values;
}

function parseJson(path, label) {
  let value;
  try {
    value = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    fail(`${label} is not valid JSON`);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must contain one JSON object`);
  }
  return value;
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function isoMs(value, label) {
  if (typeof value !== "string" || !ISO_RE.test(value)) {
    fail(`${label} must be UTC ISO-8601`);
  }
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) fail(`${label} is not parseable`);
  return ms;
}

function secondsBetween(start, end, label) {
  if (end < start) fail(`${label} chronology is negative`);
  return Math.round((end - start) / 1000);
}

function requireEqual(actual, expected, label) {
  if (actual !== expected) fail(`${label} mismatch`);
}

const args = parseArgs(process.argv.slice(2));
const manifestPath = resolve(args["export-manifest"]);
const canaryPath = resolve(args["canary-state"]);
const retrievalPath = resolve(args["retrieval-receipt"]);
const restorePath = resolve(args["restore-receipt"]);
const acceptancePath = resolve(args["acceptance-receipt"]);
const lossMarkerPath = resolve(args["loss-marker"]);
const outputPath = resolve(args.output);

for (const [path, label] of [
  [manifestPath, "export manifest"],
  [canaryPath, "semantic canary state"],
  [retrievalPath, "retrieval receipt"],
  [restorePath, "restore receipt"],
  [acceptancePath, "acceptance receipt"],
  [lossMarkerPath, "loss marker"],
]) {
  assertMode600(path, label);
}
if (existsSync(outputPath)) fail("refusing to overwrite closure evidence output");

const manifest = parseEnv(manifestPath);
const retrieval = parseEnv(retrievalPath);
const canary = parseJson(canaryPath, "semantic canary state");
const restore = parseJson(restorePath, "restore receipt");
const acceptance = parseJson(acceptancePath, "acceptance receipt");
const lossMarker = parseJson(lossMarkerPath, "loss marker");

if (
  manifest.schema_version !== "1" ||
  manifest.failure_domain_ack !== "1" ||
  manifest.transfer_intent !== "1"
) {
  fail("export manifest is not a supported acknowledged generation");
}
if (
  retrieval.schema_version !== "1" ||
  retrieval.failure_domain_ack !== "1" ||
  retrieval.retrieval_verified !== "1"
) {
  fail("retrieval receipt is not independently verified");
}
if (
  canary.schemaVersion !== 1 ||
  canary.phase !== "baseline-ready" ||
  typeof canary.createdAt !== "string"
) {
  fail("semantic canary state is invalid");
}
if (
  restore.schemaVersion !== 1 ||
  restore.retrievedFromIndependentTarget !== true ||
  !Array.isArray(restore.restoredVolumes) ||
  restore.restoredVolumes.length < 1
) {
  fail("restore receipt is incomplete");
}
if (
  acceptance.schemaVersion !== 1 ||
  acceptance.preRebootAccepted !== true ||
  acceptance.rebootPersistenceAccepted !== true ||
  acceptance.semanticCanaryAccepted !== true ||
  acceptance.semanticCanaryVerifiedAfterReboot !== true ||
  acceptance.totalHostLossRecoveryCandidate !== true ||
  acceptance.retrievedFromIndependentTarget !== true
) {
  fail("acceptance receipt has not reached final changed-boot-id recovery candidate state");
}

if (
  lossMarker.schemaVersion !== 1 ||
  lossMarker.kind !== "ecorione-offhost-dr-loss-marker" ||
  typeof lossMarker.drillId !== "string" ||
  !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
    lossMarker.drillId,
  ) ||
  typeof lossMarker.declaredAt !== "string" ||
  typeof lossMarker.expectedExportManifestFilename !== "string" ||
  lossMarker.clockSource !== "recovery-host-system-utc"
) {
  fail("loss marker is invalid");
}

const sourceSha = manifest.source_sha;
const sourceTag = manifest.source_tag;
if (!SHA_RE.test(sourceSha ?? "")) fail("manifest source SHA is invalid");
if (!TAG_RE.test(sourceTag ?? "") || sourceTag !== `staging-${sourceSha.slice(0, 12)}`) {
  fail("manifest source tag is invalid");
}

if (
  typeof manifest.bundle_filename !== "string" ||
  !/^ecorione-dr-[A-Za-z0-9_.-]+\.ecdr$/u.test(manifest.bundle_filename) ||
  typeof manifest.metadata_filename !== "string" ||
  !/^ecorione-dr-[A-Za-z0-9_.-]+\.json$/u.test(manifest.metadata_filename) ||
  typeof manifest.canary_filename !== "string" ||
  !/^ecorione-dr-[A-Za-z0-9_.-]+\.canary\.json$/u.test(manifest.canary_filename)
) {
  fail("manifest artifact filenames are invalid");
}
const generationStem = manifest.bundle_filename.slice(0, -".ecdr".length);
if (
  manifest.metadata_filename !== `${generationStem}.json` ||
  manifest.canary_filename !== `${generationStem}.canary.json` ||
  basename(manifestPath) !== `${generationStem}.receipt.env`
) {
  fail("manifest generation stems do not match");
}
if (lossMarker.expectedExportManifestFilename !== basename(manifestPath)) {
  fail("loss marker selected export manifest does not match closure manifest");
}

for (const [actual, expected, label] of [
  [restore.sourceSha, sourceSha, "restore source SHA"],
  [restore.sourceTag, sourceTag, "restore source tag"],
  [acceptance.sourceSha, sourceSha, "acceptance source SHA"],
  [acceptance.sourceTag, sourceTag, "acceptance source tag"],
  [acceptance.composeProject, restore.composeProject, "acceptance compose project"],
  [acceptance.recoveryStartedAt, restore.recoveryStartedAt, "acceptance recovery start"],
  [acceptance.dataReadyAt, restore.dataReadyAt, "acceptance data-ready timestamp"],
  [retrieval.export_manifest_filename, basename(manifestPath), "retrieval manifest filename"],
  [retrieval.bundle_filename, manifest.bundle_filename, "retrieved bundle filename"],
  [retrieval.metadata_filename, manifest.metadata_filename, "retrieved metadata filename"],
  [retrieval.canary_filename, manifest.canary_filename, "retrieved canary filename"],
  [retrieval.bundle_sha256, manifest.bundle_sha256, "retrieved bundle SHA-256"],
  [retrieval.metadata_sha256, manifest.metadata_sha256, "retrieved metadata SHA-256"],
  [retrieval.canary_sha256, manifest.canary_sha256, "retrieved canary SHA-256"],
  [restore.bundleFilename, manifest.bundle_filename, "restore bundle filename"],
  [
    restore.retrievalReceiptFilename,
    basename(retrievalPath),
    "restore retrieval receipt filename",
  ],
  [restore.semanticCanaryStateFilename, basename(canaryPath), "restore canary filename"],
  [
    acceptance.retrievalReceiptFilename,
    basename(retrievalPath),
    "acceptance retrieval receipt filename",
  ],
  [acceptance.semanticCanaryStateFilename, basename(canaryPath), "acceptance canary filename"],
]) {
  requireEqual(actual, expected, label);
}

for (const [hash, label] of [
  [manifest.bundle_sha256, "manifest bundle SHA-256"],
  [manifest.metadata_sha256, "manifest metadata SHA-256"],
  [manifest.canary_sha256, "manifest canary SHA-256"],
  [restore.semanticCanarySha256, "restore canary SHA-256"],
  [acceptance.semanticCanarySha256, "acceptance canary SHA-256"],
]) {
  if (!HASH_RE.test(hash ?? "")) fail(`${label} is invalid`);
}

const canarySha = sha256(canaryPath);
requireEqual(canarySha, manifest.canary_sha256, "local canary SHA-256 vs export manifest");
requireEqual(
  canarySha,
  restore.semanticCanarySha256,
  "local canary SHA-256 vs restore receipt",
);
requireEqual(
  canarySha,
  acceptance.semanticCanarySha256,
  "local canary SHA-256 vs acceptance receipt",
);

if (
  !Number.isInteger(acceptance.restoredVolumeCount) ||
  acceptance.restoredVolumeCount !== restore.restoredVolumes.length
) {
  fail("acceptance restored-volume count does not match restore receipt");
}
if (!Number.isInteger(acceptance.serviceCount) || acceptance.serviceCount < 1) {
  fail("acceptance service count is invalid");
}

const backupBoundaryAt = canary.createdAt;
const exportCreatedAt = manifest.created_at;
const lossDeclaredAt = lossMarker.declaredAt;
const retrievedAt = retrieval.retrieved_at;
const recoveryStartedAt = restore.recoveryStartedAt;
const dataReadyAt = restore.dataReadyAt;
const appReadyAt = acceptance.acceptedAt;
const finalAcceptedAt = acceptance.postRebootAcceptedAt;

const backupBoundaryMs = isoMs(backupBoundaryAt, "canary createdAt");
const exportCreatedMs = isoMs(exportCreatedAt, "manifest created_at");
const lossMs = isoMs(lossDeclaredAt, "loss marker declaredAt");
const retrievedMs = isoMs(retrievedAt, "retrieval retrieved_at");
const recoveryStartedMs = isoMs(recoveryStartedAt, "restore recoveryStartedAt");
const dataReadyMs = isoMs(dataReadyAt, "restore dataReadyAt");
const appReadyMs = isoMs(appReadyAt, "acceptance acceptedAt");
const finalMs = isoMs(finalAcceptedAt, "acceptance postRebootAcceptedAt");

if (exportCreatedMs < backupBoundaryMs) {
  fail("export manifest predates semantic-canary backup boundary");
}
if (lossMs < exportCreatedMs) {
  fail("loss marker declaredAt must not predate successful export generation");
}
if (retrievedMs < lossMs) fail("retrieval completed before declared source loss");
if (recoveryStartedMs < retrievedMs)
  fail("real-volume recovery started before retrieval completed");
if (dataReadyMs < recoveryStartedMs) fail("data-ready precedes recovery start");
if (appReadyMs < dataReadyMs) fail("application acceptance precedes data-ready");
if (finalMs < appReadyMs)
  fail("final changed-boot-id acceptance precedes application acceptance");

const evidence = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  sourceSha,
  sourceTag,
  composeProject: acceptance.composeProject,
  drill: {
    drillId: lossMarker.drillId,
    lossMarkerFilename: basename(lossMarkerPath),
    lossMarkerSha256: sha256(lossMarkerPath),
    clockSource: lossMarker.clockSource,
  },
  generation: {
    exportManifestFilename: basename(manifestPath),
    bundleFilename: manifest.bundle_filename,
    metadataFilename: manifest.metadata_filename,
    canaryFilename: manifest.canary_filename,
    bundleSha256: manifest.bundle_sha256,
    metadataSha256: manifest.metadata_sha256,
    canarySha256: manifest.canary_sha256,
    failureDomainAcknowledged: true,
    independentRetrievalVerified: true,
  },
  timeline: {
    backupBoundaryAt,
    exportCreatedAt,
    lossDeclaredAt,
    retrievedAt,
    recoveryStartedAt,
    dataReadyAt,
    applicationReadyAt: appReadyAt,
    finalPostRebootAcceptedAt: finalAcceptedAt,
  },
  measuredSeconds: {
    conservativeRpoSeconds: secondsBetween(backupBoundaryMs, lossMs, "conservative RPO"),
    exportAgeAtLossSeconds: secondsBetween(exportCreatedMs, lossMs, "export age at loss"),
    retrievalReadyRtoSeconds: secondsBetween(lossMs, retrievedMs, "retrieval-ready RTO"),
    dataReadyRtoSeconds: secondsBetween(lossMs, dataReadyMs, "data-ready RTO"),
    applicationReadyRtoSeconds: secondsBetween(lossMs, appReadyMs, "application-ready RTO"),
    finalRecoveryRtoSeconds: secondsBetween(lossMs, finalMs, "final recovery RTO"),
  },
  recovery: {
    restoredVolumeCount: restore.restoredVolumes.length,
    serviceCount: acceptance.serviceCount,
    semanticCanaryAccepted: true,
    semanticCanaryVerifiedAfterReboot: true,
    changedBootIdProven:
      typeof acceptance.baselineBootId === "string" &&
      typeof acceptance.postBootId === "string" &&
      acceptance.baselineBootId.length > 0 &&
      acceptance.postBootId.length > 0 &&
      acceptance.baselineBootId !== acceptance.postBootId,
    totalHostLossRecoveryCandidate: true,
  },
  claimBoundary:
    "Sanitized timing/evidence receipt for one independently retrieved total-host-loss recovery drill, bound to an immutable mode-0600 loss-marker receipt. It does not prove a production SLA or independent-target retention policy by itself.",
};

if (!evidence.recovery.changedBootIdProven) {
  fail("acceptance receipt does not prove a changed Linux boot ID");
}

writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, {
  mode: 0o600,
  flag: "wx",
});
chmodSync(outputPath, 0o600);

console.log("PASS ECORIONE off-host DR sanitized closure timing evidence");
console.log(`output=${outputPath}`);
console.log(`source_sha=${sourceSha}`);
console.log(`conservative_rpo_seconds=${evidence.measuredSeconds.conservativeRpoSeconds}`);
console.log(`data_ready_rto_seconds=${evidence.measuredSeconds.dataReadyRtoSeconds}`);
console.log(
  `application_ready_rto_seconds=${evidence.measuredSeconds.applicationReadyRtoSeconds}`,
);
console.log(`final_recovery_rto_seconds=${evidence.measuredSeconds.finalRecoveryRtoSeconds}`);
