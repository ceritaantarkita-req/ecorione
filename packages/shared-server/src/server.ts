/** Shared Fastify boundary for local services. */
import { randomUUID } from "node:crypto";
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

export interface CreateServerOptions {
  readonly name: string;
  readonly token?: string | undefined;
  readonly logger?: boolean | undefined;
  /** Explicit per-service JSON/body ceiling; Fastify's default is too small for Artifact media. */
  readonly bodyLimit?: number | undefined;
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
export function bindHost(): string {
  return process.env.ECORIONE_ALLOW_REMOTE_BIND === "1" ? "0.0.0.0" : "127.0.0.1";
}
function errorBody(err: HttpError): Record<string, unknown> {
  const body: Record<string, unknown> = { error: { type: err.type, message: err.message } };
  if (err.detail !== undefined) (body.error as Record<string, unknown>).detail = err.detail;
  return body;
}
export function createServer(options: CreateServerOptions): FastifyInstance {
  const app = Fastify({
    logger: options.logger ?? false,
    ...(options.bodyLimit === undefined ? {} : { bodyLimit: options.bodyLimit }),
  });
  const metrics = new OperationalMetrics(options.name);
  attachOperationalMetrics(app, metrics);
  app.decorateRequest("requestId", "");
  app.decorateRequest("traceId", "");
  app.decorateRequest("traceSpanId", "");
  app.decorateRequest("observabilityStartedAt", 0);
  app.decorateRequest("observabilityStartedIso", "");
  app.addHook("onRequest", (req: FastifyRequest, reply: FastifyReply, done) => {
    const incoming = req.headers["x-request-id"];
    req.requestId =
      typeof incoming === "string" && incoming.length > 0 && incoming.length <= 128
        ? incoming
        : randomUUID();
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
    runWithRequestTrace(trace, done);
  });
  app.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.url === "/healthz" || options.token === undefined) return;
    if (req.headers.authorization !== `Bearer ${options.token}`) {
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
