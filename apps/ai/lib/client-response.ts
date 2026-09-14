type ErrorEnvelope = {
  error?: {
    code?: unknown;
    message?: unknown;
  };
};

function structuredError(payload: unknown): { code?: string; message?: string } {
  if (payload === null || typeof payload !== "object") return {};
  const error = (payload as ErrorEnvelope).error;
  if (error === undefined) return {};
  const code =
    typeof error.code === "string" && error.code.trim().length > 0
      ? error.code.trim()
      : undefined;
  const message =
    typeof error.message === "string" && error.message.trim().length > 0
      ? error.message.trim()
      : undefined;
  return {
    ...(code === undefined ? {} : { code }),
    ...(message === undefined ? {} : { message }),
  };
}

export class ClientResponseError extends Error {
  readonly code: string | undefined;
  readonly status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ClientResponseError";
    this.status = status;
    this.code = code;
  }
}

export async function readJson<T>(
  response: Response,
  fallbackMessage = "Layanan tidak dapat memproses permintaan. Coba lagi atau periksa status layanan.",
): Promise<T> {
  const text = await response.text();
  let body: unknown = null;

  if (text.length > 0) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    const error = structuredError(body);
    throw new ClientResponseError(
      error.message ?? fallbackMessage,
      response.status,
      error.code,
    );
  }

  return body as T;
}
