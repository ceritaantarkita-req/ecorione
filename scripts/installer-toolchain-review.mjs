#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const VERSION_FILE = ".inno-setup-version";
const INSTALLER_WORKFLOW = ".github/workflows/desktop-installer.yml";
const EXACT_SEMVER = /^\d+\.\d+\.\d+$/;

export function readPinnedInnoSetupVersion(readFile = readFileSync) {
  const version = readFile(VERSION_FILE, "utf8").trim();
  if (!EXACT_SEMVER.test(version)) {
    throw new Error(
      `${VERSION_FILE} harus exact semver x.y.z, ditemukan: ${version || "<empty>"}`,
    );
  }
  return version;
}

export function reviewInstallerWorkflow(content) {
  const findings = [];

  if (!content.includes("pull_request:")) {
    findings.push("Desktop Installer harus punya pull_request acceptance trigger");
  }
  if (!content.includes(`- "${VERSION_FILE}"`)) {
    findings.push(`Desktop Installer pull_request paths harus mencakup ${VERSION_FILE}`);
  }
  if (!content.includes(`Get-Content -LiteralPath "${VERSION_FILE}"`)) {
    findings.push(`Desktop Installer harus membaca pin dari ${VERSION_FILE}`);
  }
  if (
    !content.includes("choco install innosetup --version $innoVersion --yes --no-progress")
  ) {
    findings.push("Inno Setup harus di-install dengan --version dari pin repository");
  }
  if (/choco\s+install\s+innosetup(?![^\n]*--version)/i.test(content)) {
    findings.push(
      "Desktop Installer tidak boleh memakai choco install innosetup tanpa --version",
    );
  }
  if (!content.includes("inputs.version || '0.1.0'")) {
    findings.push("Desktop Installer PR acceptance harus punya fallback version deterministik");
  }

  return findings;
}

export function reviewInstallerToolchain() {
  const version = readPinnedInnoSetupVersion();
  const workflow = readFileSync(INSTALLER_WORKFLOW, "utf8");
  return { version, findings: reviewInstallerWorkflow(workflow) };
}

export function runInstallerToolchainReview() {
  let result;
  try {
    result = reviewInstallerToolchain();
  } catch (error) {
    console.error("installer-toolchain-review: FAIL");
    console.error(`  - ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
    return;
  }

  if (result.findings.length > 0) {
    console.error("installer-toolchain-review: FAIL");
    for (const finding of result.findings) console.error(`  - ${finding}`);
    process.exitCode = 1;
    return;
  }

  console.log(`installer-toolchain-review: PASS (Inno Setup ${result.version})`);
}

const isDirect =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirect) runInstallerToolchainReview();
