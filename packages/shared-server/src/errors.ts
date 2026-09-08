/**
 * Kelas error HTTP bersama — dipakai semua service Fase 1 supaya bentuk respons error
 * seragam (`{ error: { type, message, detail? } }`), bukan diimprovisasi per service.
 */

export class HttpError extends Error {
  readonly statusCode: number;
  readonly type: string;
  readonly detail: Record<string, unknown> | undefined;

  constructor(
    statusCode: number,
    type: string,
    message: string,
    detail?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.type = type;
    this.detail = detail;
  }
}

export class BadRequestError extends HttpError {
  constructor(message: string, detail?: Record<string, unknown>) {
    super(400, "BAD_REQUEST", message, detail);
    this.name = "BadRequestError";
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = "Token otorisasi tidak ada atau salah.") {
    super(401, "UNAUTHORIZED", message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends HttpError {
  constructor(message: string, detail?: Record<string, unknown>) {
    super(403, "FORBIDDEN", message, detail);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends HttpError {
  constructor(message: string) {
    super(404, "NOT_FOUND", message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends HttpError {
  constructor(message: string, detail?: Record<string, unknown>) {
    super(409, "CONFLICT", message, detail);
    this.name = "ConflictError";
  }
}

/**
 * Upstream (provider AI, atau service ecorione lain) tidak bisa dihubungi atau menolak
 * kredensial. **Bukan** 500: kegagalan ini bukan bug di service ini, dan pemanggil harus
 * bisa membedakannya dari kesalahan internal (`docs/api-fase1.md` §Connect, §Hub —
 * "tidak ada fallback diam-diam").
 */
export class BadGatewayError extends HttpError {
  constructor(message: string, detail?: Record<string, unknown>) {
    super(502, "UPSTREAM_UNAVAILABLE", message, detail);
    this.name = "BadGatewayError";
  }
}

/**
 * Error dari pemanggilan service lain lewat `httpJson`. Membawa status & body mentah
 * supaya pemanggil bisa memutuskan sendiri apakah layak di-retry atau harus menyerah.
 */
export class RemoteServiceError extends Error {
  readonly statusCode: number;
  readonly body: unknown;
  readonly url: string;

  constructor(url: string, statusCode: number, body: unknown) {
    super(`Panggilan ke ${url} gagal dengan status ${String(statusCode)}`);
    this.name = "RemoteServiceError";
    this.statusCode = statusCode;
    this.body = body;
    this.url = url;
  }
}
