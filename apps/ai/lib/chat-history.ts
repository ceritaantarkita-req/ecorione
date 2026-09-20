import type { ChatCost, HistoryEvent, MemoryUsed } from "@ecorione/shared-schema";

export interface UserChatTurn {
  readonly kind: "user";
  readonly id: string;
  readonly text: string;
}

export interface AssistantChatTurn {
  readonly kind: "assistant";
  readonly id: string;
  readonly operationId: string | null;
  readonly reply: string;
  readonly cost?: ChatCost | undefined;
  readonly memoryUsed?: MemoryUsed | undefined;
}

export interface ErrorChatTurn {
  readonly kind: "error";
  readonly id: string;
  readonly message: string;
}

export type ChatTurn = UserChatTurn | AssistantChatTurn | ErrorChatTurn;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function textPayload(event: HistoryEvent): string | null {
  const payload = asRecord(event.payload);
  const text = payload?.text;
  return typeof text === "string" && text.length > 0 ? text : null;
}

function replayCost(event: HistoryEvent | undefined): ChatCost | undefined {
  if (event?.eventType !== "model.called") return undefined;
  const payload = asRecord(event.payload);
  if (payload === null) return undefined;
  const model =
    typeof payload.responseModel === "string"
      ? payload.responseModel
      : typeof payload.requestModel === "string"
        ? payload.requestModel
        : undefined;
  const actualUsd = payload.actualUsd;
  const naiveUsd = payload.naiveUsd;
  const cacheHit = payload.cacheHit;
  const routeReason = payload.routeReason;
  if (
    model === undefined ||
    typeof actualUsd !== "number" ||
    typeof naiveUsd !== "number" ||
    typeof cacheHit !== "boolean" ||
    typeof routeReason !== "string"
  ) {
    return undefined;
  }
  const savedUsd = Math.max(0, naiveUsd - actualUsd);
  return {
    model,
    cacheHit,
    actualUsd,
    naiveUsd,
    savedUsd,
    savedPct: naiveUsd > 0 ? (savedUsd / naiveUsd) * 100 : 0,
    routeReason,
  };
}

/**
 * Historical Ledger is the canonical replay source. Only conversational events
 * become chat bubbles; operational/tool events remain available in the Ledger
 * but are intentionally not projected into the basic conversation UI.
 */
export function historyEventsToTurns(events: readonly HistoryEvent[]): ChatTurn[] {
  const byId = new Map(events.map((event) => [event.id, event] as const));
  const turns: ChatTurn[] = [];

  for (const event of events) {
    if (event.eventType === "user.message") {
      const text = textPayload(event);
      if (text !== null) turns.push({ kind: "user", id: event.id, text });
      continue;
    }
    if (event.eventType === "agent.message") {
      const reply = textPayload(event);
      if (reply === null) continue;
      const parent = event.parentEventId === null ? undefined : byId.get(event.parentEventId);
      const cost = replayCost(parent);
      turns.push({
        kind: "assistant",
        id: event.id,
        operationId: event.operationId,
        reply,
        ...(cost === undefined ? {} : { cost }),
      });
    }
  }
  return turns;
}
