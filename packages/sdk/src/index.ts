export interface EcorioneSdkOptions {
  readonly token?: string;
  readonly contextUrl?: string;
  readonly connectUrl?: string;
  readonly flowUrl?: string;
  readonly artifactUrl?: string;
}

export interface FlowRunInput {
  readonly operationId: string;
  readonly input?: unknown;
}

async function request<T>(
  base: string,
  path: string,
  token: string | undefined,
  init?: RequestInit,
): Promise<T> {
  const url = new URL(path, base.endsWith("/") ? base : `${base}/`);
  if (!new Set(["http:", "https:"]).has(url.protocol))
    throw new Error("SDK base URL harus HTTP/HTTPS.");
  const headers = new Headers(init?.headers);
  if (token !== undefined) headers.set("authorization", `Bearer ${token}`);
  if (init?.body !== undefined) headers.set("content-type", "application/json");
  const response = await fetch(url, { ...init, headers, redirect: "error" });
  const text = await response.text();
  if (!response.ok)
    throw new Error(`ECORIONE HTTP ${String(response.status)}: ${text.slice(0, 512)}`);
  return (text.length === 0 ? undefined : JSON.parse(text)) as T;
}

export class EcorioneSdk {
  readonly #token: string | undefined;
  readonly #contextUrl: string;
  readonly #connectUrl: string;
  readonly #flowUrl: string;
  readonly #artifactUrl: string;

  constructor(options: EcorioneSdkOptions = {}) {
    this.#token = options.token;
    this.#contextUrl = options.contextUrl ?? "http://127.0.0.1:17022";
    this.#connectUrl = options.connectUrl ?? "http://127.0.0.1:17023";
    this.#flowUrl = options.flowUrl ?? "http://127.0.0.1:17028";
    this.#artifactUrl = options.artifactUrl ?? "http://127.0.0.1:17025";
  }

  health(
    service: "context" | "connect" | "flow" | "artifact",
  ): Promise<{ status: string; service: string }> {
    const base =
      service === "context"
        ? this.#contextUrl
        : service === "connect"
          ? this.#connectUrl
          : service === "flow"
            ? this.#flowUrl
            : this.#artifactUrl;
    return request(base, "/healthz", undefined);
  }

  retrieve<T = unknown>(body: unknown): Promise<T> {
    return request(this.#contextUrl, "/v1/retrieve", this.#token, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  complete<T = unknown>(body: unknown): Promise<T> {
    return request(this.#connectUrl, "/v1/complete", this.#token, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  runGraph<T = unknown>(graphId: string, body: FlowRunInput): Promise<T> {
    return request(
      this.#flowUrl,
      `/v1/graphs/${encodeURIComponent(graphId)}/runs`,
      this.#token,
      { method: "POST", body: JSON.stringify(body) },
    );
  }

  async artifactContent(
    artifactId: string,
    query: { scope: string; maxSensitivity: string },
  ): Promise<Uint8Array> {
    const url = new URL(
      `/v1/artifacts/${encodeURIComponent(artifactId)}/content`,
      this.#artifactUrl,
    );
    url.searchParams.set("scope", query.scope);
    url.searchParams.set("maxSensitivity", query.maxSensitivity);
    const headers = new Headers();
    if (this.#token !== undefined) headers.set("authorization", `Bearer ${this.#token}`);
    const response = await fetch(url, { headers, redirect: "error" });
    if (!response.ok) throw new Error(`ECORIONE Artifact HTTP ${String(response.status)}`);
    return new Uint8Array(await response.arrayBuffer());
  }
}
