#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const files = execFileSync("git", ["ls-files", "*package.json"], {
  encoding: "utf8",
})
  .split("\n")
  .map((value) => value.trim())
  .filter(Boolean);
const findings = [];

for (const file of files) {
  const json = JSON.parse(readFileSync(file, "utf8"));
  for (const section of ["dependencies", "devDependencies", "optionalDependencies"]) {
    for (const [name, spec] of Object.entries(json[section] ?? {})) {
      if (typeof spec !== "string") continue;
      if (
        spec === "*" ||
        spec === "latest" ||
        /^(?:git\+|git:|https?:|github:|bitbucket:)/i.test(spec)
      ) {
        findings.push(`${file} ${section}.${name} menggunakan source/version tidak diizinkan: ${spec}`);
      }
    }
  }
}

const compose = readFileSync("deploy/compose.yml", "utf8");
for (const match of compose.matchAll(/^\s*image:\s*([^\s#]+).*$/gm)) {
  const image = match[1] ?? "";
  const lastSlash = image.lastIndexOf("/");
  const tail = image.slice(lastSlash + 1);
  if (!tail.includes(":")) findings.push(`Docker image tanpa explicit tag: ${image}`);
  if (/:latest(?:$|@)/.test(image)) findings.push(`Docker image memakai latest: ${image}`);
}

if (!readFileSync("pnpm-lock.yaml", "utf8").includes("lockfileVersion:")) {
  findings.push("pnpm-lock.yaml tidak valid/tidak memiliki lockfileVersion");
}

if (findings.length > 0) {
  console.error("dependency-security-review gagal:");
  for (const finding of findings) console.error(`  - ${finding}`);
  process.exit(1);
}
console.log(`dependency-security-review: PASS (${String(files.length)} package manifest).`);
