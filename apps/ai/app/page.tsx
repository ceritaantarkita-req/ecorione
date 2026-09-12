"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import type { ChatCost, ChatResponse, MemoryUsed } from "@ecorione/shared-schema";
import { makeSessionId } from "../lib/session";

type ChatTarget = "local" | "hosted";
type RuntimeSnapshot = {
  settings?: {
    hostedCallsEnabled?: boolean;
  };
};
interface UserTurn {
  kind: "user";
  id: string;
  text: string;
}
interface AssistantTurn {
  kind: "assistant";
  id: string;
  operationId: string;
  reply: string;
  cost: ChatCost;
  memoryUsed: MemoryUsed;
}
interface ErrorTurn {
  kind: "error";
  id: string;
  message: string;
}
type Turn = UserTurn | AssistantTurn | ErrorTurn;
let turnCounter = 0;
function nextTurnId(): string {
  turnCounter += 1;
  return `turn-${turnCounter}`;
}
function formatUsd(value: number): string {
  return `$${value.toFixed(4)}`;
}
/** shared-telemetry already returns 0..100. */
function formatPct(value: number): string {
  return `${value.toFixed(0)}%`;
}

const subscribeHydration = (): (() => void) => () => undefined;
const getClientHydrationSnapshot = (): boolean => true;
const getServerHydrationSnapshot = (): boolean => false;

export default function ChatPage() {
  const [sessionId] = useState<string>(() => makeSessionId());
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  );
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [target, setTarget] = useState<ChatTarget>("local");
  const [hostedAvailable, setHostedAvailable] = useState<boolean | null>(null);
  const [sending, setSending] = useState(false);
  const [forgettingId, setForgettingId] = useState<string | null>(null);
  const sendInFlightRef = useRef(false);
  const forgetInFlightRef = useRef<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const latestAssistant = [...turns]
    .reverse()
    .find((t): t is AssistantTurn => t.kind === "assistant");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/settings/settings/runtime", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
        return (await response.json()) as RuntimeSnapshot;
      })
      .then((snapshot) => {
        if (!cancelled) setHostedAvailable(snapshot.settings?.hostedCallsEnabled === true);
      })
      .catch(() => {
        if (!cancelled) setHostedAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated || turns.length === 0) return;
    threadEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [hydrated, sending, turns.length]);

  async function sendMessage(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!hydrated || trimmed.length === 0 || sending || sendInFlightRef.current) return;
    if (target === "hosted" && hostedAvailable !== true) {
      setTurns((prev) => [
        ...prev,
        {
          kind: "error",
          id: nextTurnId(),
          message: "Hosted route sedang dinonaktifkan. Gunakan Local untuk sesi ini.",
        },
      ]);
      return;
    }
    sendInFlightRef.current = true;
    setTurns((prev) => [...prev, { kind: "user", id: nextTurnId(), text: trimmed }]);
    setDraft("");
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, message: trimmed, target }),
      });
      const body: unknown = await res.json().catch(() => undefined);
      if (!res.ok) {
        setTurns((prev) => [
          ...prev,
          {
            kind: "error",
            id: nextTurnId(),
            message: extractErrorMessage(body) ?? `Hub membalas status ${res.status}.`,
          },
        ]);
        return;
      }
      const chat = body as ChatResponse;
      setTurns((prev) => [
        ...prev,
        {
          kind: "assistant",
          id: nextTurnId(),
          operationId: chat.operationId,
          reply: chat.reply,
          cost: chat.cost,
          memoryUsed: chat.memoryUsed,
        },
      ]);
    } catch {
      setTurns((prev) => [
        ...prev,
        { kind: "error", id: nextTurnId(), message: "Tidak bisa menghubungi server." },
      ]);
    } finally {
      sendInFlightRef.current = false;
      setSending(false);
    }
  }

  async function forgetFact(factId: string): Promise<void> {
    if (forgettingId !== null || forgetInFlightRef.current !== null) return;
    forgetInFlightRef.current = factId;
    setForgettingId(factId);
    try {
      const res = await fetch("/api/forget", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ factId }),
      });
      const body: unknown = await res.json().catch(() => undefined);
      if (!res.ok) {
        setTurns((prev) => [
          ...prev,
          {
            kind: "error",
            id: nextTurnId(),
            message: extractErrorMessage(body) ?? `Gagal melupakan fakta (${res.status}).`,
          },
        ]);
        return;
      }
      setTurns((prev) =>
        prev.map((t) =>
          t.kind === "assistant"
            ? {
                ...t,
                memoryUsed: {
                  ...t.memoryUsed,
                  recalledFacts: t.memoryUsed.recalledFacts.filter((f) => f.id !== factId),
                },
              }
            : t,
        ),
      );
    } catch {
      setTurns((prev) => [
        ...prev,
        {
          kind: "error",
          id: nextTurnId(),
          message: "Tidak bisa menghubungi server untuk melupakan fakta.",
        },
      ]);
    } finally {
      forgetInFlightRef.current = null;
      setForgettingId(null);
    }
  }
  function handleSubmit(e: FormEvent): void {
    e.preventDefault();
    void sendMessage(draft);
  }
  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(draft);
    }
  }

  const routeHint =
    turns.length > 0
      ? "Pilihan dikunci setelah pesan pertama agar boundary sesi tidak berubah diam-diam."
      : hostedAvailable === null
        ? "Memeriksa ketersediaan Hosted. Local tetap aman digunakan."
        : hostedAvailable
          ? "Pilih route sebelum pesan pertama; route akan dikunci untuk sesi ini."
          : "Hosted sedang dinonaktifkan oleh operator/runtime. Sesi ini Local-only.";

  return (
    <div className="ai-shell">
      <header className="ai-topbar">
        <div className="ai-topbar__copy">
          <h1 className="ai-topbar__title">ecorione — Ai</h1>
          <p className="ai-topbar__lead">
            Local-first chat with visible routing, memory, and cost.
          </p>
        </div>
        <span className="ai-topbar__session" title={hydrated ? sessionId : "sess_pending"}>
          {hydrated ? sessionId : "sess_pending"}
        </span>
      </header>
      <main className="ai-main">
        <section className="ai-conversation" aria-label="Conversation">
          <div className="ai-thread" aria-live="polite">
            {turns.length === 0 ? (
              <p className="ai-empty">
                Mulai percakapan. Routing, biaya, dan memori yang benar-benar dipakai akan tetap
                terlihat setelah setiap balasan.
              </p>
            ) : (
              turns.map((turn) => <TurnView key={turn.id} turn={turn} />)
            )}
            {sending ? (
              <div className="ai-turn ai-turn--assistant">
                <div className="ai-bubble">Menunggu balasan…</div>
              </div>
            ) : null}
            <div ref={threadEndRef} aria-hidden="true" />
          </div>
          <div className="ai-route-control">
            <label className="ai-route-control__label" htmlFor="chat-target">
              Route
            </label>
            <select
              id="chat-target"
              className="ecr-input ai-route-control__select"
              value={target}
              onChange={(e) => setTarget(e.target.value as ChatTarget)}
              disabled={!hydrated || sending || turns.length > 0}
            >
              <option value="local">Local</option>
              <option value="hosted" disabled={hostedAvailable !== true}>
                {hostedAvailable === true ? "Hosted" : "Hosted — off"}
              </option>
            </select>
            <span className="ai-route-control__hint">{routeHint}</span>
          </div>
          <form className="ai-composer" onSubmit={handleSubmit}>
            <textarea
              className="ai-composer__field"
              placeholder="Tulis pesan… (Enter untuk kirim, Shift+Enter baris baru)"
              aria-label="Pesan"
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!hydrated || sending}
            />
            <button
              type="submit"
              className="ecr-btn ecr-btn--primary"
              disabled={!hydrated || sending || draft.trim().length === 0}
            >
              Kirim
            </button>
          </form>
        </section>
        <aside className="ai-panel" aria-label="Memory used">
          <div className="ai-panel__title">Memori yang dipakai</div>
          {latestAssistant === undefined ? (
            <p className="ai-panel__empty">
              Belum ada balasan — panel terisi setelah giliran pertama.
            </p>
          ) : (
            <MemoryPanel
              memoryUsed={latestAssistant.memoryUsed}
              onForget={forgetFact}
              forgettingId={forgettingId}
            />
          )}
        </aside>
      </main>
    </div>
  );
}

function TurnView({ turn }: { turn: Turn }) {
  if (turn.kind === "user")
    return (
      <div className="ai-turn ai-turn--user">
        <div className="ai-bubble">{turn.text}</div>
      </div>
    );
  if (turn.kind === "error")
    return (
      <div className="ai-turn ai-turn--assistant" role="alert">
        <div className="ai-bubble ai-bubble--error">{turn.message}</div>
      </div>
    );
  return (
    <div className="ai-turn ai-turn--assistant">
      <div className="ai-bubble">{turn.reply}</div>
      <RoutingLine cost={turn.cost} />
    </div>
  );
}
function RoutingLine({ cost }: { cost: ChatCost }) {
  return (
    <div className="ai-routing">
      <span>
        Model: <span className="ai-routing__model">{cost.model}</span>
      </span>
      <span>·</span>
      <span>{cost.cacheHit ? "cache hit" : "cache miss"}</span>
      <span>·</span>
      <span>{formatUsd(cost.actualUsd)}</span>
      {cost.savedUsd > 0 ? (
        <>
          <span>·</span>
          <span className="ai-routing__savings">
            hemat {formatUsd(cost.savedUsd)} ({formatPct(cost.savedPct)})
          </span>
        </>
      ) : null}
    </div>
  );
}
function MemoryPanel({
  memoryUsed,
  onForget,
  forgettingId,
}: {
  memoryUsed: MemoryUsed;
  onForget: (factId: string) => void;
  forgettingId: string | null;
}) {
  return (
    <>
      <div className="ai-panel__section">
        <div className="ai-panel__section-title">Memori inti</div>
        {memoryUsed.coreMemoryBlocks.length === 0 ? (
          <p className="ai-panel__empty">Tidak ada blok memori inti.</p>
        ) : (
          memoryUsed.coreMemoryBlocks.map((label, i) => (
            <div className="ai-core-block" key={`${label}-${i}`}>
              {label}
            </div>
          ))
        )}
      </div>
      <div className="ai-panel__section">
        <div className="ai-panel__section-title">Fakta yang ditarik</div>
        {memoryUsed.recalledFacts.length === 0 ? (
          <p className="ai-panel__empty">Tidak ada fakta yang ditarik.</p>
        ) : (
          memoryUsed.recalledFacts.map((fact) => (
            <div className="ai-fact" key={fact.id}>
              <div className="ai-fact__body">
                <div className="ai-fact__text">{fact.text}</div>
                <div className="ai-fact__score">skor {fact.score.toFixed(2)}</div>
              </div>
              <button
                type="button"
                className="ecr-btn ecr-btn--secondary ai-forget-btn"
                onClick={() => onForget(fact.id)}
                disabled={forgettingId === fact.id}
              >
                Lupakan
              </button>
            </div>
          ))
        )}
      </div>
      <div className="ai-panel__section">
        <div className="ai-panel__section-title">Ringkasan episodik</div>
        {memoryUsed.episodicSummaries.length === 0 ? (
          <p className="ai-panel__empty">Tidak ada ringkasan episodik.</p>
        ) : (
          memoryUsed.episodicSummaries.map((ep) => (
            <div className="ai-episode" key={ep.id}>
              {ep.text}
            </div>
          ))
        )}
      </div>
    </>
  );
}
function extractErrorMessage(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const error = (body as Record<string, unknown>).error;
  if (typeof error !== "object" || error === null) return undefined;
  const message = (error as Record<string, unknown>).message;
  return typeof message === "string" ? message : undefined;
}
