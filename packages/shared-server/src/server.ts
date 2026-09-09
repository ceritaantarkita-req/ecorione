/** Shared Fastify boundary for local services. */
import { randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { HttpError, UnauthorizedError } from "./errors.js";

export interface CreateServerOptions {
  readonly name: string;
  readonly token?: string | undefined;
  readonly logger?: boolean | undefined;
}
declare module "fastify" {
  interface FastifyRequest {
    requestId: string;
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
  const app = Fastify({ logger: options.logger ?? false });
  app.decorateRequest("requestId", "");
  app.addHook("onRequest", async (req: FastifyRequest) => {
    const incoming = req.headers["x-request-id"];
    req.requestId =
      typeof incoming === "string" && incoming.length > 0 ? incoming : randomUUID();
  });
  app.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.url === "/healthz" || options.token === undefined) return;
    if (req.headers.authorization !== `Bearer ${options.token}`) {
      const err = new UnauthorizedError();
      await reply.code(err.statusCode).send({ ...errorBody(err), requestId: req.requestId });
      return reply;
    }
  });
  app.get("/healthz", async () => ({ status: "ok", service: options.name }));
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
    return reply
      .code(500)
      .send({
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
