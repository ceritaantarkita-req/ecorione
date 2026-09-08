/**
 * Server Fastify bersama — dipakai `services/rnd`, `services/context`, `services/connect`,
 * `services/hub`. Satu tempat untuk hal yang harus seragam di semua service lokal: bind
 * 127.0.0.1 default, auth bearer token internal, request-id, dan bentuk error yang sama.
 *
 * **Bukan** stack auth remote penuh (RFC 9728 dkk, PRD §14) — itu untuk server MCP
 * (Connect inbound, Fase 2) yang benar-benar diakses lewat jaringan publik. Token bearer
 * di sini hanya untuk memisahkan "proses lain di mesin yang sama boleh manggil" dari
 * "port ini kebetulan kebuka" — pertahanan lapis kedua di belakang bind localhost.
 */

import { randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { HttpError, UnauthorizedError } from "./errors.js";

export interface CreateServerOptions {
  readonly name: string;
  /**
   * Token bearer internal. `undefined` menonaktifkan pengecekan auth — dipakai test dan
   * dev tanpa `.env` terisi. Produksi harus selalu mengisi ini lewat `ECORIONE_INTERNAL_TOKEN`.
   */
  readonly token?: string | undefined;
  readonly logger?: boolean | undefined;
}

declare module "fastify" {
  interface FastifyRequest {
    requestId: string;
  }
}

/**
 * Default host bind. **127.0.0.1 saja** — DNS rebinding terhadap service lokal yang
 * memegang memori/kredensial akan menyerahkan seluruh isinya ke halaman web mana pun
 * (PRD §14). Override eksplisit lewat `ECORIONE_ALLOW_REMOTE_BIND=1` untuk kasus
 * pengembangan lintas-device yang disengaja — tidak pernah default.
 */
export function bindHost(): string {
  return process.env.ECORIONE_ALLOW_REMOTE_BIND === "1" ? "0.0.0.0" : "127.0.0.1";
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
    if (req.url === "/healthz") return;
    if (options.token === undefined) return;

    const header = req.headers.authorization;
    const expected = `Bearer ${options.token}`;
    if (header !== expected) {
      const err = new UnauthorizedError();
      await reply.code(err.statusCode).send(errorBody(err));
      return reply;
    }
    return undefined;
  });

  app.get("/healthz", async () => ({ status: "ok", service: options.name }));

  app.setErrorHandler((err: unknown, req: FastifyRequest, reply: FastifyReply) => {
    if (err instanceof HttpError) {
      return reply.code(err.statusCode).send({ ...errorBody(err), requestId: req.requestId });
    }
    if (err instanceof ZodError) {
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
    }
    req.log.error({ err }, "unhandled error");
    return reply.code(500).send({
      error: { type: "INTERNAL", message: "Kesalahan internal service." },
      requestId: req.requestId,
    });
  });

  app.setNotFoundHandler((req: FastifyRequest, reply: FastifyReply) => {
    return reply.code(404).send({
      error: { type: "NOT_FOUND", message: `Route tidak ada: ${req.method} ${req.url}` },
      requestId: req.requestId,
    });
  });

  return app;
}

function errorBody(err: HttpError): Record<string, unknown> {
  const body: Record<string, unknown> = {
    error: { type: err.type, message: err.message },
  };
  if (err.detail !== undefined) {
    (body.error as Record<string, unknown>).detail = err.detail;
  }
  return body;
}
