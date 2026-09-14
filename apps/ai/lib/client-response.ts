type ErrorEnvelope = {
  error?: {
    message?: unknown;
  };
};

function structuredErrorMessage(payload: unknown): string | undefined {
  if (payload === null || typeof payload !== "object") return undefined;
  const message = (payload as ErrorEnvelope).error?.message;
  return typeof message === "string" && message.trim().length > 0 ? message.trim() : undefined;
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
    throw new Error(structuredErrorMessage(body) ?? fallbackMessage);
  }

  return body as T;
}
