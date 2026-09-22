#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { existsSync, chmodSync, lstatSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

const MANIFEST_RE = /^ecorione-dr-[A-Za-z0-9_.-]+\.receipt\.env$/u;

function fail(message) {
  throw new Error("Off-host DR loss marker: " + message);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i]?.startsWith("--") || argv[i + 1] === undefined) {
      fail("use --manifest-name <ecorione-dr-*.receipt.env> --output <json>");
    }
    const key = argv[i].slice(2);
    if (Object.hasOwn(out, key)) fail(`duplicate --${key}`);
    out[key] = argv[i + 1];
  }
  if (!out["manifest-name"]) fail("missing --manifest-name");
  if (!out.output) fail("missing --output");
  return out;
}

const args = parseArgs(process.argv.slice(2));
const manifestName = args["manifest-name"];
if (!MANIFEST_RE.test(manifestName) || basename(manifestName) !== manifestName) {
  fail("manifest name must be one safe export-manifest filename");
}

const outputPath = resolve(args.output);
if (existsSync(outputPath)) {
  const info = lstatSync(outputPath);
  if (info.isSymbolicLink()) fail("refusing to overwrite symlink loss marker");
  fail("refusing to overwrite existing loss marker");
}

const declaredAt = new Date().toISOString();
const marker = {
  schemaVersion: 1,
  kind: "ecorione-offhost-dr-loss-marker",
  drillId: randomUUID(),
  declaredAt,
  expectedExportManifestFilename: manifestName,
  clockSource: "recovery-host-system-utc",
  claimBoundary:
    "Operator-declared start of one total-host-loss drill. This receipt records the recovery clock boundary and selected retained generation; it does not itself prove source loss, recovery success, RPO, RTO, or retention health.",
};

writeFileSync(outputPath, `${JSON.stringify(marker, null, 2)}\n`, {
  mode: 0o600,
  flag: "wx",
});
chmodSync(outputPath, 0o600);

console.log("PASS ECORIONE off-host DR loss marker created");
console.log(`loss_marker=${outputPath}`);
console.log(`declared_at=${declaredAt}`);
console.log(`expected_manifest=${manifestName}`);
console.log(`drill_id=${marker.drillId}`);
