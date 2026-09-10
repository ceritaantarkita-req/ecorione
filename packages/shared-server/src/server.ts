/** Shared Fastify boundary for local services. */
import { randomUUID, timingSafeEqual } from "node:crypto";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { HttpError, UnauthorizedError } from "./errors.js";
import {
  OperationalMetrics,
  attachOperationalMetrics,
  requestTraceContext,
  runWithRequestTrace,
  traceparentFor,
} from "./observability.js";

export interface RateLimitOptions {
  readonly max: number;
  readonly windowMs: number;
}

export interface CreateServerOptions {
  readonly name: string;
  readonly token?: string | undefined;
  readonly logger?: boolean | undefined;
  /** Explicit per-service JSON/body ceiling; Fastify's default is too small for Artifact media. */
  readonly bodyLimit?: number | undefined;
  /** Bounded process-local defensive limiter. Set max=0 to disable explicitly. */
  readonly rateLimit?: RateLimitOptions | undefined;
}

declare module "fastify" {
  interface FastifyRequest {
    requestId: string;
    traceId: string;
    traceSpanId: string;
    observabilityStartedAt: number;
    observabilityStartedIso: string;
  }
}

interface RateState {
  windowStartedAt: number;
  hits: number;
}

const DEFAULT_RATE_LIMIT: RateLimitOptions = { max: 1_200, windowMs: 60_000 };
const MAX_RATE_KEYS = 4_096;
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export function bindHost(): string {
  return process.env.ECORIONE_ALLOW_REMOTE_BIND === "1" ? "0.0.0.0" : "127.0.0.1";
}

function errorBody(err: HttpError): Record<string, unknown> {
  const body: Record<string, unknown> = { error: { type: err.type, message: err.message } };
  if (err.detail !== undefined) (body.error as Record<string, unknown>).detail = err.detail;
  return body;
}

function bearerMatches(header: string | undefined, token: string): boolean {
  if (header === undefined) return false;
  const actual = Buffer.from(header, "utf8");
  const expected = Buffer.from(`Bearer ${token}`, "utf8");
  return actual.byteLength === expected.byteLength && timingSafeEqual(actual, expected);
}

function safeRequestId(value: string | string[] | undefined): string {
  return typeof value === "string" && SAFE_REQUEST_ID.test(value) ? value : randomUUID();
}

function validateRateLimit(input: RateLimitOptions): RateLimitOptions {
  if (!Number.isInteger(input.max) || input.max < 0 || input.max > 1_000_000) {
    throw new Error("rateLimit.max harus integer 0..1000000.");
  }
  if (!Number.isInteger(input.windowMs) || input.windowMs < 100 || input.windowMs > 3_600_000) {
    throw new Error("rateLimit.windowMs harus integer 100..3600000.");
  }
  return input;
}

export function createServer(options: CreateServerOptions): FastifyInstance {
  const app = Fastify({
    logger: options.logger ?? false,
    ...(options.bodyLimit === undefined ? {} : { bodyLimit: options.bodyLimit }),
  });
  const metrics = new OperationalMetrics(options.name);
  const rateLimit = validateRateLimit(options.rateLimit ?? DEFAULT_RATE_LIMIT);
  const rateStates = new Map<string, RateState>();
  attachOperationalMetrics(app, metrics);
  app.decorateRequest("requestId", "");
  app.decorateRequest("traceId", "");
  app.decorateRequest("traceSpanId", "");
  app.decorateRequest("observabilityStartedAt", 0);
  app.decorateRequest("observabilityStartedIso", "");

  app.addHook("onRequest", (req: FastifyRequest, reply: FastifyReply, done) => {
    req.requestId = safeRequestId(req.headers["x-request-id"]);
    const incomingTrace = req.headers.traceparent;
    const trace = requestTraceContext(
      typeof incomingTrace === "string" ? incomingTrace : undefined,
      req.requestId,
    );
    req.traceId = trace.traceId;
    req.traceSpanId = trace.spanId;
    req.observabilityStartedAt = performance.now();
    req.observabilityStartedIso = new Date().toISOString();
    reply.header("x-request-id", req.requestId);
    reply.header("x-ecorione-trace-id", trace.traceId);
    reply.header("traceparent", traceparentFor(trace));
    reply.header("x-content-type-options", "nosniff");
    reply.header("referrer-policy", "no-referrer");
    reply.header("cache-control", "no-store");
    runWithRequestTrace(trace, done);
  });

  app.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.url === "/healthz" || rateLimit.max === 0) return;
    const now = performance.now();
    const key = req.ip;
    let state = rateStates.get(key);
    if (state === undefined || now - state.windowStartedAt >= rateLimit.windowMs) {
      state = { windowStartedAt: now, hits: 0 };
      if (rateStates.size >= MAX_RATE_KEYS) {
        const oldest = rateStates.keys().next().value as string | undefined;
        if (oldest !== undefined) rateStates.delete(oldest);
      }
      rateStates.set(key, state);
    }
    state.hits += 1;
    if (state.hits <= rateLimit.max) return;
    metrics.addCounter("ecorione_http_rate_limited_total", 1, {
      service: options.name,
      route: req.routeOptions.url ?? req.url.split("?", 1)[0] ?? "unknown",
    });
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((rateLimit.windowMs - (now - state.windowStartedAt)) / 1_000),
    );
    await reply
      .code(429)
      .header("retry-after", String(retryAfterSeconds))
      .send({
        error: { type: "RATE_LIMITED", message: "Terlalu banyak request." },
        requestId: req.requestId,
      });
    return reply;
  });

  app.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.url === "/healthz" || options.token === undefined) return;
    const authorization = req.headers.authorization;
    if (!bearerMatches(typeof authorization === "string" ? authorization : undefined, options.token)) {
      const err = new UnauthorizedError();
      await reply.code(err.statusCode).send({ ...errorBody(err), requestId: req.requestId });
      return reply;
    }
  });

  app.addHook("onResponse", async (req: FastifyRequest, reply: FastifyReply) => {
    const durationMs = Math.max(0, performance.now() - req.observabilityStartedAt);
    const route = req.routeOptions.url ?? req.url.split("?", 1)[0] ?? "unknown";
    const labels = {
      service: options.name,
      method: req.method,
      route,
      status_class: `${Math.floor(reply.statusCode / 100)}xx`,
    };
    metrics.addCounter("ecorione_http_requests_total", 1, labels);
    if (reply.statusCode >= 400) {
      metrics.addCounter("ecorione_http_errors_total", 1, labels);
    }
    metrics.observe("ecorione_http_request_duration_ms", durationMs, {
      service: options.name,
      method: req.method,
      route,
    });
    metrics.recordRequest({
      traceId: req.traceId,
      spanId: req.traceSpanId,
      requestId: req.requestId,
      service: options.name,
      method: req.method,
      route,
      statusCode: reply.statusCode,
      durationMs,
      startedAt: req.observabilityStartedIso,
    });
  });

  app.get("/healthz", async () => ({ status: "ok", service: options.name }));
  if (options.token !== undefined) {
    app.get("/metrics", async (_req, reply) =>
      reply.type("text/plain; version=0.0.4; charset=utf-8").send(metrics.prometheus()),
    );
    app.get("/v1/ops/observability", async () => metrics.snapshot());
  }
  app.setErrorHandler((err: unknown, req: FastifyRequest, reply: FastifyReply) => {
    if (err instanceof HttpError)
      return reply.code(err.statusCode).send({ ...errorBody(err), requestId: req.requestId });
    if (err instanceof ZodError)
      return reply.code(400).send({
        error: {
          type: "BAD_REQUEST",
          message: "Input tidak valid.",
          detail: {
            issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
          },
        },
        requestId: req.requestId,
      });
    req.log.error({ err }, "unhandled error");
    return reply.code(500).send({
      error: { type: "INTERNAL", message: "Kesalahan internal service." },
      requestId: req.requestId,
    });
  });
  app.setNotFoundHandler((req, reply) =>
    reply.code(404).send({
      error: { type: "NOT_FOUND", message: `Route tidak ada: ${req.method} ${req.url}` },
      requestId: req.requestId,
    }),
  );
  return app;
}
