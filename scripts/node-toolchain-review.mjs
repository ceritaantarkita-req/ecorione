#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const EXACT_SEMVER = /^\d+\.\d+\.\d+$/;
const NODE_VERSION_FILE = ".node-version";

export function readPinnedNodeVersion(readFile = readFileSync) {
  const version = readFile(NODE_VERSION_FILE, "utf8").trim();
  if (!EXACT_SEMVER.test(version)) {
    throw new Error(
      `${NODE_VERSION_FILE} harus exact semver x.y.z, ditemukan: ${version || "<empty>"}`,
    );
  }
  return version;
}

export function reviewNodeWorkflowContent(path, content) {
  const findings = [];
  const lines = content.split("\n");
  let setupNodeSeen = false;
  let setupNodeIndent = -1;
  let nodeVersionFileSeen = false;

  const flushSetupNode = (lineNumber) => {
    if (setupNodeSeen && !nodeVersionFileSeen) {
      findings.push(
        `${path}:${String(lineNumber)} actions/setup-node harus memakai node-version-file: ${NODE_VERSION_FILE}`,
      );
    }
    setupNodeSeen = false;
    setupNodeIndent = -1;
    nodeVersionFileSeen = false;
  };

  for (const [index, line] of lines.entries()) {
    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    const trimmed = line.trim();

    if (setupNodeSeen && trimmed && indent <= setupNodeIndent && !trimmed.startsWith("with:")) {
      flushSetupNode(index + 1);
    }

    if (/^\s*(?:-\s*)?uses:\s*actions\/setup-node@/i.test(line)) {
      if (setupNodeSeen) flushSetupNode(index + 1);
      setupNodeSeen = true;
      setupNodeIndent = indent;
      continue;
    }

    if (setupNodeSeen) {
      if (/^\s*node-version:\s*/i.test(line)) {
        findings.push(
          `${path}:${String(index + 1)} node-version langsung dilarang; gunakan node-version-file: ${NODE_VERSION_FILE}`,
        );
      }
      const versionFile = line.match(/^\s*node-version-file:\s*["']?([^"'#\s]+)["']?/i);
      if (versionFile) {
        nodeVersionFileSeen = true;
        if (versionFile[1] !== NODE_VERSION_FILE) {
          findings.push(
            `${path}:${String(index + 1)} node-version-file harus ${NODE_VERSION_FILE}, ditemukan: ${versionFile[1]}`,
          );
        }
      }
    }
  }

  if (setupNodeSeen) flushSetupNode(lines.length);
  return findings;
}

export function reviewDockerfile(content, expectedVersion) {
  const findings = [];
  const match = content.match(/^FROM\s+node:([^\s]+)$/m);
  if (!match) {
    findings.push("Dockerfile harus memakai base image node:<exact-version>-<variant>");
    return findings;
  }

  const tag = match[1];
  if (!tag.startsWith(`${expectedVersion}-`)) {
    findings.push(
      `Dockerfile Node base harus selaras dengan ${NODE_VERSION_FILE}=${expectedVersion}, ditemukan node:${tag}`,
    );
  }
  return findings;
}

export function trackedWorkflowFiles() {
  return execFileSync("git", ["ls-files", ".github/workflows"], {
    encoding: "utf8",
  })
    .split("\n")
    .map((value) => value.trim())
    .filter((value) => /\.ya?ml$/i.test(value));
}

export function reviewNodeToolchain() {
  const version = readPinnedNodeVersion();
  const files = trackedWorkflowFiles();
  const workflowFindings = files.flatMap((path) =>
    reviewNodeWorkflowContent(path, readFileSync(path, "utf8")),
  );
  const dockerFindings = reviewDockerfile(readFileSync("Dockerfile", "utf8"), version);
  return { version, files, findings: [...workflowFindings, ...dockerFindings] };
}

export function runNodeToolchainReview() {
  let result;
  try {
    result = reviewNodeToolchain();
  } catch (error) {
    console.error("node-toolchain-review: FAIL");
    console.error(`  - ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
    return;
  }

  if (result.findings.length > 0) {
    console.error("node-toolchain-review: FAIL");
    for (const finding of result.findings) console.error(`  - ${finding}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `node-toolchain-review: PASS (Node ${result.version}; ${String(result.files.length)} tracked workflow file(s))`,
  );
}

const isDirect =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirect) runNodeToolchainReview();
