#!/usr/bin/env node
import {
  constants as cryptoConstants,
  createDecipheriv,
  createHash,
  createPrivateKey,
  privateDecrypt,
} from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  createReadStream,
  createWriteStream,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VERIFY_SCRIPT = resolve(ROOT, "scripts/staging-offhost-dr-verify.mjs");
const HELPER_IMAGE =
  "postgres:17.6-alpine@sha256:ef257d85f76e48da1c64832459b59fcaba1a4dac97bf5d7450c77753542eee94";
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
    if (!argv[i].startsWith("--") || i + 1 >= argv.length) {
      fail(
        "Usage: staging-offhost-dr-restore.mjs --bundle <file> --metadata <json> --private-key <pem>",
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
  if (typeof value !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new Error(`Invalid ${label}`);
  }
  return Buffer.from(value, "base64");
}

function run(name, args, options = {}) {
  const result = spawnSync(name, args, {
    cwd: ROOT,
    encoding: "utf8",
    env: options.env ?? process.env,
    stdio: options.inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (options.allowFailure) return null;
    throw new Error(
      `${options.label ?? name} failed (${String(result.status)}): ${String(
        result.stderr || result.stdout || "",
      ).trim()}`,
    );
  }
  return String(result.stdout || "").trim();
}

function parseMetadata(path) {
  const metadata = JSON.parse(readFileSync(path, "utf8"));
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
  return metadata;
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
  if (dataKey.length !== 32) throw new Error("Unwrapped DR key has invalid length");

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

function validateOuterTar(plainTar) {
  const entries = run("tar", ["-tf", plainTar], { label: "outer bundle inventory" })
    .split(/\r?\n/)
    .filter(Boolean);
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
    throw new Error("Unsafe outer bundle tar entry detected");
  }
}

function parseManifest(dir) {
  const meta = new Map();
  for (const line of readFileSync(join(dir, "manifest.meta"), "utf8").split(/\r?\n/)) {
    if (!line) continue;
    const at = line.indexOf("=");
    if (at <= 0) throw new Error("Invalid manifest.meta line");
    const key = line.slice(0, at);
    if (meta.has(key)) throw new Error(`Duplicate manifest.meta key: ${key}`);
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
    throw new Error("Invalid embedded backup identity");
  }

  const rows = [];
  const seenVolumes = new Set();
  for (const line of readFileSync(join(dir, "manifest.tsv"), "utf8").split(/\r?\n/)) {
    if (!line) continue;
    const [volume, archive, bytesRaw, archiveSha, treeSha, filesRaw, ...extra] =
      line.split("\t");
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
    if (seenVolumes.has(volume)) throw new Error("Duplicate backup volume");
    seenVolumes.add(volume);
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

function fingerprintVolume(volume) {
  return run(
    "docker",
    [
      "run",
      "--rm",
      "--entrypoint",
      "sh",
      "-v",
      `${volume}:/source:ro`,
      HELPER_IMAGE,
      "-lc",
      'cd /source && find . -type f -exec sha256sum {} \\; | LC_ALL=C sort | sha256sum | cut -d" " -f1',
    ],
    { label: `fingerprint ${volume}` },
  );
}

function fileCountVolume(volume) {
  const value = run(
    "docker",
    [
      "run",
      "--rm",
      "--entrypoint",
      "sh",
      "-v",
      `${volume}:/source:ro`,
      HELPER_IMAGE,
      "-lc",
      "cd /source && find . -type f | wc -l",
    ],
    { label: `file count ${volume}` },
  );
  return Number(value);
}

function restoreProjectVolumes(dir, manifest) {
  const project = manifest.composeProject;
  const existingContainers = run(
    "docker",
    [
      "ps",
      "-a",
      "--filter",
      `label=com.docker.compose.project=${project}`,
      "--format",
      "{{.ID}}",
    ],
    { label: "existing project container inventory" },
  );
  if (existingContainers) {
    throw new Error(
      "Refusing real-volume restore: Compose project containers already exist on this host",
    );
  }

  const planned = manifest.rows.map((row) => {
    const prefix = `${project}_`;
    if (!row.volume.startsWith(prefix)) {
      throw new Error(`Backup volume does not belong to Compose project: ${row.volume}`);
    }
    const logical = row.volume.slice(prefix.length);
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(logical)) {
      throw new Error(`Invalid Compose logical volume name: ${logical}`);
    }
    if (
      run("docker", ["volume", "inspect", row.volume], {
        allowFailure: true,
        label: `inspect ${row.volume}`,
      }) !== null
    ) {
      throw new Error(`Refusing real-volume restore: target volume already exists: ${row.volume}`);
    }
    return { ...row, logical };
  });

  const created = [];
  try {
    for (const row of planned) {
      run(
        "docker",
        [
          "volume",
          "create",
          "--label",
          `com.docker.compose.project=${project}`,
          "--label",
          `com.docker.compose.volume=${row.logical}`,
          row.volume,
        ],
        { label: `create ${row.volume}` },
      );
      created.push(row.volume);

      run(
        "docker",
        [
          "run",
          "--rm",
          "--entrypoint",
          "sh",
          "-v",
          `${row.volume}:/restore`,
          "-v",
          `${dir}:/backup:ro`,
          HELPER_IMAGE,
          "-lc",
          `cd /restore && tar -xzf /backup/${row.archive}`,
        ],
        { label: `restore ${row.volume}` },
      );

      const tree = fingerprintVolume(row.volume);
      const files = fileCountVolume(row.volume);
      if (tree !== row.treeSha || files !== row.files) {
        throw new Error(`Restored project-volume content mismatch for ${row.volume}`);
      }
      console.log(`PASS real project-volume restore: ${row.volume}`);
    }
    return planned;
  } catch (error) {
    for (const volume of created.reverse()) {
      run("docker", ["volume", "rm", "-f", volume], {
        allowFailure: true,
        label: `cleanup ${volume}`,
      });
    }
    throw error;
  }
}

async function main() {
  if (typeof process.getuid === "function" && process.getuid() !== 0) {
    fail("Run as root for guarded real-volume recovery.");
  }
  if (process.env.ECORIONE_DR_RESTORE_ACK !== "1") {
    fail(
      "Set ECORIONE_DR_RESTORE_ACK=1 only on a clean replacement host after isolated verification is intended.",
    );
  }

  const args = parseArgs(process.argv.slice(2));
  if (!args.bundle || !args.metadata || !args["private-key"]) {
    fail(
      "Usage: staging-offhost-dr-restore.mjs --bundle <file> --metadata <json> --private-key <pem>",
    );
  }

  const bundlePath = resolve(args.bundle);
  const metadataPath = resolve(args.metadata);
  const privateKeyPath = resolve(args["private-key"]);
  for (const [path, label] of [
    [bundlePath, "bundle"],
    [metadataPath, "metadata"],
    [privateKeyPath, "DR private key"],
  ]) {
    assertRegular(path, label);
  }

  const metadata = parseMetadata(metadataPath);
  if (
    basename(bundlePath) !== metadata.bundleFilename ||
    statSync(bundlePath).size !== metadata.ciphertextBytes ||
    (await sha256File(bundlePath)) !== metadata.ciphertextSha256
  ) {
    throw new Error("Encrypted bundle identity/integrity mismatch");
  }

  console.log("Running isolated clean-host restore verification before real-volume mutation...");
  run(
    process.execPath,
    [
      VERIFY_SCRIPT,
      "--bundle",
      bundlePath,
      "--metadata",
      metadataPath,
      "--private-key",
      privateKeyPath,
      "--verify-docker",
    ],
    { inherit: true, label: "isolated DR verifier" },
  );

  run("docker", ["image", "inspect", HELPER_IMAGE], {
    label: "pinned helper image inventory",
  });

  const privateKey = createPrivateKey(readFileSync(privateKeyPath));
  if (
    privateKey.asymmetricKeyType !== "rsa" ||
    (privateKey.asymmetricKeyDetails?.modulusLength ?? 0) < 3072
  ) {
    throw new Error("DR private key must be RSA >= 3072 bits");
  }

  const recoveryStartedAt = new Date().toISOString();
  const workRoot = resolve(
    process.env.ECORIONE_DR_WORK_ROOT || join(tmpdir(), "ecorione-dr-restore"),
  );
  mkdirSync(workRoot, { recursive: true, mode: 0o700 });
  const extractDir = mkdtempSync(join(workRoot, "real-restore-"));
  const plainTar = join(extractDir, "bundle.tar");

  try {
    await decryptBundle(bundlePath, metadata, privateKey, plainTar);
    validateOuterTar(plainTar);
    run(
      "tar",
      [
        "-xf",
        plainTar,
        "--no-same-owner",
        "--no-same-permissions",
        "-C",
        extractDir,
      ],
      { label: "outer bundle extraction" },
    );
    rmSync(plainTar, { force: true });

    const manifest = parseManifest(extractDir);
    if (
      manifest.sourceSha !== metadata.sourceSha ||
      manifest.sourceTag !== metadata.sourceTag ||
      manifest.composeProject !== metadata.composeProject
    ) {
      throw new Error("DR metadata does not match embedded backup identity");
    }

    const restored = restoreProjectVolumes(extractDir, manifest);
    const dataReadyAt = new Date().toISOString();
    const receiptRoot = resolve(
      process.env.ECORIONE_DR_RECOVERY_STATE_ROOT || "/var/lib/ecorione-dr",
    );
    mkdirSync(receiptRoot, { recursive: true, mode: 0o700 });
    const receiptPath = resolve(
      receiptRoot,
      `restore-${manifest.sourceSha.slice(0, 12)}-${Date.now()}.json`,
    );
    const receipt = {
      schemaVersion: 1,
      recoveryStartedAt,
      dataReadyAt,
      sourceSha: manifest.sourceSha,
      sourceTag: manifest.sourceTag,
      composeProject: manifest.composeProject,
      bundleFilename: basename(bundlePath),
      ciphertextSha256: metadata.ciphertextSha256,
      restoredVolumes: restored.map((row) => ({
        name: row.volume,
        logicalName: row.logical,
        treeSha256: row.treeSha,
        fileCount: row.files,
      })),
      applicationStarted: false,
      secretsRestored: false,
      claimBoundary:
        "Clean replacement-host data volumes restored and fingerprint-verified; application/secrets/reboot acceptance still required.",
    };
    writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, {
      mode: 0o600,
      flag: "wx",
    });

    console.log("PASS ECORIONE clean-host real project-volume restore");
    console.log(`restore_receipt=${receiptPath}`);
    console.log(`source_sha=${manifest.sourceSha}`);
    console.log(`source_tag=${manifest.sourceTag}`);
    console.log(`volumes=${restored.length}`);
    console.log(
      "IMPORTANT: restore secrets separately, check out the exact source SHA, start the recorded topology, then run recovery acceptance.",
    );
  } finally {
    rmSync(extractDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
