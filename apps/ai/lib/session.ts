/**
 * Format `sessionId` sisi client — `docs/api-fase1.md` §Ai: `sess_<hex>` lewat
 * `crypto.randomUUID()`, tidak perlu impor `@ecorione/shared-schema` ke bundle browser
 * karena Hub tetap memvalidasi ulang dengan Zod (`SessionIdSchema`).
 *
 * Verifikasi terhadap `SUFFIX` di `packages/shared-schema/src/ids.ts`
 * (`/^[a-z0-9][a-z0-9_-]*$/`): UUID lowercase v4 seperti
 * `3fa85f64-5717-4562-b3fc-2c963f66afa6` sudah diawali `[a-z0-9]` dan sisanya cuma
 * heksadesimal + `-`, jadi **sudah lolos** tanpa perlu menghapus tanda hubung — ada test
 * (`session.test.ts`) yang memaksa itu lewat `isId`/`SessionIdSchema` supaya asumsi ini
 * tidak diam-diam basi kalau regex-nya berubah.
 */

const SESSION_PREFIX = "sess_";

export function makeSessionId(
  random: () => string = () => globalThis.crypto.randomUUID(),
): string {
  return `${SESSION_PREFIX}${random()}`;
}

const SESSION_ID_PATTERN = /^sess_[a-z0-9][a-z0-9_-]*$/;

export function isClientSessionId(value: string | null | undefined): value is string {
  return typeof value === "string" && SESSION_ID_PATTERN.test(value);
}

export function projectSessionStorageKey(projectId: string): string {
  return `ecorione.session.${projectId}`;
}
