"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import type { ChatCost, ChatResponse, MemoryUsed } from "@ecorione/shared-schema";
import {
  MAX_COMPOSER_ATTACHMENTS,
  attachmentChipLabel,
  attachmentsReadyForSend,
  buildAttachmentAwareMessage,
  uploadChatAttachment,
  type ChatAttachment,
} from "../lib/chat-attachments";
import { makeSessionId } from "../lib/session";

type ChatTarget = "local" | "hosted";
type RuntimeSnapshot = {
  settings?: {
    hostedCallsEnabled?: boolean;
    hostedProvider?: "anthropic" | "openrouter" | "openai";
    defaultChatTarget?: ChatTarget;
  };
};
type CredentialSnapshot = {
  credentials?: Array<{ provider: string }>;
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
let attachmentCounter = 0;
function nextAttachmentId(): string {
  attachmentCounter += 1;
  return `att-${attachmentCounter}`;
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
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [forgettingId, setForgettingId] = useState<string | null>(null);
  const [memoryFeedback, setMemoryFeedback] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualDraft, setManualDraft] = useState("");
  const sendInFlightRef = useRef(false);
  const forgetInFlightRef = useRef<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const attachMenuRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const latestAssistant = [...turns]
    .reverse()
    .find((t): t is AssistantTurn => t.kind === "assistant");

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetch("/api/settings/settings/runtime", { cache: "no-store" }),
      fetch("/api/settings/settings/credentials", { cache: "no-store" }),
    ])
      .then(async ([runtimeResponse, credentialResponse]) => {
        if (!runtimeResponse.ok) throw new Error(`HTTP ${String(runtimeResponse.status)}`);
        const runtimeSnapshot = (await runtimeResponse.json()) as RuntimeSnapshot;
        const credentialSnapshot = credentialResponse.ok
          ? ((await credentialResponse.json()) as CredentialSnapshot)
          : { credentials: [] };
        return { runtimeSnapshot, credentialSnapshot };
      })
      .then(({ runtimeSnapshot, credentialSnapshot }) => {
        if (cancelled) return;
        const hostedProvider = runtimeSnapshot.settings?.hostedProvider;
        const hasHostedCredential =
          hostedProvider !== undefined &&
          (credentialSnapshot.credentials ?? []).some(
            (credential) => credential.provider === hostedProvider,
          );
        const hostedReady =
          runtimeSnapshot.settings?.hostedCallsEnabled === true && hasHostedCredential;
        setHostedAvailable(hostedReady);
        setTarget(
          runtimeSnapshot.settings?.defaultChatTarget === "hosted" && hostedReady
            ? "hosted"
            : "local",
        );
      })
      .catch(() => {
        if (!cancelled) {
          setHostedAvailable(false);
          setTarget("local");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated || turns.length === 0) return;
    threadEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [hydrated, sending, turns.length]);

  // Folder attach needs a browser-only, non-standard attribute (`webkitdirectory`) that
  // React's typings don't know about — set it imperatively so TS stays honest.
  useEffect(() => {
    folderInputRef.current?.setAttribute("webkitdirectory", "");
    folderInputRef.current?.setAttribute("directory", "");
  }, []);

  useEffect(() => {
    if (!attachMenuOpen) return;
    function onDocPointerDown(event: MouseEvent): void {
      if (attachMenuRef.current && !attachMenuRef.current.contains(event.target as Node)) {
        setAttachMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocPointerDown);
    return () => document.removeEventListener("mousedown", onDocPointerDown);
  }, [attachMenuOpen]);

  async function sendMessage(text: string): Promise<boolean> {
    const trimmed = text.trim();
    if (!hydrated || trimmed.length === 0 || sending || sendInFlightRef.current) return false;
    if (target === "hosted" && hostedAvailable !== true) {
      setTurns((prev) => [
        ...prev,
        {
          kind: "error",
          id: nextTurnId(),
          message: "Hosted sedang nonaktif. Pakai Local untuk sesi ini.",
        },
      ]);
      return false;
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
        return false;
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
      return true;
    } catch {
      setTurns((prev) => [
        ...prev,
        { kind: "error", id: nextTurnId(), message: "Tidak bisa menghubungi server." },
      ]);
      return false;
    } finally {
      sendInFlightRef.current = false;
      setSending(false);
    }
  }

  async function forgetFact(factId: string): Promise<void> {
    if (forgettingId !== null || forgetInFlightRef.current !== null) return;
    forgetInFlightRef.current = factId;
    setForgettingId(factId);
    setMemoryFeedback(null);
    try {
      const res = await fetch("/api/forget", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ factId }),
      });
      const body: unknown = await res.json().catch(() => undefined);
      if (!res.ok) {
        const message = extractErrorMessage(body) ?? `Gagal melupakan fakta (${res.status}).`;
        setMemoryFeedback({ kind: "error", message });
        setTurns((prev) => [
          ...prev,
          {
            kind: "error",
            id: nextTurnId(),
            message,
          },
        ]);
        return;
      }
      setMemoryFeedback({ kind: "success", message: "Fakta berhasil dilupakan." });
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
      const message = "Tidak bisa menghubungi server untuk melupakan fakta.";
      setMemoryFeedback({ kind: "error", message });
      setTurns((prev) => [
        ...prev,
        {
          kind: "error",
          id: nextTurnId(),
          message,
        },
      ]);
    } finally {
      forgetInFlightRef.current = null;
      setForgettingId(null);
    }
  }

  function removeAttachment(id: string): void {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  function addFilesAs(fileList: FileList | null, prefix: "File" | "Foto" | "Folder"): void {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    const available = Math.max(0, MAX_COMPOSER_ATTACHMENTS - attachments.length);
    if (files.length > available) {
      setTurns((prev) => [
        ...prev,
        {
          kind: "error",
          id: nextTurnId(),
          message: `Maksimal ${String(MAX_COMPOSER_ATTACHMENTS)} lampiran per pesan.`,
        },
      ]);
      return;
    }

    const additions: ChatAttachment[] = files.map((file) => {
      const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
      const displayName = prefix === "Folder" && relativePath ? relativePath : file.name;
      return {
        id: nextAttachmentId(),
        kind: "file",
        label: `${prefix}: ${displayName}`,
        state: "uploading",
        file,
      };
    });
    setAttachments((prev) => [...prev, ...additions]);

    for (const attachment of additions) {
      const file = attachment.file;
      if (file === undefined) continue;
      void uploadChatAttachment({ sessionId, target, file })
        .then((uploaded) => {
          setAttachments((prev) =>
            prev.map((current) =>
              current.id === attachment.id
                ? {
                    ...current,
                    state: "ready",
                    artifactId: uploaded.artifactId,
                    contextEpisodeId: uploaded.contextEpisodeId,
                    error: undefined,
                  }
                : current,
            ),
          );
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "Lampiran gagal diproses.";
          setAttachments((prev) =>
            prev.map((current) =>
              current.id === attachment.id
                ? { ...current, state: "error", error: message }
                : current,
            ),
          );
        });
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>): void {
    addFilesAs(event.target.files, "File");
    event.target.value = "";
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>): void {
    addFilesAs(event.target.files, "Foto");
    event.target.value = "";
  }

  function handleFolderChange(event: ChangeEvent<HTMLInputElement>): void {
    addFilesAs(event.target.files, "Folder");
    event.target.value = "";
  }

  function addManualNote(): void {
    const trimmed = manualDraft.trim();
    if (trimmed.length === 0) return;
    setAttachments((prev) => [
      ...prev,
      {
        id: nextAttachmentId(),
        kind: "note",
        label: `Catatan: ${trimmed}`,
        noteText: trimmed,
        state: "ready",
      },
    ]);
    setManualDraft("");
    setManualOpen(false);
  }

  function submitDraft(): void {
    if (!attachmentsReadyForSend(attachments)) return;
    const finalText = buildAttachmentAwareMessage(draft, attachments);
    if (finalText.length === 0) return;
    const sentAttachmentIds = new Set(attachments.map((attachment) => attachment.id));
    void sendMessage(finalText).then((sent) => {
      if (!sent) return;
      setAttachments((prev) =>
        prev.filter((attachment) => !sentAttachmentIds.has(attachment.id)),
      );
    });
  }

  function handleSubmit(e: FormEvent): void {
    e.preventDefault();
    submitDraft();
  }
  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitDraft();
    }
  }

  const routeHint =
    turns.length > 0
      ? "Terkunci untuk sesi ini."
      : attachments.length > 0
        ? "Terkunci selama lampiran dipakai di sesi ini."
        : hostedAvailable === true
          ? "Terkunci setelah pesan pertama."
          : "Hosted nonaktif — sesi ini Local-only.";

  const canSend =
    hydrated &&
    !sending &&
    attachmentsReadyForSend(attachments) &&
    (draft.trim().length > 0 || attachments.length > 0);

  return (
    <div className="ai-shell">
      <span className="ai-session-tag" title={hydrated ? sessionId : "sess_pending"}>
        {hydrated ? sessionId : "sess_pending"}
      </span>
      <main className={`ai-main${panelCollapsed ? " ai-main--panel-collapsed" : ""}`}>
        <section className="ai-conversation" aria-label="Percakapan">
          <div className="ai-thread" aria-live="polite">
            {turns.length === 0 ? (
              <p className="ai-empty">Ketik pesan untuk mulai.</p>
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

          <form className="ai-composer" onSubmit={handleSubmit}>
            {attachments.length > 0 ? (
              <div className="ai-composer__chips">
                {attachments.map((a) => (
                  <span className="ai-chip" key={a.id}>
                    <span className="ai-chip__label" title={a.error}>
                      {attachmentChipLabel(a)}
                    </span>
                    <button
                      type="button"
                      className="ai-chip__remove"
                      aria-label={`Hapus ${a.label}`}
                      onClick={() => removeAttachment(a.id)}
                    >
                      <XIcon />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}

            {manualOpen ? (
              <div className="ai-manual-note">
                <textarea
                  className="ai-manual-note__field"
                  placeholder="Tulis catatan manual…"
                  aria-label="Catatan manual"
                  rows={2}
                  value={manualDraft}
                  onChange={(e) => setManualDraft(e.target.value)}
                  autoFocus
                />
                <div className="ai-manual-note__actions">
                  <button
                    type="button"
                    className="ecr-btn ecr-btn--secondary"
                    onClick={() => {
                      setManualOpen(false);
                      setManualDraft("");
                    }}
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    className="ecr-btn ecr-btn--primary"
                    onClick={addManualNote}
                    disabled={manualDraft.trim().length === 0}
                  >
                    Tambah
                  </button>
                </div>
              </div>
            ) : null}

            <textarea
              className="ai-composer__field"
              placeholder="Tulis pesan…"
              aria-label="Pesan"
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!hydrated || sending}
            />

            <div className="ai-composer__toolbar">
              <div className="ai-composer__tools" ref={attachMenuRef}>
                <button
                  type="button"
                  className="ai-tool-btn"
                  aria-label="Tambah lampiran"
                  aria-haspopup="menu"
                  aria-expanded={attachMenuOpen}
                  onClick={() => setAttachMenuOpen((prev) => !prev)}
                >
                  <PlusIcon />
                </button>
                {attachMenuOpen ? (
                  <div className="ai-attach-menu" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        fileInputRef.current?.click();
                        setAttachMenuOpen(false);
                      }}
                    >
                      <FileIcon />
                      Unggah file
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        photoInputRef.current?.click();
                        setAttachMenuOpen(false);
                      }}
                    >
                      <PhotoIcon />
                      Unggah foto
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        folderInputRef.current?.click();
                        setAttachMenuOpen(false);
                      }}
                    >
                      <FolderIcon />
                      Tambah folder
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setManualOpen(true);
                        setAttachMenuOpen(false);
                      }}
                    >
                      <PencilIcon />
                      Manual
                    </button>
                  </div>
                ) : null}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  hidden
                  onChange={handleFileChange}
                />
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={handlePhotoChange}
                />
                <input ref={folderInputRef} type="file" hidden onChange={handleFolderChange} />
              </div>

              <div className="ai-model-select" title={routeHint}>
                <select
                  id="chat-target"
                  aria-label="Model"
                  value={target}
                  onChange={(e) => setTarget(e.target.value as ChatTarget)}
                  disabled={!hydrated || sending || turns.length > 0 || attachments.length > 0}
                >
                  <option value="local">Local</option>
                  <option value="hosted" disabled={hostedAvailable !== true}>
                    {hostedAvailable === true ? "Hosted" : "Hosted (nonaktif)"}
                  </option>
                </select>
                <ChevronIcon />
              </div>

              <button
                type="submit"
                className="ai-send-btn"
                aria-label="Kirim pesan"
                disabled={!canSend}
              >
                <SendIcon />
              </button>
            </div>
          </form>
        </section>
        <aside
          className={`ai-panel${panelCollapsed ? " ai-panel--collapsed" : ""}`}
          aria-label="Memory used"
        >
          <div className="ai-panel__header">
            {panelCollapsed ? null : <div className="ai-panel__title">Memori yang dipakai</div>}
            <button
              type="button"
              className="ai-panel__toggle"
              aria-label={panelCollapsed ? "Buka panel memori" : "Ciutkan panel memori"}
              aria-expanded={!panelCollapsed}
              onClick={() => setPanelCollapsed((prev) => !prev)}
            >
              <PanelToggleIcon collapsed={panelCollapsed} />
            </button>
          </div>
          <div className="ai-panel__body">
            {memoryFeedback !== null ? (
              <p
                className={`ai-panel__feedback ai-panel__feedback--${memoryFeedback.kind}`}
                role={memoryFeedback.kind === "error" ? "alert" : "status"}
              >
                {memoryFeedback.message}
              </p>
            ) : null}
            {latestAssistant === undefined ? (
              <p className="ai-panel__empty">Belum ada balasan.</p>
            ) : (
              <MemoryPanel
                memoryUsed={latestAssistant.memoryUsed}
                onForget={forgetFact}
                forgettingId={forgettingId}
              />
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}

function PanelToggleIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      className="ai-panel__toggle-icon"
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3" y="3.5" width="14" height="13" rx="2" />
      <path d={collapsed ? "M12 6.5v7M8 8.6l2 1.4-2 1.4" : "M12 6.5v7M10 8.6l-2 1.4 2 1.4"} />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="ai-tool-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M10 4v12M4 10h12" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg className="ai-menu-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M6 3h6l3 3v11H6Z" />
      <path d="M12 3v3h3" />
    </svg>
  );
}

function PhotoIcon() {
  return (
    <svg className="ai-menu-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <rect x="3" y="4.5" width="14" height="11" rx="1.5" />
      <circle cx="7.3" cy="8.3" r="1.3" />
      <path d="M4 14 8 10l3 3 2.5-2.5L16.5 14" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg className="ai-menu-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M3 6.2c0-.66.6-1.2 1.2-1.2h3.4l1.4 1.6h6.8c.66 0 1.2.54 1.2 1.2v6.4c0 .66-.54 1.2-1.2 1.2H4.2C3.54 15.4 3 14.86 3 14.2Z" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg className="ai-menu-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M12.9 3.9 16.1 7.1 7 16.2l-3.5.7.7-3.5Z" />
      <path d="M11.4 5.4 14.6 8.6" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      className="ai-chip__remove-icon"
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      className="ai-model-select__chevron"
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6 8l4 4 4-4" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg className="ai-send-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M10 15.5V4.5M10 4.5 5.3 9.2M10 4.5l4.7 4.7" />
    </svg>
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
          <p className="ai-panel__empty">Tidak ada.</p>
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
          <p className="ai-panel__empty">Tidak ada.</p>
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
                disabled={forgettingId !== null}
              >
                {forgettingId === fact.id ? "Melupakan…" : "Lupakan"}
              </button>
            </div>
          ))
        )}
      </div>
      <div className="ai-panel__section">
        <div className="ai-panel__section-title">Ringkasan episodik</div>
        {memoryUsed.episodicSummaries.length === 0 ? (
          <p className="ai-panel__empty">Tidak ada.</p>
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
