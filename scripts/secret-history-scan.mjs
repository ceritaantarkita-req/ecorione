#!/usr/bin/env node
import { execFileSync } from "node:child_process";

const ALLOW_MARKER = "secret-scan:allow";
const combined = [
  "sk-ant-[A-Za-z0-9_-]{20,}", // secret-scan:allow
  "sk-(proj-)?[A-Za-z0-9_-]{32,}", // secret-scan:allow
  "sk-or-v1-[A-Za-z0-9]{32,}", // secret-scan:allow
  "gh[pousr]_[A-Za-z0-9]{36,}", // secret-scan:allow
  "AKIA[0-9A-Z]{16}", // secret-scan:allow
  "AIza[0-9A-Za-z_-]{35}", // secret-scan:allow
  "xox[baprs]-[0-9A-Za-z-]{10,}", // secret-scan:allow
  "-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----", // secret-scan:allow
].join("|");

function git(args, options = {}) {
  return execFileSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });
}

const commits = git(["rev-list", "--all"])
  .split("\n")
  .map((value) => value.trim())
  .filter(Boolean);
if (commits.length === 0) throw new Error("Git history kosong; full-history scan tidak valid.");

const findings = [];
for (const commit of commits) {
  try {
    const output = git(["grep", "-n", "-I", "-E", combined, commit]);
    for (const line of output.split("\n")) {
      if (line.length === 0 || line.includes(ALLOW_MARKER)) continue;
      findings.push(line);
      if (findings.length >= 100) break;
    }
  } catch (error) {
    if (error?.status !== 1) throw error;
  }
  if (findings.length >= 100) break;
}

const historyPaths = git(["log", "--all", "--name-only", "--pretty=format:"])
  .split("\n")
  .map((value) => value.trim())
  .filter(Boolean);
const forbidden = new Set(
  historyPaths.filter((path) => {
    const name = path.split("/").at(-1) ?? path;
    return (
      name === ".env" ||
      (name.startsWith(".env.") && name !== ".env.example") ||
      name.endsWith(".pem") ||
      name === "credentials.json"
    );
  }),
);
for (const path of forbidden) findings.push(`history-path:${path}`);

if (findings.length > 0) {
  console.error(`secret-history-scan: ${String(findings.length)} temuan; nilai secret tidak dicetak.`);
  for (const finding of findings.slice(0, 100)) {
    const parts = finding.split(":");
    console.error(`  ${parts.slice(0, 3).join(":")}`);
  }
  process.exit(1);
}
console.log(`secret-history-scan: bersih (${String(commits.length)} commit diperiksa).`);
