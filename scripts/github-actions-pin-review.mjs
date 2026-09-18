#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const FULL_COMMIT_SHA = /^[0-9a-f]{40}$/i;

export function reviewWorkflowContent(path, content) {
  const findings = [];
  const lines = content.split("\n");

  for (const [index, line] of lines.entries()) {
    const match = line.match(/^\s*(?:-\s*)?uses:\s*["']?([^"'#\s]+)["']?\s*(?:#.*)?$/);
    if (!match) continue;

    const target = match[1];
    if (target.startsWith("./") || target.startsWith("docker://")) continue;

    const atIndex = target.lastIndexOf("@");
    if (atIndex <= 0) {
      findings.push(`${path}:${String(index + 1)} remote action tanpa @ref: ${target}`);
      continue;
    }

    const action = target.slice(0, atIndex);
    const ref = target.slice(atIndex + 1);
    if (!FULL_COMMIT_SHA.test(ref)) {
      findings.push(
        `${path}:${String(index + 1)} remote action harus dipin ke full 40-char commit SHA: ${action}@${ref}`,
      );
    }
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

export function reviewTrackedWorkflows() {
  const files = trackedWorkflowFiles();
  const findings = files.flatMap((path) =>
    reviewWorkflowContent(path, readFileSync(path, "utf8")),
  );
  return { files, findings };
}

export function runGitHubActionsPinReview() {
  const { files, findings } = reviewTrackedWorkflows();

  if (findings.length > 0) {
    console.error("github-actions-pin-review: FAIL");
    for (const finding of findings) console.error(`  - ${finding}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `github-actions-pin-review: PASS (${String(files.length)} tracked workflow file(s))`,
  );
}

const isDirect =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirect) runGitHubActionsPinReview();
