#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const DIGEST_REF = /^[^\s@]+:[^\s@]+@sha256:[0-9a-f]{64}$/i;
const GOVERNED_COMPOSE_FILES = ["deploy/compose.yml", "deploy/local-temporal.yml"];

export function isLocalBuiltImage(image) {
  return /^ecorione:\$\{ECORIONE_IMAGE_TAG:-local\}$/.test(image);
}

export function reviewDockerfileContent(content) {
  const findings = [];
  const lines = content.split("\n");

  for (const [index, line] of lines.entries()) {
    const match = line.match(/^\s*FROM\s+([^\s]+)(?:\s+AS\s+\S+)?\s*$/i);
    if (!match) continue;
    const image = match[1];
    if (image.toLowerCase() === "scratch") continue;
    if (!DIGEST_REF.test(image)) {
      findings.push(
        `Dockerfile:${String(index + 1)} external base image harus tag@sha256:<64hex>: ${image}`,
      );
    }
  }

  return findings;
}

export function reviewComposeContent(path, content) {
  const findings = [];
  const lines = content.split("\n");

  for (const [index, line] of lines.entries()) {
    const match = line.match(/^\s*image:\s*([^\s#]+).*$/);
    if (!match) continue;
    const image = match[1];
    if (isLocalBuiltImage(image)) continue;
    if (!DIGEST_REF.test(image)) {
      findings.push(
        `${path}:${String(index + 1)} external image harus tag@sha256:<64hex>: ${image}`,
      );
    }
  }

  return findings;
}

export function reviewContainerImageDigests(readFile = readFileSync) {
  const findings = [];
  findings.push(...reviewDockerfileContent(readFile("Dockerfile", "utf8")));

  for (const path of GOVERNED_COMPOSE_FILES) {
    findings.push(...reviewComposeContent(path, readFile(path, "utf8")));
  }

  return { files: ["Dockerfile", ...GOVERNED_COMPOSE_FILES], findings };
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
    `container-image-digest-review: PASS (${String(result.files.length)} governed file(s))`,
  );
}

const isDirect =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirect) runContainerImageDigestReview();
