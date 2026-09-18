#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const LATEST_RUNNER_LABEL = /\b(?:ubuntu|windows|macos)-latest\b/i;

export function reviewRunnerLabels(path, content) {
  const findings = [];
  const lines = content.split("\n");
  let inRunsOnBlock = false;
  let runsOnIndent = -1;

  for (const [index, line] of lines.entries()) {
    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    const trimmed = line.trim();

    if (inRunsOnBlock && trimmed && indent <= runsOnIndent && !trimmed.startsWith("-")) {
      inRunsOnBlock = false;
      runsOnIndent = -1;
    }

    const scalar = line.match(/^\s*runs-on:\s*(.+?)\s*(?:#.*)?$/);
    if (scalar) {
      const value = scalar[1].trim().replace(/^["']|["']$/g, "");
      if (LATEST_RUNNER_LABEL.test(value)) {
        findings.push(
          `${path}:${String(index + 1)} GitHub-hosted runner label harus dipin ke versi OS tetap: ${value}`,
        );
      }
      continue;
    }

    const blockStart = line.match(/^(\s*)runs-on:\s*(?:#.*)?$/);
    if (blockStart) {
      inRunsOnBlock = true;
      runsOnIndent = blockStart[1].length;
      continue;
    }

    if (inRunsOnBlock && LATEST_RUNNER_LABEL.test(trimmed)) {
      findings.push(
        `${path}:${String(index + 1)} GitHub-hosted runner label harus dipin ke versi OS tetap: ${trimmed}`,
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

export function reviewTrackedRunnerLabels() {
  const files = trackedWorkflowFiles();
  const findings = files.flatMap((path) =>
    reviewRunnerLabels(path, readFileSync(path, "utf8")),
  );
  return { files, findings };
}

export function runGitHubActionsRunnerReview() {
  const { files, findings } = reviewTrackedRunnerLabels();

  if (findings.length > 0) {
    console.error("github-actions-runner-review: FAIL");
    for (const finding of findings) console.error(`  - ${finding}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `github-actions-runner-review: PASS (${String(files.length)} tracked workflow file(s))`,
  );
}

const isDirect =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirect) runGitHubActionsRunnerReview();
