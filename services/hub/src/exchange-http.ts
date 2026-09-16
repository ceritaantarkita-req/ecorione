import {
  EcxHydrateRequestSchema,
  EcxHydrateResponseSchema,
  EcxPlanRequestSchema,
  EcxPlanResponseSchema,
  type ArtifactPointer,
  type EcxHydratedItem,
  type EcxPacket,
  type EcxReference,
  type HistoryEventDraft,
  type MemoryFact,
} from "@ecorione/shared-schema";
import {
  BadGatewayError,
  BadRequestError,
  HttpError,
  NotFoundError,
  RemoteServiceError,
  httpJson,
  observabilityFor,
  outgoingTraceHeaders,
  parseOrBadRequest,
} from "@ecorione/shared-server";
import type { FastifyInstance } from "fastify";
import { planEcx } from "./exchange.js";
import { selectEcxReferenceIndexes, type EcxReferenceDescriptor } from "./exchange-selector.js";
import {
  HistoryAccessDeniedError,
  HistoryIntegrityError,
  type HistoryLedger,
  HistorySessionNotFoundError,
} from "./history-ledger.js";

export interface ExchangeRouteOptions {
  readonly contextUrl: string;
  readonly artifactUrl: string;
  readonly internalToken?: string | undefined;
}

const AUTO_SELECTOR_MAX_TEXT_ARTIFACT_BYTES = 64 * 1024;
const AUTO_SELECTOR_MAX_DESCRIPTOR_CHARS = 96 * 1024;

function encodeJson(value: unknown): {
  mediaType: string;
  contentBase64: string;
  sizeBytes: number;
} {
  const bytes = Buffer.from(JSON.stringify(value), "utf8");
  return {
    mediaType: "application/json",
    contentBase64: bytes.toString("base64"),
    sizeBytes: bytes.byteLength,
  };
}

function assertBudget(used: number, next: number, max: number): void {
  if (used + next > max) {
    throw new HttpError(
      413,
      "ECX_HYDRATION_BUDGET_EXCEEDED",
      `Hydration ${String(used + next)} byte melewati budget ${String(max)} byte.`,
    );
  }
}

function mapOwnerError(service: string, error: unknown): unknown {
  if (error instanceof RemoteServiceError) {
    if (error.statusCode === 404 || error.statusCode === 403) {
      return new NotFoundError("Reference tidak tersedia untuk grant ini.");
    }
    if (error.statusCode >= 400 && error.statusCode < 500) {
      return new BadRequestError(`Reference ditolak ${service}.`);
    }
  }
  return new BadGatewayError(`${service} tidak tersedia untuk ECX hydration.`);
}

function selectorGrant(input: {
  scope: string;
  maxSensitivity: string;
  hostedEligible: boolean;
}) {
  return {
    scope: input.scope,
    maxSensitivity: input.maxSensitivity,
    hostedEligible: input.hostedEligible,
  };
}

function truncateSelectorText(value: string): string {
  return value.slice(0, AUTO_SELECTOR_MAX_DESCRIPTOR_CHARS);
}

function isSelectorTextArtifact(pointer: ArtifactPointer): boolean {
  const mimeType = pointer.mimeType.toLowerCase();
  return (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "application/xml" ||
    mimeType.endsWith("+json") ||
    mimeType.endsWith("+xml")
  );
}

async function readArtifactSelectorText(
  ref: Extract<EcxReference, { kind: "artifact" }>,
  input: {
    scope: string;
    maxSensitivity: string;
    hostedEligible: boolean;
    contextUrl: string;
    artifactUrl: string;
    token?: string | undefined;
  },
): Promise<string> {
  const authorizeUrl = new URL(
    `${input.contextUrl}/v1/artifacts/${ref.artifactId}/authorize`,
  );
  authorizeUrl.searchParams.set("scope", input.scope);
  authorizeUrl.searchParams.set("maxSensitivity", input.maxSensitivity);
  authorizeUrl.searchParams.set("hostedEligible", input.hostedEligible ? "1" : "0");

  let pointer: ArtifactPointer;
  try {
    pointer = await httpJson<ArtifactPointer>(authorizeUrl.toString(), {
      token: input.token,
    });
  } catch (error) {
    throw mapOwnerError("Context", error);
  }

  const metadata = [pointer.description, pointer.path, pointer.mimeType].join("\n");
  if (
    !isSelectorTextArtifact(pointer) ||
    pointer.sizeBytes > AUTO_SELECTOR_MAX_TEXT_ARTIFACT_BYTES
  ) {
    return truncateSelectorText(metadata);
  }

  const contentUrl = new URL(`${input.artifactUrl}/v1/artifacts/${ref.artifactId}/content`);
  contentUrl.searchParams.set("scope", input.scope);
  contentUrl.searchParams.set("maxSensitivity", input.maxSensitivity);
  contentUrl.searchParams.set("hostedEligible", input.hostedEligible ? "1" : "0");
  const headers = new Headers(outgoingTraceHeaders());
  if (input.token !== undefined) headers.set("authorization", `Bearer ${input.token}`);

  let response: Response;
  try {
    response = await fetch(contentUrl, { headers });
  } catch (error) {
    throw new BadGatewayError(
      `Artifact selector preview tidak tersedia: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!response.ok) {
    if (response.status === 404 || response.status === 403) {
      throw new NotFoundError("Artifact reference tidak tersedia untuk grant ini.");
    }
    throw new BadGatewayError(
      `Artifact selector preview gagal dengan HTTP ${String(response.status)}.`,
    );
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > AUTO_SELECTOR_MAX_TEXT_ARTIFACT_BYTES) {
    throw new BadGatewayError("Artifact selector preview melewati bounded scan limit.");
  }
  return truncateSelectorText(`${metadata}\n${bytes.toString("utf8")}`);
}

async function buildSelectionDescriptors(
  packet: EcxPacket,
  ledger: HistoryLedger,
  input: {
    scope: string;
    maxSensitivity: string;
    hostedEligible: boolean;
    contextUrl: string;
    artifactUrl: string;
    token?: string | undefined;
  },
): Promise<EcxReferenceDescriptor[]> {
  const descriptors: EcxReferenceDescriptor[] = [];
  for (let index = 0; index < packet.refs.length; index += 1) {
    const ref = packet.refs[index]!;
    if (ref.kind === "history") {
      try {
        const range = ledger.readRange({
          sessionId: ref.sessionId,
          afterSeq: ref.afterSeq,
          throughSeq: ref.throughSeq,
          limit: Math.min(500, ref.throughSeq - ref.afterSeq),
          grant: selectorGrant(input),
        });
        descriptors.push({
          index,
          text: truncateSelectorText(
            JSON.stringify(
              range.events.map((event) => ({
                eventType: event.eventType,
                actor: event.actor,
                payload: event.payload,
              })),
            ),
          ),
        });
      } catch (error) {
        if (
          error instanceof HistorySessionNotFoundError ||
          error instanceof HistoryAccessDeniedError
        ) {
          throw new NotFoundError("History reference tidak tersedia untuk grant ini.");
        }
        if (error instanceof HistoryIntegrityError) {
          throw new HttpError(500, "HISTORY_INTEGRITY_ERROR", error.message);
        }
        throw error;
      }
    } else if (ref.kind === "memoryFact") {
      const url = new URL(`${input.contextUrl}/v1/access/facts/${ref.factId}`);
      url.searchParams.set("scope", input.scope);
      url.searchParams.set("maxSensitivity", input.maxSensitivity);
      url.searchParams.set("hostedEligible", input.hostedEligible ? "1" : "0");
      try {
        const fact = await httpJson<MemoryFact>(url.toString(), { token: input.token });
        descriptors.push({
          index,
          text: truncateSelectorText(
            [fact.subject, fact.predicate, fact.object, fact.text].join("\n"),
          ),
        });
      } catch (error) {
        throw mapOwnerError("Context", error);
      }
    } else {
      descriptors.push({
        index,
        text: await readArtifactSelectorText(ref, input),
      });
    }
  }
  return descriptors;
}

async function hydrateArtifact(
  ref: Extract<EcxReference, { kind: "artifact" }>,
  input: {
    scope: string;
    maxSensitivity: string;
    hostedEligible: boolean;
    artifactUrl: string;
    token?: string | undefined;
    remainingBytes: number;
  },
): Promise<Omit<EcxHydratedItem, "index" | "ref">> {
  const url = new URL(`${input.artifactUrl}/v1/artifacts/${ref.artifactId}/content`);
  url.searchParams.set("scope", input.scope);
  url.searchParams.set("maxSensitivity", input.maxSensitivity);
  url.searchParams.set("hostedEligible", input.hostedEligible ? "1" : "0");
  const headers = new Headers(outgoingTraceHeaders());
  if (input.token !== undefined) headers.set("authorization", `Bearer ${input.token}`);
  let response: Response;
  try {
    response = await fetch(url, { headers });
  } catch (error) {
    throw new BadGatewayError(
      `Artifact tidak tersedia: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!response.ok) {
    if (response.status === 404 || response.status === 403) {
      throw new NotFoundError("Artifact reference tidak tersedia untuk grant ini.");
    }
    throw new BadGatewayError(
      `Artifact hydration gagal dengan HTTP ${String(response.status)}.`,
    );
  }
  const declared = response.headers.get("content-length");
  if (declared !== null) {
    const size = Number(declared);
    if (Number.isFinite(size) && size > input.remainingBytes) {
      await response.body?.cancel();
      throw new HttpError(
        413,
        "ECX_HYDRATION_BUDGET_EXCEEDED",
        `Artifact ${ref.artifactId} melewati sisa hydration budget.`,
      );
    }
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > input.remainingBytes) {
    throw new HttpError(
      413,
      "ECX_HYDRATION_BUDGET_EXCEEDED",
      `Artifact ${ref.artifactId} melewati sisa hydration budget.`,
    );
  }
  return {
    mediaType: response.headers.get("content-type") ?? "application/octet-stream",
    contentBase64: bytes.toString("base64"),
    sizeBytes: bytes.byteLength,
  };
}

export function registerExchangeRoutes(
  app: FastifyInstance,
  ledger: HistoryLedger,
  options: ExchangeRouteOptions,
): void {
  const metrics = observabilityFor(app);
  app.post("/v1/exchange/plan", async (req) => {
    const input = parseOrBadRequest(EcxPlanRequestSchema, req.body);
    const response = planEcx(input);
    if (input.historySessionId !== undefined) {
      try {
        const events = response.packets.map<HistoryEventDraft>((packet) => ({
          id: packet.packetId,
          recordedAt: input.requestedAt,
          eventType: "agent.handoff",
          actor: "hub:exchange",
          operationId: input.operationId,
          parentEventId: null,
          payload: {
            sender: packet.sender,
            recipient: packet.recipient,
            intent: packet.intent,
            task: packet.task,
            need: packet.need,
            refs: packet.refs,
            budget: packet.budget,
            responseMode: packet.responseMode,
          },
        }));
        ledger.appendBatch(input.historySessionId, events);
      } catch (error) {
        if (error instanceof HistorySessionNotFoundError) {
          throw new NotFoundError("History session ECX tidak ditemukan.");
        }
        if (error instanceof HistoryIntegrityError) {
          throw new HttpError(500, "HISTORY_INTEGRITY_ERROR", error.message);
        }
        throw error;
      }
    }
    metrics.addCounter("ecorione_ecx_plans_total");
    metrics.addCounter("ecorione_ecx_candidates_total", response.metrics.candidateCount);
    metrics.addCounter("ecorione_ecx_packets_total", response.metrics.recipientCount);
    metrics.addCounter("ecorione_ecx_packet_bytes_total", response.metrics.packetBytes);
    return EcxPlanResponseSchema.parse(response);
  });

  app.post("/v1/exchange/hydrate", async (req) => {
    const input = parseOrBadRequest(EcxHydrateRequestSchema, req.body);
    let refIndexes: number[];
    if (input.refIndexes !== undefined) {
      refIndexes = input.refIndexes;
    } else {
      const selection = input.selection;
      if (selection === undefined) {
        throw new BadRequestError("ECX hydration membutuhkan refIndexes atau selection.");
      }
      const descriptors = await buildSelectionDescriptors(input.packet, ledger, {
        scope: input.scope,
        maxSensitivity: input.maxSensitivity,
        hostedEligible: input.hostedEligible,
        contextUrl: options.contextUrl,
        artifactUrl: options.artifactUrl,
        token: options.internalToken,
      });
      refIndexes = selectEcxReferenceIndexes(input.packet, descriptors, {
        maxRefs: selection.maxRefs,
      });
      metrics.addCounter("ecorione_ecx_auto_selections_total");
      metrics.addCounter("ecorione_ecx_auto_selection_candidates_total", descriptors.length);
      metrics.addCounter("ecorione_ecx_auto_selected_refs_total", refIndexes.length);
    }

    const items: EcxHydratedItem[] = [];
    let hydratedBytes = 0;
    for (const index of refIndexes) {
      const ref = input.packet.refs[index];
      if (ref === undefined)
        throw new BadRequestError(`ECX ref index tidak ada: ${String(index)}.`);
      let content: Omit<EcxHydratedItem, "index" | "ref">;
      if (ref.kind === "history") {
        try {
          const range = ledger.readRange({
            sessionId: ref.sessionId,
            afterSeq: ref.afterSeq,
            throughSeq: ref.throughSeq,
            limit: Math.min(500, ref.throughSeq - ref.afterSeq),
            grant: {
              scope: input.scope,
              maxSensitivity: input.maxSensitivity,
              hostedEligible: input.hostedEligible,
            },
          });
          content = encodeJson(range);
        } catch (error) {
          if (
            error instanceof HistorySessionNotFoundError ||
            error instanceof HistoryAccessDeniedError
          ) {
            throw new NotFoundError("History reference tidak tersedia untuk grant ini.");
          }
          if (error instanceof HistoryIntegrityError) {
            throw new HttpError(500, "HISTORY_INTEGRITY_ERROR", error.message);
          }
          throw error;
        }
      } else if (ref.kind === "memoryFact") {
        const url = new URL(`${options.contextUrl}/v1/access/facts/${ref.factId}`);
        url.searchParams.set("scope", input.scope);
        url.searchParams.set("maxSensitivity", input.maxSensitivity);
        url.searchParams.set("hostedEligible", input.hostedEligible ? "1" : "0");
        try {
          const fact = await httpJson<MemoryFact>(url.toString(), {
            token: options.internalToken,
          });
          content = encodeJson(fact);
        } catch (error) {
          throw mapOwnerError("Context", error);
        }
      } else {
        content = await hydrateArtifact(ref, {
          scope: input.scope,
          maxSensitivity: input.maxSensitivity,
          hostedEligible: input.hostedEligible,
          artifactUrl: options.artifactUrl,
          token: options.internalToken,
          remainingBytes: input.packet.budget.maxHydratedBytes - hydratedBytes,
        });
      }
      assertBudget(hydratedBytes, content.sizeBytes, input.packet.budget.maxHydratedBytes);
      hydratedBytes += content.sizeBytes;
      items.push({ index, ref, ...content });
    }
    metrics.addCounter("ecorione_ecx_hydrations_total");
    metrics.addCounter("ecorione_ecx_hydrated_items_total", items.length);
    metrics.addCounter("ecorione_ecx_hydration_bytes_total", hydratedBytes);
    return EcxHydrateResponseSchema.parse({
      packetId: input.packet.packetId,
      hydratedBytes,
      items,
    });
  });
}
