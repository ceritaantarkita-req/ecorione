import { resolve } from "node:path";

/**
 * Resolve filesystem configuration consistently from the repository root.
 *
 * Package scripts run with package-local cwd under `pnpm --filter`, so accepting a
 * relative env path verbatim can silently move durable state into `services/*/data`.
 * Absolute production/container paths remain unchanged because `path.resolve` keeps
 * an absolute candidate authoritative.
 */
export function resolveRepoRuntimePath(
  repoRoot: string,
  configured: string | undefined,
  fallbackRelative: string,
): string {
  const candidate = configured !== undefined && configured.length > 0 ? configured : fallbackRelative;
  return resolve(repoRoot, candidate);
}
