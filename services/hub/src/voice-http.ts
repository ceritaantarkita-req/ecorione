import {
  SessionIdSchema,
  VoiceAudioChunkRequestSchema,
  VoiceCloseRequestSchema,
  VoiceEventsQuerySchema,
  VoiceInterruptRequestSchema,
  VoiceSessionCreateRequestSchema,
} from "@ecorione/shared-schema";
import { ConflictError, NotFoundError, parseOrBadRequest } from "@ecorione/shared-server";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { RealtimeVoiceRuntime } from "./voice-runtime.js";
import {
  VoiceChunkConflictError,
  VoiceSessionConflictError,
  VoiceSessionNotFoundError,
} from "./voice-store.js";

const SessionParamsSchema = z.object({ sessionId: SessionIdSchema });

function mapVoiceError(error: unknown): never {
  if (error instanceof VoiceSessionNotFoundError) throw new NotFoundError(error.message);
  if (error instanceof VoiceSessionConflictError || error instanceof VoiceChunkConflictError) {
    throw new ConflictError(error.message);
  }
  throw error;
}

export function registerVoiceRoutes(app: FastifyInstance, runtime: RealtimeVoiceRuntime): void {
  app.post("/v1/voice/sessions", async (request, reply) => {
    const body = parseOrBadRequest(VoiceSessionCreateRequestSchema, request.body);
    try {
      return reply.code(201).send(runtime.create(body));
    } catch (error) {
      mapVoiceError(error);
    }
  });

  app.get<{ Params: { sessionId: string } }>(
    "/v1/voice/sessions/:sessionId",
    async (request) => {
      const params = parseOrBadRequest(SessionParamsSchema, request.params);
      try {
        return runtime.get(params.sessionId);
      } catch (error) {
        mapVoiceError(error);
      }
    },
  );

  app.post("/v1/voice/chunks", async (request) => {
    const body = parseOrBadRequest(VoiceAudioChunkRequestSchema, request.body);
    try {
      return await runtime.acceptChunk(body);
    } catch (error) {
      mapVoiceError(error);
    }
  });

  app.post("/v1/voice/interrupt", async (request) => {
    const body = parseOrBadRequest(VoiceInterruptRequestSchema, request.body);
    try {
      return runtime.interrupt(body);
    } catch (error) {
      mapVoiceError(error);
    }
  });

  app.post("/v1/voice/close", async (request) => {
    const body = parseOrBadRequest(VoiceCloseRequestSchema, request.body);
    try {
      return runtime.close(body);
    } catch (error) {
      mapVoiceError(error);
    }
  });

  app.get("/v1/voice/events", async (request) => {
    const query = parseOrBadRequest(VoiceEventsQuerySchema, request.query);
    try {
      return runtime.events(query.sessionId, query.after);
    } catch (error) {
      mapVoiceError(error);
    }
  });

  app.get("/v1/voice/stream", async (request, reply) => {
    const query = parseOrBadRequest(VoiceEventsQuerySchema, request.query);
    try {
      runtime.get(query.sessionId);
    } catch (error) {
      mapVoiceError(error);
    }

    reply.hijack();
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });

    let cursor = query.after;
    let closed = false;
    const send = (
      event: ReturnType<RealtimeVoiceRuntime["events"]>["events"][number],
    ): void => {
      if (closed || event.sequence <= cursor) return;
      cursor = event.sequence;
      reply.raw.write(`id: ${String(event.sequence)}\ndata: ${JSON.stringify(event)}\n\n`);
    };
    const finishIfTerminal = (): void => {
      if (closed) return;
      const state = runtime.get(query.sessionId).state;
      if (state === "CLOSED" || state === "FAILED") {
        closed = true;
        reply.raw.end();
      }
    };

    const unsubscribe = runtime.subscribe(query.sessionId, (event) => {
      send(event);
      finishIfTerminal();
    });
    for (const event of runtime.events(query.sessionId, query.after).events) send(event);
    finishIfTerminal();

    const heartbeat = setInterval(() => {
      if (!closed) reply.raw.write(": keepalive\n\n");
    }, 15_000);
    const cleanup = (): void => {
      if (!closed) closed = true;
      clearInterval(heartbeat);
      unsubscribe();
    };
    request.raw.once("close", cleanup);
    reply.raw.once("close", cleanup);
  });
}
