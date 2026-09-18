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

export function reviewInstallerWorkflowContent(content, version) {
  const findings = [];
  const installLines = content
    .split("\n")
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => /choco\s+install\s+innosetup\b/i.test(line));

  if (installLines.length === 0) {
    findings.push(
      `${INSTALLER_WORKFLOW}: Chocolatey Inno Setup install step tidak ditemukan`,
    );
    return findings;
  }

  for (const { line, lineNumber } of installLines) {
    if (!/--version(?:=|\s+)/i.test(line)) {
      findings.push(
        `${INSTALLER_WORKFLOW}:${String(lineNumber)} choco innosetup harus memakai --version dari ${VERSION_FILE}`,
      );
    }
  }

  if (!content.includes('Get-Content -Raw ".inno-setup-version"')) {
    findings.push(
      `${INSTALLER_WORKFLOW}: workflow harus membaca pin dari ${VERSION_FILE}`,
    );
  }
  if (!content.includes('--version="$version"')) {
    findings.push(
      `${INSTALLER_WORKFLOW}: choco install harus memakai --version="$version"`,
    );
  }

  const major = version.split(".")[0];
  if (!content.includes(`Inno Setup ${major}\\ISCC.exe`)) {
    findings.push(
      `${INSTALLER_WORKFLOW}: path compiler harus selaras dengan major Inno Setup ${major}`,
    );
  }

  return findings;
}

export function reviewInstallerToolchain() {
  const version = readPinnedInnoSetupVersion();
  const workflow = readFileSync(INSTALLER_WORKFLOW, "utf8");
  return {
    version,
    findings: reviewInstallerWorkflowContent(workflow, version),
  };
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
