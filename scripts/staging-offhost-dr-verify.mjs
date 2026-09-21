#!/usr/bin/env node
import {
  constants as cryptoConstants,
  createDecipheriv,
  createHash,
  createPrivateKey,
  privateDecrypt,
} from "node:crypto";
import {
  createReadStream,
  createWriteStream,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { pipeline } from "node:stream/promises";

const HASH_RE = /^[0-9a-f]{64}$/;
const SHA_RE = /^[0-9a-f]{40}$/;
const TAG_RE = /^staging-[0-9a-f]{12}$/;
const SAFE_NAME_RE = /^[A-Za-z0-9_.-]+$/;
const ARCHIVE_RE = /^[A-Za-z0-9_.-]+\.tar\.gz$/;
const HELPER_IMAGE =
  "postgres:17.6-alpine@sha256:ef257d85f76e48da1c64832459b59fcaba1a4dac97bf5d7450c77753542eee94";

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const out = { docker: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--verify-docker") {
      out.docker = true;
      continue;
    }
    if (!argv[i].startsWith("--") || i + 1 >= argv.length) {
      fail(
        "Usage: staging-offhost-dr-verify.mjs --bundle <file> --metadata <json> --private-key <pem> [--verify-docker]",
      );
    }
    out[argv[i].slice(2)] = argv[++i];
  }
  return out;
}

function assertRegular(path, label) {
  const info = lstatSync(path);
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new Error(`${label} must be a regular non-symlink file`);
  }
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

function decodeB64(value, label) {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value)
  ) {
    throw new Error(`Invalid ${label}`);
  }
  return Buffer.from(value, "base64");
}

function parseManifest(dir) {
  const metaText = readFileSync(join(dir, "manifest.meta"), "utf8");
  const meta = new Map();
  for (const line of metaText.split(/\r?\n/)) {
    if (!line) continue;
    const at = line.indexOf("=");
    if (at <= 0) throw new Error("Invalid manifest.meta line");
    const key = line.slice(0, at);
    if (meta.has(key)) {
      throw new Error(`Duplicate manifest.meta key: ${key}`);
    }
    meta.set(key, line.slice(at + 1));
  }

  if (meta.get("schema_version") !== "1") {
    throw new Error("Unsupported PCS-09 backup schema");
  }
  const sourceSha = meta.get("source_sha") ?? "";
  const sourceTag = meta.get("source_tag") ?? "";
  const composeProject = meta.get("compose_project") ?? "";
  if (
    !SHA_RE.test(sourceSha) ||
    !TAG_RE.test(sourceTag) ||
    !SAFE_NAME_RE.test(composeProject)
  ) {
    throw new Error("Invalid manifest.meta identity");
  }

  const rows = [];
  const seenVolumes = new Set();
  const seenArchives = new Set();
  for (const line of readFileSync(join(dir, "manifest.tsv"), "utf8").split(
    /\r?\n/,
  )) {
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
      !ARCHIVE_RE.test(archive ?? "") ||
      !/^\d+$/.test(bytesRaw ?? "") ||
      !/^\d+$/.test(filesRaw ?? "") ||
      !HASH_RE.test(archiveSha ?? "") ||
      !HASH_RE.test(treeSha ?? "")
    ) {
      throw new Error("Invalid manifest.tsv row");
    }
    if (seenVolumes.has(volume) || seenArchives.has(archive)) {
      throw new Error("Duplicate backup manifest entry");
    }
    seenVolumes.add(volume);
    seenArchives.add(archive);
    rows.push({
      volume,
      archive,
      bytes: Number(bytesRaw),
      archiveSha,
      treeSha,
      files: Number(filesRaw),
    });
  }
  if (!rows.length) throw new Error("Backup manifest is empty");
  return { sourceSha, sourceTag, composeProject, rows };
}

async function decryptBundle(bundlePath, metadata, privateKey, outputPath) {
  const dataKey = privateDecrypt(
    {
      key: privateKey,
      oaepHash: "sha256",
      padding: cryptoConstants.RSA_PKCS1_OAEP_PADDING,
    },
    decodeB64(metadata.wrappedKey, "wrappedKey"),
  );
  if (dataKey.length !== 32) {
    throw new Error("Unwrapped DR key has invalid length");
  }

  const iv = decodeB64(metadata.iv, "iv");
  const tag = decodeB64(metadata.authTag, "authTag");
  const aad = decodeB64(metadata.aad, "aad");
  if (iv.length !== 12 || tag.length !== 16) {
    throw new Error("Invalid AES-GCM metadata");
  }

  const decipher = createDecipheriv("aes-256-gcm", dataKey, iv, {
    authTagLength: 16,
  });
  decipher.setAAD(aad);
  decipher.setAuthTag(tag);
  await pipeline(
    createReadStream(bundlePath),
    decipher,
    createWriteStream(outputPath, { flags: "wx", mode: 0o600 }),
  );
}

function runTar(args, cwd) {
  const result = spawnSync("tar", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(
      `tar failed: ${(result.stderr || result.stdout).trim()}`,
    );
  }
  return result.stdout;
}

async function verifyExtracted(dir, metadata) {
  for (const name of ["manifest.meta", "manifest.tsv", "SHA256SUMS"]) {
    assertRegular(join(dir, name), name);
  }

  const sums = new Map();
  for (const line of readFileSync(join(dir, "SHA256SUMS"), "utf8")
    .trim()
    .split(/\r?\n/)) {
    const match = /^([0-9a-f]{64})\s+(.+)$/.exec(line);
    if (!match) throw new Error("Invalid SHA256SUMS line");
    sums.set(basename(match[2]), match[1]);
  }
  for (const name of ["manifest.tsv", "manifest.meta"]) {
    if (
      !sums.has(name) ||
      (await sha256File(join(dir, name))) !== sums.get(name)
    ) {
      throw new Error(`${name} checksum mismatch`);
    }
  }

  const manifest = parseManifest(dir);
  if (
    manifest.sourceSha !== metadata.sourceSha ||
    manifest.sourceTag !== metadata.sourceTag ||
    manifest.composeProject !== metadata.composeProject
  ) {
    throw new Error("Bundle metadata does not match embedded backup identity");
  }

  for (const row of manifest.rows) {
    const path = join(dir, row.archive);
    assertRegular(path, row.archive);
    if (
      statSync(path).size !== row.bytes ||
      (await sha256File(path)) !== row.archiveSha
    ) {
      throw new Error(`${row.archive} integrity mismatch`);
    }
  }
  return manifest;
}

function runDocker(args) {
  const result = spawnSync("docker", args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(
      `docker ${args[0]} failed: ${(result.stderr || result.stdout).trim()}`,
    );
  }
  return result.stdout.trim();
}

function fingerprintVolume(volume) {
  return runDocker([
    "run",
    "--rm",
    "--entrypoint",
    "sh",
    "-v",
    `${volume}:/source:ro`,
    HELPER_IMAGE,
    "-lc",
    'cd /source && find . -type f -exec sha256sum {} \\; | LC_ALL=C sort | sha256sum | cut -d" " -f1',
  ]);
}

function fileCountVolume(volume) {
  return Number(
    runDocker([
      "run",
      "--rm",
      "--entrypoint",
      "sh",
      "-v",
      `${volume}:/source:ro`,
      HELPER_IMAGE,
      "-lc",
      "cd /source && find . -type f | wc -l",
    ]),
  );
}

function verifyDockerRestore(dir, manifest) {
  runDocker(["image", "inspect", HELPER_IMAGE]);
  const created = [];

  try {
    for (const row of manifest.rows) {
      const safe = row.volume.replace(/[^A-Za-z0-9_.-]/g, "_");
      const volume = `ecorione-dr-verify-${safe}-${process.pid}`;
      runDocker(["volume", "create", volume]);
      created.push(volume);

      runDocker([
        "run",
        "--rm",
        "--entrypoint",
        "sh",
        "-v",
        `${volume}:/restore`,
        "-v",
        `${dir}:/backup:ro`,
        HELPER_IMAGE,
        "-lc",
        `cd /restore && tar -xzf /backup/${row.archive}`,
      ]);

      const tree = fingerprintVolume(volume);
      const files = fileCountVolume(volume);
      if (tree !== row.treeSha || files !== row.files) {
        throw new Error(
          `Docker restore content mismatch for ${row.volume}`,
        );
      }

      runDocker(["volume", "rm", "-f", volume]);
      created.pop();
      console.log(
        `PASS isolated clean-host restore verification: ${row.volume}`,
      );
    }
  } finally {
    for (const volume of created.reverse()) {
      spawnSync("docker", ["volume", "rm", "-f", volume], {
        stdio: "ignore",
      });
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.bundle || !args.metadata || !args["private-key"]) {
    fail(
      "Usage: staging-offhost-dr-verify.mjs --bundle <file> --metadata <json> --private-key <pem> [--verify-docker]",
    );
  }

  const bundlePath = resolve(args.bundle);
  const metadataPath = resolve(args.metadata);
  const privateKeyPath = resolve(args["private-key"]);
  assertRegular(bundlePath, "bundle");
  assertRegular(metadataPath, "metadata");
  assertRegular(privateKeyPath, "DR private key");

  const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
  if (
    metadata.schemaVersion !== 1 ||
    metadata.cipher !== "aes-256-gcm" ||
    metadata.keyWrap !== "rsa-oaep-sha256" ||
    !SHA_RE.test(metadata.sourceSha ?? "") ||
    !TAG_RE.test(metadata.sourceTag ?? "") ||
    !SAFE_NAME_RE.test(metadata.composeProject ?? "") ||
    !HASH_RE.test(metadata.ciphertextSha256 ?? "") ||
    !Number.isSafeInteger(metadata.ciphertextBytes) ||
    metadata.ciphertextBytes < 1
  ) {
    throw new Error("Invalid DR metadata");
  }
  if (basename(bundlePath) !== metadata.bundleFilename) {
    throw new Error("Bundle filename does not match metadata");
  }
  if (
    statSync(bundlePath).size !== metadata.ciphertextBytes ||
    (await sha256File(bundlePath)) !== metadata.ciphertextSha256
  ) {
    throw new Error("Encrypted bundle checksum mismatch");
  }

  const privateKey = createPrivateKey(readFileSync(privateKeyPath));
  if (
    privateKey.asymmetricKeyType !== "rsa" ||
    (privateKey.asymmetricKeyDetails?.modulusLength ?? 0) < 3072
  ) {
    throw new Error("DR private key must be RSA >= 3072 bits");
  }

  const workRoot = resolve(
    process.env.ECORIONE_DR_WORK_ROOT ||
      join(tmpdir(), "ecorione-dr-restore"),
  );
  mkdirSync(workRoot, { recursive: true, mode: 0o700 });
  const extractDir = mkdtempSync(join(workRoot, "verify-"));
  const plainTar = join(extractDir, "bundle.tar");

  try {
    await decryptBundle(bundlePath, metadata, privateKey, plainTar);
    const list = runTar(["-tf", plainTar], process.cwd());
    const entries = list.split(/\r?\n/).filter(Boolean);
    if (
      !entries.length ||
      entries.some(
        (entry) =>
          entry.startsWith("/") ||
          entry.includes("..") ||
          entry.includes("/") ||
          !/^[A-Za-z0-9_.-]+$/.test(entry),
      )
    ) {
      throw new Error("Unsafe tar entry detected");
    }

    runTar(
      [
        "-xf",
        plainTar,
        "--no-same-owner",
        "--no-same-permissions",
        "-C",
        extractDir,
      ],
      process.cwd(),
    );
    rmSync(plainTar, { force: true });

    const manifest = await verifyExtracted(extractDir, metadata);
    if (args.docker) verifyDockerRestore(extractDir, manifest);

    console.log(
      "PASS ECORIONE off-host DR bundle integrity verification",
    );
    console.log(`source_sha=${manifest.sourceSha}`);
    console.log(`source_tag=${manifest.sourceTag}`);
    console.log(`volumes=${manifest.rows.length}`);
    console.log(
      args.docker
        ? "restore_boundary=isolated Docker-volume content restore verified"
        : "restore_boundary=encrypted bundle + embedded backup integrity verified; Docker restore not requested",
    );
  } finally {
    rmSync(extractDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
