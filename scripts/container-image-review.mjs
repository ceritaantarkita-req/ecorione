#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const FULL_SHA256 = /^sha256:[0-9a-f]{64}$/i;
const REQUIRED_FILES = [
  "Dockerfile",
  "deploy/compose.yml",
  "deploy/local-temporal.yml",
  "desktop/compose.yml",
];

export function isRepositoryBuiltImage(reference, path = "") {
  if (reference.startsWith("ecorione:")) return true;
  return path === "desktop/compose.yml" && reference.startsWith("${ECORIONE_DESKTOP_IMAGE:");
}

export function reviewImageReference(path, line, reference) {
  if (isRepositoryBuiltImage(reference, path)) return [];

  const findings = [];
  const at = reference.lastIndexOf("@");
  if (at <= 0) {
    return [
      `${path}:${String(line)} external image harus memakai readable tag + @sha256 digest: ${reference}`,
    ];
  }

  const nameAndTag = reference.slice(0, at);
  const digest = reference.slice(at + 1);
  const tail = nameAndTag.slice(nameAndTag.lastIndexOf("/") + 1);
  const tagSeparator = tail.lastIndexOf(":");

  if (tagSeparator <= 0 || tagSeparator === tail.length - 1) {
    findings.push(
      `${path}:${String(line)} image digest harus mempertahankan explicit readable tag: ${reference}`,
    );
  }
  if (!FULL_SHA256.test(digest)) {
    findings.push(
      `${path}:${String(line)} image digest harus full sha256 64-hex: ${reference}`,
    );
  }
  return findings;
}

export function reviewDockerfileContent(path, content) {
  const findings = [];
  for (const [index, line] of content.split("\n").entries()) {
    const match = line.match(/^\s*FROM\s+([^\s]+)(?:\s+AS\s+\S+)?\s*$/i);
    if (!match || match[1].toLowerCase() === "scratch") continue;
    findings.push(...reviewImageReference(path, index + 1, match[1]));
  }
  return findings;
}

export function reviewComposeContent(path, content) {
  const findings = [];
  for (const [index, line] of content.split("\n").entries()) {
    const match = line.match(/^\s*image:\s*["']?([^"'#\s]+)["']?\s*(?:#.*)?$/);
    if (!match) continue;
    findings.push(...reviewImageReference(path, index + 1, match[1]));
  }
  return findings;
}

export function trackedContainerDefinitionFiles() {
  const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .split("\n")
    .map((value) => value.trim())
    .filter(Boolean);

  const discoveredCompose = tracked.filter((path) =>
    /(?:^|\/)[^/]*compose[^/]*\.ya?ml$/i.test(path),
  );
  const files = [...new Set([...REQUIRED_FILES, ...discoveredCompose])];

  const missing = REQUIRED_FILES.filter((path) => !tracked.includes(path));
  if (missing.length > 0) {
    throw new Error(`governed container definition hilang: ${missing.join(", ")}`);
  }
  return files;
}

export function reviewGovernedContainerImages() {
  const files = trackedContainerDefinitionFiles();
  const findings = [];

  for (const path of files) {
    const content = readFileSync(path, "utf8");
    if (/Dockerfile(?:\.|$)/i.test(path)) {
      findings.push(...reviewDockerfileContent(path, content));
    } else {
      findings.push(...reviewComposeContent(path, content));
    }
  }

  return { files, findings };
}

export function runContainerImageReview() {
  let result;
  try {
    result = reviewGovernedContainerImages();
  } catch (error) {
    console.error("container-image-review: FAIL");
    console.error(`  - ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
    return;
  }

  if (result.findings.length > 0) {
    console.error("container-image-review: FAIL");
    for (const finding of result.findings) console.error(`  - ${finding}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `container-image-review: PASS (${String(result.files.length)} governed container definition file(s))`,
  );
}

const isDirect =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirect) runContainerImageReview();
