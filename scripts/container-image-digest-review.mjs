#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const DIGEST_REF = /^[^\s@]+:[^\s@]+@sha256:[0-9a-f]{64}$/i;
const LOCK_FILE = "deploy/container-image-lock.json";
const GOVERNED_COMPOSE_FILES = ["deploy/compose.yml", "deploy/local-temporal.yml"];
const REQUIRED_KEYS = ["node", "postgres", "caddy", "temporal"];

export function isLocalBuiltImage(image) {
  return /^ecorione:\$\{ECORIONE_IMAGE_TAG:-local\}$/.test(image);
}

export function readContainerImageLock(readFile = readFileSync) {
  const parsed = JSON.parse(readFile(LOCK_FILE, "utf8"));
  if (parsed?.schemaVersion !== 1 || parsed?.images === null || typeof parsed?.images !== "object") {
    throw new Error(`${LOCK_FILE} harus schemaVersion=1 dengan object images`);
  }

  const keys = Object.keys(parsed.images).sort();
  const required = [...REQUIRED_KEYS].sort();
  if (JSON.stringify(keys) !== JSON.stringify(required)) {
    throw new Error(
      `${LOCK_FILE} keys harus tepat: ${required.join(", ")}; ditemukan: ${keys.join(", ")}`,
    );
  }

  for (const key of REQUIRED_KEYS) {
    const value = parsed.images[key];
    if (typeof value !== "string" || !DIGEST_REF.test(value)) {
      throw new Error(`${LOCK_FILE} images.${key} harus tag@sha256:<64hex>`);
    }
  }

  return parsed.images;
}

function reviewExpectedRefs(path, actualRefs, expectedRefs) {
  const findings = [];

  for (const ref of actualRefs) {
    if (!DIGEST_REF.test(ref)) {
      findings.push(`${path} external image harus tag@sha256:<64hex>: ${ref}`);
      continue;
    }
    if (!expectedRefs.includes(ref)) {
      findings.push(`${path} external image tidak cocok dengan reviewed lock: ${ref}`);
    }
  }

  for (const expected of expectedRefs) {
    if (!actualRefs.includes(expected)) {
      findings.push(`${path} reviewed image hilang: ${expected}`);
    }
  }

  return findings;
}

export function reviewDockerfileContent(content, expectedRefs = []) {
  const refs = [];
  const findings = [];

  for (const [index, line] of content.split("\n").entries()) {
    const match = line.match(/^\s*FROM\s+([^\s]+)(?:\s+AS\s+\S+)?\s*$/i);
    if (!match) continue;
    const image = match[1];
    if (image.toLowerCase() === "scratch") continue;
    refs.push(image);

    if (!DIGEST_REF.test(image)) {
      findings.push(
        `Dockerfile:${String(index + 1)} external base image harus tag@sha256:<64hex>: ${image}`,
      );
    }
  }

  if (expectedRefs.length > 0) {
    findings.push(...reviewExpectedRefs("Dockerfile", refs, expectedRefs));
  }
  return findings;
}

export function reviewComposeContent(path, content, expectedRefs = []) {
  const refs = [];
  const findings = [];

  for (const [index, line] of content.split("\n").entries()) {
    const match = line.match(/^\s*image:\s*([^\s#]+).*$/);
    if (!match) continue;
    const image = match[1];
    if (isLocalBuiltImage(image)) continue;
    refs.push(image);

    if (!DIGEST_REF.test(image)) {
      findings.push(
        `${path}:${String(index + 1)} external image harus tag@sha256:<64hex>: ${image}`,
      );
    }
  }

  if (expectedRefs.length > 0) {
    findings.push(...reviewExpectedRefs(path, refs, expectedRefs));
  }
  return findings;
}

export function reviewContainerImageDigests(readFile = readFileSync) {
  const images = readContainerImageLock(readFile);
  const findings = [];

  findings.push(
    ...reviewDockerfileContent(readFile("Dockerfile", "utf8"), [images.node]),
    ...reviewComposeContent("deploy/compose.yml", readFile("deploy/compose.yml", "utf8"), [
      images.postgres,
      images.temporal,
      images.caddy,
    ]),
    ...reviewComposeContent(
      "deploy/local-temporal.yml",
      readFile("deploy/local-temporal.yml", "utf8"),
      [images.postgres, images.temporal],
    ),
  );

  return {
    lockFile: LOCK_FILE,
    files: ["Dockerfile", ...GOVERNED_COMPOSE_FILES],
    images,
    findings,
  };
}

export function runContainerImageDigestReview() {
  let result;
  try {
    result = reviewContainerImageDigests();
  } catch (error) {
    console.error("container-image-digest-review: FAIL");
    console.error(`  - ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
    return;
  }

  if (result.findings.length > 0) {
    console.error("container-image-digest-review: FAIL");
    for (const finding of result.findings) console.error(`  - ${finding}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `container-image-digest-review: PASS (${String(result.files.length)} governed file(s); lock ${result.lockFile})`,
  );
}

const isDirect =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirect) runContainerImageDigestReview();
