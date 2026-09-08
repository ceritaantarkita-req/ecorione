/**
 * Error domain adapter provider — dipetakan ke `BadGatewayError` (502) di `http.ts`,
 * bukan 500: kegagalan provider bukan bug di Connect (`docs/api-fase1.md` §Connect).
 */

export class ProviderError extends Error {
  readonly provider: "hosted" | "local";

  constructor(provider: "hosted" | "local", message: string) {
    super(message);
    this.name = "ProviderError";
    this.provider = provider;
  }
}

/** Kredensial provider hosted belum diisi — gagal jelas, bukan mencoba dan gagal samar. */
export class MissingCredentialError extends Error {
  constructor(envVar: string) {
    super(`Kredensial provider belum diisi di .env: ${envVar}.`);
    this.name = "MissingCredentialError";
  }
}
