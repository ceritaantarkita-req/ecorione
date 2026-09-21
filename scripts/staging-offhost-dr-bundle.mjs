#!/usr/bin/env node
import {
  constants as cryptoConstants,
  createCipheriv,
  createHash,
  createPublicKey,
  publicEncrypt,
  randomBytes,
} from "node:crypto";
import {
  createReadStream,
  createWriteStream,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, resolve } from "node:path";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";

const HASH_RE = /^[0-9a-f]{64}$/;
const SHA_RE = /^[0-9a-f]{40}$/;
const TAG_RE = /^staging-[0-9a-f]{12}$/;
const SAFE_NAME_RE = /^[A-Za-z0-9_.-]+$/;
const ARCHIVE_RE = /^[A-Za-z0-9_.-]+\.tar\.gz$/;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--") || i + 1 >= argv.length) {
      fail(
        "Usage: staging-offhost-dr-bundle.mjs --backup-dir <dir> --public-key <pem> --output-dir <dir>",
      );
    }
    out[key.slice(2)] = argv[++i];
  }
  return out;
}

function assertRegular(path, label) {
  const info = lstatSync(path);
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new Error(`${label} must be a regular non-symlink file`);
  }
}

function parseKeyValue(text) {
  const map = new Map();
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    const at = line.indexOf("=");
    if (at <= 0) throw new Error("Invalid manifest.meta line");
    const key = line.slice(0, at);
    if (map.has(key)) throw new Error(`Duplicate manifest.meta key: ${key}`);
    map.set(key, line.slice(at + 1));
  }
  return map;
}

function sha256File(path) {
  return new Promise((resolveHash, reject) => {
    const hash = createHash("sha256");
    const input = createReadStream(path);
    input.on("data", (chunk) => hash.update(chunk));
    input.on("error", reject);
    input.on("end", () => resolveHash(hash.digest("hex")));
  });
}

async function inspectBackup(backupDir) {
  const dirInfo = lstatSync(backupDir);
  if (!dirInfo.isDirectory() || dirInfo.isSymbolicLink()) {
    throw new Error("backup-dir must be a regular directory");
  }

  const metaPath = resolve(backupDir, "manifest.meta");
  const manifestPath = resolve(backupDir, "manifest.tsv");
  const sumsPath = resolve(backupDir, "SHA256SUMS");
  for (const [path, label] of [
    [metaPath, "manifest.meta"],
    [manifestPath, "manifest.tsv"],
    [sumsPath, "SHA256SUMS"],
  ]) {
    assertRegular(path, label);
  }

  const meta = parseKeyValue(readFileSync(metaPath, "utf8"));
  if (meta.get("schema_version") !== "1") {
    throw new Error("Unsupported PCS-09 backup schema");
  }
  const sourceSha = meta.get("source_sha") ?? "";
  const sourceTag = meta.get("source_tag") ?? "";
  const composeProject = meta.get("compose_project") ?? "";
  if (!SHA_RE.test(sourceSha)) throw new Error("Invalid source_sha");
  if (!TAG_RE.test(sourceTag)) throw new Error("Invalid source_tag");
  if (!SAFE_NAME_RE.test(composeProject)) {
    throw new Error("Invalid compose_project");
  }

  const sums = readFileSync(sumsPath, "utf8").trim().split(/\r?\n/);
  const expected = new Map();
  for (const line of sums) {
    const match = /^([0-9a-f]{64})\s+(.+)$/.exec(line);
    if (!match) throw new Error("Invalid SHA256SUMS line");
    expected.set(basename(match[2]), match[1]);
  }
  for (const name of ["manifest.tsv", "manifest.meta"]) {
    const wanted = expected.get(name);
    if (!wanted) throw new Error(`SHA256SUMS missing ${name}`);
    const actual = await sha256File(resolve(backupDir, name));
    if (actual !== wanted) throw new Error(`${name} SHA-256 mismatch`);
  }

  const rows = [];
  const seenVolumes = new Set();
  const seenArchives = new Set();
  for (const line of readFileSync(manifestPath, "utf8").split(/\r?\n/)) {
    if (!line) continue;
    const [
      volume,
      archive,
      bytesRaw,
      archiveSha,
      treeSha,
      filesRaw,
      ...extra
    ] = line.split("\t");
    if (
      extra.length ||
      !SAFE_NAME_RE.test(volume ?? "") ||
      !ARCHIVE_RE.test(archive ?? "")
    ) {
      throw new Error("Invalid manifest.tsv row");
    }
    if (seenVolumes.has(volume) || seenArchives.has(archive)) {
      throw new Error("Duplicate backup manifest entry");
    }
    seenVolumes.add(volume);
    seenArchives.add(archive);
    if (
      !/^\d+$/.test(bytesRaw ?? "") ||
      !/^\d+$/.test(filesRaw ?? "") ||
      !HASH_RE.test(archiveSha ?? "") ||
      !HASH_RE.test(treeSha ?? "")
    ) {
      throw new Error("Invalid manifest.tsv values");
    }

    const archivePath = resolve(backupDir, archive);
    assertRegular(archivePath, archive);
    const info = statSync(archivePath);
    if (info.size !== Number(bytesRaw)) {
      throw new Error(`${archive} byte-size mismatch`);
    }
    if ((await sha256File(archivePath)) !== archiveSha) {
      throw new Error(`${archive} SHA-256 mismatch`);
    }

    rows.push({
      volume,
      archive,
      bytes: Number(bytesRaw),
      archiveSha,
      treeSha,
      files: Number(filesRaw),
    });
  }
  if (rows.length === 0) throw new Error("Backup manifest is empty");

  return {
    sourceSha,
    sourceTag,
    composeProject,
    createdAt: meta.get("created_at") ?? "",
    rows,
  };
}

function waitChild(child, label) {
  return new Promise((resolveWait, reject) => {
    let stderr = "";
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolveWait()
        : reject(new Error(`${label} failed (${code}): ${stderr.trim()}`)),
    );
  });
}

async function main() {
  if (typeof process.getuid === "function" && process.getuid() !== 0) {
    fail("Run as root so root-only PCS-09 backups remain protected.");
  }

  const args = parseArgs(process.argv.slice(2));
  const backupDir = resolve(args["backup-dir"] ?? "");
  const publicKeyPath = resolve(args["public-key"] ?? "");
  const outputDir = resolve(args["output-dir"] ?? "");
  if (!args["backup-dir"] || !args["public-key"] || !args["output-dir"]) {
    fail(
      "Usage: staging-offhost-dr-bundle.mjs --backup-dir <dir> --public-key <pem> --output-dir <dir>",
    );
  }

  assertRegular(publicKeyPath, "DR public key");
  const publicKey = createPublicKey(readFileSync(publicKeyPath));
  if (
    publicKey.asymmetricKeyType !== "rsa" ||
    (publicKey.asymmetricKeyDetails?.modulusLength ?? 0) < 3072
  ) {
    throw new Error("DR public key must be RSA >= 3072 bits");
  }

  const backup = await inspectBackup(backupDir);
  mkdirSync(outputDir, { recursive: true, mode: 0o700 });
  const compact = (backup.createdAt || new Date().toISOString())
    .replace(/[^0-9]/g, "")
    .slice(0, 14);
  const stem = `ecorione-dr-${compact}-${backup.sourceSha.slice(0, 12)}`;
  const bundlePath = resolve(outputDir, `${stem}.ecdr`);
  const metadataPath = resolve(outputDir, `${stem}.json`);
  for (const path of [bundlePath, metadataPath]) {
    try {
      lstatSync(path);
      throw new Error(`Refusing to overwrite ${path}`);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  const dataKey = randomBytes(32);
  const iv = randomBytes(12);
  const wrappedKey = publicEncrypt(
    {
      key: publicKey,
      oaepHash: "sha256",
      padding: cryptoConstants.RSA_PKCS1_OAEP_PADDING,
    },
    dataKey,
  );
  const aadObject = {
    schemaVersion: 1,
    sourceSha: backup.sourceSha,
    sourceTag: backup.sourceTag,
    composeProject: backup.composeProject,
    backupRunId: basename(backupDir),
    cipher: "aes-256-gcm",
    keyWrap: "rsa-oaep-sha256",
  };
  const aad = Buffer.from(JSON.stringify(aadObject), "utf8");
  const cipher = createCipheriv("aes-256-gcm", dataKey, iv, {
    authTagLength: 16,
  });
  cipher.setAAD(aad);

  const files = [
    "manifest.meta",
    "manifest.tsv",
    "SHA256SUMS",
    ...backup.rows.map((row) => row.archive),
  ].sort();
  const tar = spawn("tar", ["-C", backupDir, "-cf", "-", "--", ...files], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const tempPath = `${bundlePath}.part-${process.pid}`;
  const output = createWriteStream(tempPath, {
    flags: "wx",
    mode: 0o600,
  });
  const tarDone = waitChild(tar, "tar");
  try {
    await pipeline(tar.stdout, cipher, output);
    await tarDone;
  } catch (error) {
    tar.kill("SIGKILL");
    throw error;
  }

  const authTag = cipher.getAuthTag();
  const ciphertextSha256 = await sha256File(tempPath);
  const ciphertextBytes = statSync(tempPath).size;
  const metadata = {
    ...aadObject,
    createdAt: new Date().toISOString(),
    bundleFilename: basename(bundlePath),
    ciphertextBytes,
    ciphertextSha256,
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    wrappedKey: wrappedKey.toString("base64"),
    aad: aad.toString("base64"),
    archiveCount: backup.rows.length,
    claimBoundary:
      "encrypted portable backup prepared for off-host transfer; not yet total-host-loss recovery evidence",
  };
  writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, {
    mode: 0o600,
    flag: "wx",
  });
  renameSync(tempPath, bundlePath);

  console.log("PASS encrypted ECORIONE DR bundle created");
  console.log(`bundle=${bundlePath}`);
  console.log(`metadata=${metadataPath}`);
  console.log(`source_sha=${backup.sourceSha}`);
  console.log(`source_tag=${backup.sourceTag}`);
  console.log(
    "Private DR key is intentionally not used on the source host.",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
