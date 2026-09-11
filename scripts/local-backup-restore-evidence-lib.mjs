import { resolve, sep } from "node:path";

export const EVIDENCE_RELATIVE_ROOT = ".ecorione/evidence/local-backup-restore";

export const OWNER_WORKERS = Object.freeze({
  context: "services/context/src/backup-evidence-worker.ts",
  hub: "services/hub/src/backup-evidence-worker.ts",
  rnd: "services/rnd/src/backup-evidence-worker.ts",
  sync: "services/sync/src/backup-evidence-worker.ts",
  space: "services/space/src/backup-evidence-worker.ts",
  flow: "services/flow/src/backup-evidence-worker.ts",
  artifact: "services/artifact/src/backup-evidence-worker.ts",
  sandbox: "services/sandbox/src/backup-evidence-worker.ts",
  connect: "services/connect/src/backup-evidence-worker.ts",
});

export function resolveEvidencePath(repoRoot, candidate) {
  const root = resolve(repoRoot, EVIDENCE_RELATIVE_ROOT);
  const path = resolve(candidate);
  if (path !== root && !path.startsWith(`${root}${sep}`)) {
    throw new Error(`evidence path keluar boundary: ${path}`);
  }
  return path;
}

export function safeRunId(value) {
  if (!/^[a-z0-9][a-z0-9._-]{0,127}$/i.test(value)) {
    throw new Error(`run id tidak valid: ${value}`);
  }
  return value;
}

export function parseWorkerJson(stdout, owner) {
  const lines = String(stdout)
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) throw new Error(`${owner} worker tidak menghasilkan output`);
  try {
    return JSON.parse(lines.at(-1));
  } catch (error) {
    throw new Error(
      `${owner} worker output bukan JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function backupIds(owner, result) {
  switch (owner) {
    case "context":
    case "hub":
    case "sync":
    case "space":
      return { db: result.manifest?.backupId ?? null };
    case "flow":
      return { graph: result.manifest?.backupId ?? null };
    case "artifact":
      return { cas: result.manifest?.backupId ?? null };
    case "sandbox":
      return { receipts: result.manifest?.backupId ?? null };
    case "rnd":
      return {
        db: result.manifests?.db?.backupId ?? null,
        datasets: result.manifests?.datasets?.backupId ?? null,
      };
    case "connect":
      return {
        state: result.manifests?.state?.backupId ?? null,
        vault: result.manifests?.vaultCiphertext?.backupId ?? null,
      };
    default:
      throw new Error(`owner tidak dikenal: ${owner}`);
  }
}

export function requiredBackupGaps(results) {
  const required = ["context", "hub", "rnd", "space", "flow", "artifact", "sandbox"];
  return required.filter((owner) => results[owner]?.status !== "backed-up");
}
