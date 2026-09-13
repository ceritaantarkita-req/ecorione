#!/usr/bin/env bash
# Menerapkan: dark mode default, redesain composer halaman Ai (tombol + lampiran,
# folder, manual, model pill), dan pemangkasan teks di Settings/Control Center.
# Jalankan dari root repo ecorione, contoh:
#   cd ~/projects/ecorione && bash apply-dark-default-and-ai-redesign.sh
set -euo pipefail

if [[ ! -d "apps/ai" || ! -d "packages/shared-ui" ]]; then
  echo "Error: jalankan script ini dari root repo ecorione (folder yang berisi apps/ai dan packages/shared-ui)." >&2
  exit 1
fi

echo "==> Menulis packages/shared-ui/src/theme.ts"
mkdir -p "$(dirname "packages/shared-ui/src/theme.ts")"
cat > packages/shared-ui/src/theme.ts << 'ECR_FILE_EOF'
/**
 * Penerapan & penyimpanan pilihan tema (`design.md` §9).
 *
 * Kontraknya satu atribut: `data-theme="light" | "dark"` di elemen root. Semua aturan
 * warna sudah dipasang `renderThemeCss()`; di sini hanya soal siapa yang menyetel atribut,
 * kapan, dan bagaimana preferensinya diingat.
 */

import { THEME_CHOICES, type ThemeChoice } from "./css.js";

/** Kunci penyimpanan, sama dengan yang dipakai mockup supaya preferensi lama tetap terbaca. */
export const THEME_STORAGE_KEY = "ecorione-theme-preview";

/**
 * Tema saat preferensi tidak diketahui (belum pernah memilih, atau storage gagal dibaca).
 *
 * Gelap: default produk sekarang adalah dark mode, terlepas dari preferensi OS pengguna.
 * Pengguna tetap bisa memilih terang secara eksplisit lewat tombol tema — pilihan itu yang
 * disimpan dan dihormati (lihat `readStoredTheme`/`THEME_BOOTSTRAP_SCRIPT`).
 */
export const DEFAULT_THEME: ThemeChoice = "dark";

/**
 * Permukaan minimal `localStorage` yang benar-benar dipakai. Sengaja struktural: paket ini
 * tanpa dependensi dan tanpa `lib.dom` di sisi pemanggil pun tetap bisa mengoper objek
 * apa pun yang bentuknya cocok (termasuk stub di test).
 */
export interface ThemeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return typeof value === "string" && (THEME_CHOICES as readonly string[]).includes(value);
}

/**
 * Pasang tema ke elemen root.
 *
 * `root` wajib dioper, tidak diam-diam mengambil `document.documentElement`: paket ini juga
 * diimpor kode server-rendered, dan menyentuh `document` di sana melempar.
 */
export function applyTheme(choice: ThemeChoice, root: Element): void {
  root.setAttribute("data-theme", choice);
}

/**
 * Baca preferensi tersimpan.
 *
 * Akses storage dibungkus try/catch karena `localStorage` bukan cuma bisa penuh — di
 * beberapa konteks (iframe pihak ketiga, Safari private mode, browser yang memblokir
 * site data) **mengakses propertinya saja sudah melempar**. Design system yang membuat
 * halaman mati gara-gara mengingat preferensi warna adalah bug, bukan fitur; setiap
 * kegagalan jatuh ke {@link DEFAULT_THEME}.
 */
export function readStoredTheme(storage: ThemeStorage): ThemeChoice {
  try {
    const saved = storage.getItem(THEME_STORAGE_KEY);
    return isThemeChoice(saved) ? saved : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/**
 * Simpan preferensi. Gagal menyimpan tidak pernah dipropagasikan — pengguna kehilangan
 * ingatan preferensi, bukan halamannya. Mengembalikan `false` kalau penyimpanan gagal,
 * supaya pemanggil yang peduli bisa tahu tanpa harus menangkap exception sendiri.
 */
export function persistTheme(choice: ThemeChoice, storage: ThemeStorage): boolean {
  try {
    storage.setItem(THEME_STORAGE_KEY, choice);
    return true;
  } catch {
    return false;
  }
}

/**
 * Snippet inline untuk `<head>`, **sebelum** konten dirender.
 *
 * Kenapa inline dan sinkron: kalau atribut `data-theme` baru dipasang setelah bundle JS
 * dimuat, halaman sempat tampil dengan tema yang salah lalu berkedip ke tema yang benar
 * (FOUT tema). Satu blok kecil tanpa dependensi di `<head>` menghilangkan jendela itu.
 *
 * Ditulis ES5 dan defensif dengan sengaja: ia jalan sebelum apa pun yang lain, jadi ia
 * tidak boleh mengandalkan bundler, polyfill, atau storage yang bisa diakses.
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){
  try {
    var saved = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    document.documentElement.setAttribute('data-theme', saved === 'light' ? 'light' : 'dark');
  } catch (e) {
    document.documentElement.setAttribute('data-theme', ${JSON.stringify(DEFAULT_THEME)});
  }
})();`;
ECR_FILE_EOF

echo "==> Menulis packages/shared-ui/dist/theme.js"
mkdir -p "$(dirname "packages/shared-ui/dist/theme.js")"
cat > packages/shared-ui/dist/theme.js << 'ECR_FILE_EOF'
/**
 * Penerapan & penyimpanan pilihan tema (`design.md` §9).
 *
 * Kontraknya satu atribut: `data-theme="light" | "dark"` di elemen root. Semua aturan
 * warna sudah dipasang `renderThemeCss()`; di sini hanya soal siapa yang menyetel atribut,
 * kapan, dan bagaimana preferensinya diingat.
 */
import { THEME_CHOICES } from "./css.js";
/** Kunci penyimpanan, sama dengan yang dipakai mockup supaya preferensi lama tetap terbaca. */
export const THEME_STORAGE_KEY = "ecorione-theme-preview";
/**
 * Tema saat preferensi tidak diketahui (belum pernah memilih, atau storage gagal dibaca).
 *
 * Gelap: default produk sekarang adalah dark mode, terlepas dari preferensi OS pengguna.
 * Pengguna tetap bisa memilih terang secara eksplisit lewat tombol tema — pilihan itu yang
 * disimpan dan dihormati (lihat `readStoredTheme`/`THEME_BOOTSTRAP_SCRIPT`).
 */
export const DEFAULT_THEME = "dark";
export function isThemeChoice(value) {
    return typeof value === "string" && THEME_CHOICES.includes(value);
}
/**
 * Pasang tema ke elemen root.
 *
 * `root` wajib dioper, tidak diam-diam mengambil `document.documentElement`: paket ini juga
 * diimpor kode server-rendered, dan menyentuh `document` di sana melempar.
 */
export function applyTheme(choice, root) {
    root.setAttribute("data-theme", choice);
}
/**
 * Baca preferensi tersimpan.
 *
 * Akses storage dibungkus try/catch karena `localStorage` bukan cuma bisa penuh — di
 * beberapa konteks (iframe pihak ketiga, Safari private mode, browser yang memblokir
 * site data) **mengakses propertinya saja sudah melempar**. Design system yang membuat
 * halaman mati gara-gara mengingat preferensi warna adalah bug, bukan fitur; setiap
 * kegagalan jatuh ke {@link DEFAULT_THEME}.
 */
export function readStoredTheme(storage) {
    try {
        const saved = storage.getItem(THEME_STORAGE_KEY);
        return isThemeChoice(saved) ? saved : DEFAULT_THEME;
    }
    catch {
        return DEFAULT_THEME;
    }
}
/**
 * Simpan preferensi. Gagal menyimpan tidak pernah dipropagasikan — pengguna kehilangan
 * ingatan preferensi, bukan halamannya. Mengembalikan `false` kalau penyimpanan gagal,
 * supaya pemanggil yang peduli bisa tahu tanpa harus menangkap exception sendiri.
 */
export function persistTheme(choice, storage) {
    try {
        storage.setItem(THEME_STORAGE_KEY, choice);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Snippet inline untuk `<head>`, **sebelum** konten dirender.
 *
 * Kenapa inline dan sinkron: kalau atribut `data-theme` baru dipasang setelah bundle JS
 * dimuat, halaman sempat tampil dengan tema yang salah lalu berkedip ke tema yang benar
 * (FOUT tema). Satu blok kecil tanpa dependensi di `<head>` menghilangkan jendela itu.
 *
 * Ditulis ES5 dan defensif dengan sengaja: ia jalan sebelum apa pun yang lain, jadi ia
 * tidak boleh mengandalkan bundler, polyfill, atau storage yang bisa diakses.
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){
  try {
    var saved = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    document.documentElement.setAttribute('data-theme', saved === 'light' ? 'light' : 'dark');
  } catch (e) {
    document.documentElement.setAttribute('data-theme', ${JSON.stringify(DEFAULT_THEME)});
  }
})();`;
//# sourceMappingURL=theme.js.map
ECR_FILE_EOF

echo "==> Menulis packages/shared-ui/dist/theme.d.ts"
mkdir -p "$(dirname "packages/shared-ui/dist/theme.d.ts")"
cat > packages/shared-ui/dist/theme.d.ts << 'ECR_FILE_EOF'
/**
 * Penerapan & penyimpanan pilihan tema (`design.md` §9).
 *
 * Kontraknya satu atribut: `data-theme="light" | "dark"` di elemen root. Semua aturan
 * warna sudah dipasang `renderThemeCss()`; di sini hanya soal siapa yang menyetel atribut,
 * kapan, dan bagaimana preferensinya diingat.
 */
import { type ThemeChoice } from "./css.js";
/** Kunci penyimpanan, sama dengan yang dipakai mockup supaya preferensi lama tetap terbaca. */
export declare const THEME_STORAGE_KEY = "ecorione-theme-preview";
/**
 * Tema saat preferensi tidak diketahui (belum pernah memilih, atau storage gagal dibaca).
 *
 * Gelap: default produk sekarang adalah dark mode, terlepas dari preferensi OS pengguna.
 * Pengguna tetap bisa memilih terang secara eksplisit lewat tombol tema — pilihan itu yang
 * disimpan dan dihormati (lihat `readStoredTheme`/`THEME_BOOTSTRAP_SCRIPT`).
 */
export declare const DEFAULT_THEME: ThemeChoice;
/**
 * Permukaan minimal `localStorage` yang benar-benar dipakai. Sengaja struktural: paket ini
 * tanpa dependensi dan tanpa `lib.dom` di sisi pemanggil pun tetap bisa mengoper objek
 * apa pun yang bentuknya cocok (termasuk stub di test).
 */
export interface ThemeStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}
export declare function isThemeChoice(value: unknown): value is ThemeChoice;
/**
 * Pasang tema ke elemen root.
 *
 * `root` wajib dioper, tidak diam-diam mengambil `document.documentElement`: paket ini juga
 * diimpor kode server-rendered, dan menyentuh `document` di sana melempar.
 */
export declare function applyTheme(choice: ThemeChoice, root: Element): void;
/**
 * Baca preferensi tersimpan.
 *
 * Akses storage dibungkus try/catch karena `localStorage` bukan cuma bisa penuh — di
 * beberapa konteks (iframe pihak ketiga, Safari private mode, browser yang memblokir
 * site data) **mengakses propertinya saja sudah melempar**. Design system yang membuat
 * halaman mati gara-gara mengingat preferensi warna adalah bug, bukan fitur; setiap
 * kegagalan jatuh ke {@link DEFAULT_THEME}.
 */
export declare function readStoredTheme(storage: ThemeStorage): ThemeChoice;
/**
 * Simpan preferensi. Gagal menyimpan tidak pernah dipropagasikan — pengguna kehilangan
 * ingatan preferensi, bukan halamannya. Mengembalikan `false` kalau penyimpanan gagal,
 * supaya pemanggil yang peduli bisa tahu tanpa harus menangkap exception sendiri.
 */
export declare function persistTheme(choice: ThemeChoice, storage: ThemeStorage): boolean;
/**
 * Snippet inline untuk `<head>`, **sebelum** konten dirender.
 *
 * Kenapa inline dan sinkron: kalau atribut `data-theme` baru dipasang setelah bundle JS
 * dimuat, halaman sempat tampil dengan tema yang salah lalu berkedip ke tema yang benar
 * (FOUT tema). Satu blok kecil tanpa dependensi di `<head>` menghilangkan jendela itu.
 *
 * Ditulis ES5 dan defensif dengan sengaja: ia jalan sebelum apa pun yang lain, jadi ia
 * tidak boleh mengandalkan bundler, polyfill, atau storage yang bisa diakses.
 */
export declare const THEME_BOOTSTRAP_SCRIPT: string;
//# sourceMappingURL=theme.d.ts.map
ECR_FILE_EOF

echo "==> Menulis apps/ai/app/page.tsx"
mkdir -p "$(dirname "apps/ai/app/page.tsx")"
cat > apps/ai/app/page.tsx << 'ECR_FILE_EOF'
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
interface Attachment {
  id: string;
  label: string;
}
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
  const [attachments, setAttachments] = useState<Attachment[]>([]);
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

  async function sendMessage(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!hydrated || trimmed.length === 0 || sending || sendInFlightRef.current) return;
    if (target === "hosted" && hostedAvailable !== true) {
      setTurns((prev) => [
        ...prev,
        {
          kind: "error",
          id: nextTurnId(),
          message: "Hosted sedang nonaktif. Pakai Local untuk sesi ini.",
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

  function addFilesAs(fileList: FileList | null, prefix: string): void {
    if (!fileList || fileList.length === 0) return;
    const additions = Array.from(fileList).map((file) => ({
      id: nextAttachmentId(),
      label: `${prefix}: ${file.name}`,
    }));
    setAttachments((prev) => [...prev, ...additions]);
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
    const files = event.target.files;
    if (files && files.length > 0) {
      const first = files[0] as File & { webkitRelativePath?: string };
      const folderName = first.webkitRelativePath?.split("/")[0] ?? "folder";
      setAttachments((prev) => [
        ...prev,
        { id: nextAttachmentId(), label: `Folder: ${folderName} (${files.length} file)` },
      ]);
    }
    event.target.value = "";
  }

  function addManualNote(): void {
    const trimmed = manualDraft.trim();
    if (trimmed.length === 0) return;
    setAttachments((prev) => [
      ...prev,
      { id: nextAttachmentId(), label: `Catatan: ${trimmed}` },
    ]);
    setManualDraft("");
    setManualOpen(false);
  }

  function submitDraft(): void {
    const attachmentText =
      attachments.length > 0 ? attachments.map((a) => `[${a.label}]`).join("\n") : "";
    const finalText = attachmentText ? `${draft}\n\n${attachmentText}`.trim() : draft;
    void sendMessage(finalText);
    setAttachments([]);
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
      : hostedAvailable === true
        ? "Terkunci setelah pesan pertama."
        : "Hosted nonaktif — sesi ini Local-only.";

  const canSend = hydrated && !sending && (draft.trim().length > 0 || attachments.length > 0);

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
                    <span className="ai-chip__label">{a.label}</span>
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
                  disabled={!hydrated || sending || turns.length > 0}
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
ECR_FILE_EOF

echo "==> Menulis apps/ai/app/globals.css"
mkdir -p "$(dirname "apps/ai/app/globals.css")"
cat > apps/ai/app/globals.css << 'ECR_FILE_EOF'
/*
 * Token dasar di bawah mengikuti `packages/shared-ui` / `docs/design.md`.
 * Styling halaman setelah blok token hanya memakai custom property ini agar dark/light
 * tetap satu sistem dan tidak mengulang hex per halaman.
 */
:root {
  --bg: #0b0b0c;
  --surface: #151517;
  --surface-2: #1c1c1f;
  --surface-3: #232326;
  --border: #2a2a2d;
  --border-soft: #1e1e21;
  --text: #edeae2;
  --text-muted: #8b8880;
  --accent: #c9a961;
  --accent-strong: #dbbe7e;
  --accent-ink: #1b1608;
  --success: #5e8770;
  --warning: #b9793e;
  --danger: #a6564a;

  --font-display: "Fraunces", ui-serif, Georgia, serif;
  --font-body:
    "Manrope", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
  --font-mono: "IBM Plex Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  --radius-sm: 5px;
  --radius-md: 9px;
  --radius-lg: 14px;
  --space-none: 0px;
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 24px;
  --space-2xl: 32px;
  --space-3xl: 48px;
  --space-4xl: 64px;
  --elevation-none: none;
  --elevation-active-rail: inset 2px 0 0 var(--accent);
  /*
   * Sisa dari saat navigasi utama masih bar horizontal di atas halaman (lihat riwayat git).
   * Navigasi sekarang adalah sidebar kiri (`navigation.css`) yang tidak makan tinggi viewport,
   * jadi nilainya 0 — tetap dipertahankan sebagai token (bukan dihapus) supaya
   * `flow/FlowCanvas.module.css`, `ops/OpsDashboard.module.css`, `settings/Settings.module.css`,
   * dan `space/Space.module.css` yang masih memakainya di ekspresi
   * `calc(100dvh - var(--app-nav-height))` tidak perlu diubah satu per satu.
   */
  --app-nav-height: 0px;
  --content-max: 1240px;
  --ecr-sidebar-width: 236px;
  --ecr-sidebar-width-collapsed: 60px;
}

@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) {
    --bg: #ffffff;
    --surface: #ffffff;
    --surface-2: #f6f5f0;
    --surface-3: #efede5;
    --border: #e4e0d4;
    --border-soft: #edeae0;
    --text: #1c1b17;
    --text-muted: #7c786d;
    --accent: #9c7a3b;
    --accent-strong: #7f642f;
    --accent-ink: #ffffff;
    --success: #3e6350;
    --warning: #a15f26;
    --danger: #883f35;
  }
}

:root[data-theme="light"] {
  --bg: #ffffff;
  --surface: #ffffff;
  --surface-2: #f6f5f0;
  --surface-3: #efede5;
  --border: #e4e0d4;
  --border-soft: #edeae0;
  --text: #1c1b17;
  --text-muted: #7c786d;
  --accent: #9c7a3b;
  --accent-strong: #7f642f;
  --accent-ink: #ffffff;
  --success: #3e6350;
  --warning: #a15f26;
  --danger: #883f35;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  min-width: 320px;
  background: var(--bg);
}

body {
  min-height: 100dvh;
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-body);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

button,
input,
select,
textarea {
  font: inherit;
}

button,
a,
input,
select,
textarea {
  -webkit-tap-highlight-color: transparent;
}

a {
  color: inherit;
}

h1,
h2,
h3 {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 600;
  text-wrap: balance;
}

p {
  text-wrap: pretty;
}

code,
kbd,
samp,
pre {
  font-family: var(--font-mono);
}

img,
svg,
video {
  max-width: 100%;
}

hr {
  border: 0;
  border-top: 1px solid var(--border);
}

::selection {
  background: var(--accent);
  color: var(--accent-ink);
}

:focus-visible {
  outline: 1px solid var(--accent);
  outline-offset: 2px;
}

/* Shared fittings --------------------------------------------------------- */
.ecr-btn {
  min-height: 34px;
  padding: 0 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 650;
  letter-spacing: 0.01em;
  cursor: pointer;
  transition:
    border-color 140ms ease,
    background 140ms ease,
    color 140ms ease,
    opacity 140ms ease;
}

.ecr-btn:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.ecr-btn--primary {
  background: var(--accent);
  color: var(--accent-ink);
}

.ecr-btn--primary:hover:not(:disabled) {
  background: var(--accent-strong);
}

.ecr-btn--secondary {
  background: transparent;
  border-color: var(--border);
  color: var(--text);
}

.ecr-btn--secondary:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--accent) 70%, var(--border));
  background: var(--surface-2);
}

.ecr-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--text-muted);
  font-size: 12px;
}

.ecr-chip__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex: none;
}

.ecr-chip--ok .ecr-chip__dot {
  background: var(--success);
}

.ecr-chip--warn .ecr-chip__dot {
  background: var(--warning);
}

.ecr-chip--err .ecr-chip__dot {
  background: var(--danger);
}

.ecr-input {
  min-height: 34px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 11.5px;
}

.ecr-input:focus-visible {
  border-color: var(--accent);
  outline: 1px solid var(--accent);
  outline-offset: 1px;
}

/* App shell — sidebar kiri (navigation.css) + konten produk ------------------ */
.ecr-app-shell {
  display: flex;
  align-items: stretch;
  min-height: 100dvh;
}

.ecr-app-content {
  flex: 1 1 auto;
  min-width: 0;
}

/* Ai --------------------------------------------------------------------- */
.ai-shell {
  position: relative;
  min-height: calc(100dvh - var(--app-nav-height));
  display: flex;
  flex-direction: column;
}

/* Tag sesi kecil, tak mencolok — dulu bagian dari header besar; sekarang cuma
   penanda debug tipis di pojok, sesuai gaya minim Claude/ChatGPT. */
.ai-session-tag {
  position: absolute;
  top: 14px;
  right: 28px;
  z-index: 1;
  max-width: 220px;
  overflow: hidden;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 9.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.6;
}

.ai-main {
  width: min(100%, var(--content-max));
  flex: 1;
  margin: 0 auto;
  padding: 20px 28px 56px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  align-items: stretch;
  transition: grid-template-columns 160ms ease;
}

.ai-main--panel-collapsed {
  grid-template-columns: minmax(0, 1fr) auto;
}

.ai-conversation {
  min-width: 0;
  min-height: 560px;
  padding: 30px 34px 0 0;
  display: flex;
  flex-direction: column;
}

.ai-thread {
  width: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding-bottom: 24px;
}

.ai-empty {
  max-width: 560px;
  margin: 64px auto auto;
  padding: 0;
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1.7;
  text-align: center;
}

.ai-empty::before {
  content: "Ai";
  display: block;
  margin-bottom: 10px;
  color: var(--text);
  font-family: var(--font-display);
  font-size: clamp(34px, 6vw, 54px);
  line-height: 1;
}

.ai-turn {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.ai-turn--user {
  align-items: flex-end;
}

.ai-turn--assistant {
  align-items: flex-start;
}

.ai-bubble {
  max-width: min(88%, 720px);
  padding: 11px 14px;
  border-radius: var(--radius-md);
  font-size: 14px;
  line-height: 1.65;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.ai-turn--user .ai-bubble {
  border: 1px solid var(--border);
  border-bottom-right-radius: 3px;
  background: var(--surface-2);
  color: var(--text);
}

.ai-turn--assistant .ai-bubble {
  padding-left: 0;
  border-radius: 0;
  background: transparent;
}

.ai-turn--assistant .ai-bubble--error {
  width: min(100%, 680px);
  padding: 10px 12px;
  border-left: 2px solid var(--danger);
  background: color-mix(in srgb, var(--danger) 8%, transparent);
  color: var(--text);
}

.ai-routing {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
  padding-left: 1px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 9.5px;
}

.ai-routing__model {
  color: var(--text);
}

.ai-routing__savings {
  color: var(--success);
}

/* Composer — satu kotak membulat gaya Claude/ChatGPT: textarea di atas, baris alat
   (lampiran + model + kirim) menyatu di bawahnya dalam kotak yang sama. */
.ai-composer {
  position: sticky;
  bottom: 0;
  z-index: 10;
  margin: 0 -10px;
  padding: 10px 10px max(10px, env(safe-area-inset-bottom));
  background: color-mix(in srgb, var(--bg) 94%, transparent);
  backdrop-filter: blur(14px);
}

.ai-composer__field {
  width: 100%;
  min-height: 48px;
  max-height: 200px;
  resize: vertical;
  padding: 12px 13px 4px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  border-bottom: 0;
  background: var(--surface);
  color: var(--text);
  font-family: var(--font-body);
  font-size: 13.5px;
  line-height: 1.45;
}

.ai-composer__field:focus-visible {
  border-color: var(--accent);
  outline: 1px solid var(--accent);
  outline-offset: 1px;
}

.ai-composer__toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-top: 0;
  border-radius: 0 0 var(--radius-md) var(--radius-md);
  background: var(--surface);
}

.ai-composer__tools {
  position: relative;
}

.ai-tool-btn {
  flex: none;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.ai-tool-btn:hover,
.ai-tool-btn:focus-visible {
  color: var(--text);
  background: var(--surface-2);
}

.ai-tool-icon {
  width: 17px;
  height: 17px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.ai-attach-menu {
  position: absolute;
  left: 0;
  bottom: calc(100% + 6px);
  z-index: 20;
  width: 178px;
  padding: 5px;
  display: flex;
  flex-direction: column;
  gap: 1px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-2);
  box-shadow: 0 10px 30px rgba(10, 9, 6, 0.3);
}

.ai-attach-menu button {
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 32px;
  padding: 0 8px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text);
  font-family: var(--font-body);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.ai-attach-menu button:hover,
.ai-attach-menu button:focus-visible {
  background: var(--surface-3);
}

.ai-menu-icon {
  flex: none;
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.ai-model-select {
  position: relative;
  margin-left: auto;
  display: inline-flex;
  align-items: center;
}

.ai-model-select select {
  appearance: none;
  min-height: 28px;
  padding: 0 22px 0 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: transparent;
  color: var(--text);
  font-family: var(--font-body);
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
}

.ai-model-select select:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.ai-model-select__chevron {
  position: absolute;
  right: 7px;
  width: 11px;
  height: 11px;
  fill: none;
  stroke: var(--text-muted);
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  pointer-events: none;
}

.ai-send-btn {
  flex: none;
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 999px;
  background: var(--accent);
  color: var(--accent-ink);
  cursor: pointer;
  transition:
    opacity 140ms ease,
    background 140ms ease;
}

.ai-send-btn:hover:not(:disabled) {
  background: var(--accent-strong);
}

.ai-send-btn:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.ai-send-icon {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* Chip lampiran, di atas textarea. */
.ai-composer__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 8px 0;
}

.ai-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 260px;
  padding: 4px 6px 4px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface-2);
  color: var(--text);
  font-size: 11px;
}

.ai-chip__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-chip__remove {
  flex: none;
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.ai-chip__remove:hover {
  color: var(--text);
  background: var(--surface-3);
}

.ai-chip__remove-icon {
  width: 9px;
  height: 9px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
}

/* Catatan manual — popover ringan di atas textarea, dibuka dari menu lampiran. */
.ai-manual-note {
  margin: 8px 8px 0;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-2);
}

.ai-manual-note__field {
  width: 100%;
  min-height: 44px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text);
  font-family: var(--font-body);
  font-size: 12.5px;
  line-height: 1.45;
}

.ai-manual-note__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.ai-panel {
  position: sticky;
  top: calc(var(--app-nav-height) + 18px);
  align-self: start;
  min-width: 0;
  max-height: calc(100dvh - var(--app-nav-height) - 36px);
  overflow: auto;
  padding: 30px 0 40px 28px;
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 26px;
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
  transition:
    width 160ms ease,
    padding 160ms ease;
}

/* Viewport kanan yang bisa diciutkan lewat ikon di `.ai-panel__toggle` — konten
   (`.ai-panel__body`) disembunyikan, hanya sisa rel sempit dengan tombol buka. */
.ai-panel--collapsed {
  width: 40px;
  min-width: 40px;
  overflow: visible;
  padding: 30px 0 0 12px;
}

.ai-panel--collapsed .ai-panel__body {
  display: none;
}

.ai-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.ai-panel--collapsed .ai-panel__header {
  justify-content: center;
}

.ai-panel__body {
  display: flex;
  flex-direction: column;
  gap: 26px;
  min-height: 0;
  overflow: auto;
}

.ai-panel__toggle {
  flex: none;
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text-muted);
  cursor: pointer;
}

.ai-panel__toggle:hover,
.ai-panel__toggle:focus-visible {
  color: var(--text);
  background: var(--surface-2);
}

.ai-panel__toggle-icon {
  width: 13px;
  height: 13px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.ai-panel__title {
  color: var(--text);
  font-family: var(--font-display);
  font-size: 18px;
  letter-spacing: -0.01em;
}

.ai-panel__feedback {
  margin: -14px 0 0;
  padding: 8px 0 8px 10px;
  border-left: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 10.5px;
  line-height: 1.5;
}

.ai-panel__feedback--success {
  border-left-color: var(--success);
}

.ai-panel__feedback--error {
  border-left-color: var(--danger);
  color: var(--text);
  background: color-mix(in srgb, var(--danger) 7%, transparent);
}

.ai-panel__section {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.ai-panel__section-title {
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 9.5px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.ai-panel__empty {
  margin: 0;
  color: var(--text-muted);
  font-size: 11.5px;
  line-height: 1.55;
}

.ai-core-block {
  padding: 8px 0;
  border-bottom: 1px solid var(--border-soft);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 10.5px;
  line-height: 1.5;
}

.ai-fact {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 8px;
  padding: 9px 0 9px 10px;
  border-left: 1px solid var(--border);
}

.ai-fact__body {
  min-width: 0;
}

.ai-fact__text {
  font-size: 12px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.ai-fact__score {
  margin-top: 3px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 9px;
}

.ai-forget-btn {
  min-height: 25px;
  height: 25px;
  padding: 0 8px;
  font-size: 9.5px;
}

.ai-episode {
  padding-left: 10px;
  border-left: 1px solid var(--border-soft);
  color: var(--text-muted);
  font-size: 11.5px;
  line-height: 1.5;
}

@media (max-width: 900px) {
  .ai-main {
    grid-template-columns: minmax(0, 1fr);
  }

  .ai-conversation {
    padding-right: 0;
  }

  .ai-panel {
    position: static;
    max-height: none;
    margin-top: 40px;
    padding: 26px 0 0;
    border-top: 1px solid var(--border);
    border-left: 0;
  }

  .ai-panel--collapsed {
    width: auto;
    min-width: 0;
    margin-top: 16px;
    padding: 0;
  }
}

@media (max-width: 640px) {
  .ai-session-tag {
    right: 16px;
  }

  .ai-main {
    padding: 16px 16px 38px;
  }

  .ai-conversation {
    min-height: calc(100dvh - 150px);
    padding-top: 20px;
  }

  .ai-empty {
    margin-top: 42px;
  }

  .ai-bubble {
    max-width: 95%;
  }

  .ai-composer {
    margin-inline: -6px;
    padding-inline: 6px;
  }

  .ai-send-btn,
  .ai-tool-btn {
    width: 36px;
    height: 36px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ecr-btn {
    transition: none;
  }
}
ECR_FILE_EOF

echo "==> Menulis apps/ai/app/settings/page.tsx"
mkdir -p "$(dirname "apps/ai/app/settings/page.tsx")"
cat > apps/ai/app/settings/page.tsx << 'ECR_FILE_EOF'
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./Settings.module.css";

type RuntimeSnapshot = {
  revision: number;
  settings: {
    hostedProvider: "anthropic" | "openrouter" | "openai";
    localRuntime: "openai-compatible";
    localBaseUrl: string;
    localModelTag: string;
    hostedCallsEnabled: boolean;
  };
};
type Credential = { provider: string; purpose: string; generation: number; updatedAt: string };
type McpServer = {
  id: string;
  displayName: string;
  enabled: boolean;
  workspaceIds: string[];
  transport: unknown;
  toolPolicies: unknown[];
};

const PERSONAL_WORKSPACE_ID = "ws_personal";

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const text = await response.text();
  let payload: unknown = null;

  if (text.length > 0) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      if (!response.ok) {
        throw new Error(`HTTP ${String(response.status)}: ${text.slice(0, 240)}`);
      }
      throw new Error(`HTTP ${String(response.status)} returned a non-JSON response.`);
    }
  }

  if (!response.ok) {
    const error =
      typeof payload === "object" && payload !== null
        ? (payload as { error?: { message?: unknown } }).error
        : undefined;
    const message = typeof error?.message === "string" ? error.message : undefined;
    throw new Error(message ?? `HTTP ${String(response.status)}`);
  }

  return payload as T;
}

export default function SettingsPage() {
  const [runtime, setRuntime] = useState<RuntimeSnapshot | null>(null);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [workspaceId, setWorkspaceId] = useState(PERSONAL_WORKSPACE_ID);
  const [servers, setServers] = useState<McpServer[]>([]);
  const [secret, setSecret] = useState("");
  const [secretProvider, setSecretProvider] = useState("anthropic");
  const [mcpJson, setMcpJson] = useState("");
  const [status, setStatus] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [mcpLoading, setMcpLoading] = useState(false);
  const actionInFlight = useRef(false);
  const mcpLoadRequestRef = useRef(0);
  const workspaceIdRef = useRef(workspaceId);

  function beginAction(action: string): boolean {
    if (actionInFlight.current) return false;
    actionInFlight.current = true;
    setPendingAction(action);
    return true;
  }

  function finishAction(): void {
    actionInFlight.current = false;
    setPendingAction(null);
  }

  const refresh = useCallback(async () => {
    try {
      const [runtimeResult, credentialResult] = await Promise.all([
        json<RuntimeSnapshot>("/api/settings/settings/runtime"),
        json<{ credentials: Credential[] }>("/api/settings/settings/credentials"),
      ]);
      setRuntime(runtimeResult);
      setCredentials(credentialResult.credentials);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }, []);

  const refreshCredentials = useCallback(async () => {
    const result = await json<{ credentials: Credential[] }>(
      "/api/settings/settings/credentials",
    );
    setCredentials(result.credentials);
  }, []);

  const refreshMcp = useCallback(async () => {
    const requestId = ++mcpLoadRequestRef.current;
    const requestedWorkspace = workspaceId;
    setMcpLoading(true);
    try {
      const result = await json<{ servers: McpServer[] }>(
        `/api/settings/settings/mcp/servers?workspaceId=${encodeURIComponent(requestedWorkspace)}`,
      );
      if (
        requestId !== mcpLoadRequestRef.current ||
        workspaceIdRef.current !== requestedWorkspace
      )
        return;
      setServers(result.servers);
      setStatus(`Loaded ${String(result.servers.length)} MCP server configuration(s).`);
    } catch (error) {
      if (requestId === mcpLoadRequestRef.current) {
        setStatus(error instanceof Error ? error.message : String(error));
      }
    } finally {
      if (requestId === mcpLoadRequestRef.current) setMcpLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => void refresh(), [refresh]);

  const mutableLocalModel =
    runtime !== null && /(^|[:@])latest$/i.test(runtime.settings.localModelTag.trim());

  async function saveRuntime() {
    if (runtime === null || !beginAction("runtime")) return;
    const requestedHosted = runtime.settings.hostedCallsEnabled;
    setStatus("Saving runtime settings…");
    try {
      const result = await json<RuntimeSnapshot>("/api/settings/settings/runtime", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(runtime.settings),
      });
      setRuntime(result);
      if (requestedHosted && !result.settings.hostedCallsEnabled) {
        setStatus(
          `Runtime revision ${String(result.revision)} saved. Hosted remains OFF because the operator gate is closed.`,
        );
      } else {
        setStatus(`Runtime settings saved at revision ${String(result.revision)}.`);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      finishAction();
    }
  }
  async function saveCredential() {
    if (!beginAction("credential")) return;
    setStatus("Encrypting credential…");
    try {
      await json(`/api/settings/settings/credentials/${secretProvider}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      setSecret("");
      await refreshCredentials();
      setStatus("Credential encrypted in Connect vault. Plaintext was not returned.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      finishAction();
    }
  }
  async function runCanary() {
    if (!beginAction("canary")) return;
    setStatus("Running local canary…");
    try {
      const result = await json<{
        pass: boolean;
        latencyMs: number;
        provider: string;
        model: string;
      }>("/api/settings/ops/provider-canary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target: "local" }),
      });
      setStatus(
        `Canary ${result.pass ? "PASS" : "FAIL"}: ${result.provider}/${result.model} ${result.latencyMs.toFixed(1)}ms`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      finishAction();
    }
  }
  async function saveMcpServer() {
    if (!beginAction("mcp")) return;
    setStatus("Validating and saving MCP server…");
    try {
      const parsed = JSON.parse(mcpJson) as McpServer;
      await json(`/api/settings/settings/mcp/servers/${encodeURIComponent(parsed.id)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed),
      });
      await refreshMcp();
      setStatus(
        "MCP server configuration saved. Execution permission is still evaluated separately.",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      finishAction();
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Control Center</h1>
        </div>
      </header>
      {status ? (
        <p className={styles.status} aria-live="polite" role="status">
          {status}
        </p>
      ) : null}

      <section className={styles.section}>
        <h2>Runtime</h2>
        {runtime === null ? (
          <p className={styles.muted}>Runtime state is loading.</p>
        ) : (
          <div className={styles.formGrid}>
            <label>
              Hosted provider
              <select
                value={runtime.settings.hostedProvider}
                disabled={pendingAction !== null}
                onChange={(event) =>
                  setRuntime({
                    ...runtime,
                    settings: {
                      ...runtime.settings,
                      hostedProvider: event.target
                        .value as RuntimeSnapshot["settings"]["hostedProvider"],
                    },
                  })
                }
              >
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
                <option value="openrouter">OpenRouter</option>
              </select>
            </label>
            <label>
              Local model
              <input
                value={runtime.settings.localModelTag}
                disabled={pendingAction !== null}
                onChange={(event) =>
                  setRuntime({
                    ...runtime,
                    settings: { ...runtime.settings, localModelTag: event.target.value },
                  })
                }
              />
            </label>
            <label className={styles.wide}>
              Local base URL
              <input
                value={runtime.settings.localBaseUrl}
                disabled={pendingAction !== null}
                onChange={(event) =>
                  setRuntime({
                    ...runtime,
                    settings: { ...runtime.settings, localBaseUrl: event.target.value },
                  })
                }
              />
            </label>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={runtime.settings.hostedCallsEnabled}
                disabled={pendingAction !== null}
                onChange={(event) =>
                  setRuntime({
                    ...runtime,
                    settings: { ...runtime.settings, hostedCallsEnabled: event.target.checked },
                  })
                }
              />
              Hosted calls enabled
            </label>
            {mutableLocalModel ? (
              <p className={`${styles.warning} ${styles.wide}`}>
                Local model memakai alias mutable <code>{runtime.settings.localModelTag}</code>.
                Cocok untuk rehearsal, belum immutable production identity.
              </p>
            ) : null}
            <p className={`${styles.muted} ${styles.wide}`}>
              Operator kill switch selalu menang, terlepas dari pengaturan di atas.
            </p>
            <div className={styles.actions}>
              <button
                type="button"
                disabled={pendingAction !== null}
                onClick={() => void saveRuntime()}
              >
                {pendingAction === "runtime" ? "Saving…" : "Save runtime"}
              </button>
              <button
                type="button"
                className={styles.secondary}
                disabled={pendingAction !== null}
                onClick={() => void runCanary()}
              >
                {pendingAction === "canary" ? "Running…" : "Run local canary"}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2>Credential vault</h2>
        <p className={styles.muted}>
          Stored metadata:{" "}
          {credentials.length === 0
            ? "no credentials"
            : credentials
                .map((item) => `${item.provider} g${String(item.generation)}`)
                .join(", ")}
        </p>
        <div className={styles.inline}>
          <select
            aria-label="Credential provider"
            value={secretProvider}
            disabled={pendingAction !== null}
            onChange={(event) => setSecretProvider(event.target.value)}
          >
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
            <option value="openrouter">OpenRouter</option>
            <option value="mcp">MCP token</option>
          </select>
          <input
            type="password"
            autoComplete="new-password"
            placeholder="New secret"
            aria-label="New credential secret"
            value={secret}
            disabled={pendingAction !== null}
            onChange={(event) => setSecret(event.target.value)}
          />
          <button
            type="button"
            disabled={secret.length === 0 || pendingAction !== null}
            onClick={() => void saveCredential()}
          >
            {pendingAction === "credential" ? "Encrypting…" : "Encrypt & save"}
          </button>
        </div>
      </section>

      <section className={styles.section}>
        <h2>MCP servers</h2>
        <div className={styles.inline}>
          <input
            aria-label="MCP workspace id"
            value={workspaceId}
            disabled={mcpLoading || pendingAction !== null}
            onChange={(event) => {
              workspaceIdRef.current = event.target.value;
              setWorkspaceId(event.target.value);
            }}
          />
          <button
            type="button"
            className={styles.secondary}
            disabled={mcpLoading || pendingAction !== null}
            onClick={() => void refreshMcp()}
          >
            {mcpLoading ? "Loading…" : "Load workspace"}
          </button>
        </div>
        <div className={styles.serverList}>
          {servers.map((server) => (
            <button
              type="button"
              className={styles.server}
              key={server.id}
              onClick={() => setMcpJson(JSON.stringify(server, null, 2))}
            >
              <strong>{server.displayName}</strong>
              <span>
                {server.enabled ? "enabled" : "disabled"} · {server.id}
              </span>
            </button>
          ))}
        </div>
        <textarea
          rows={12}
          spellCheck={false}
          value={mcpJson}
          disabled={pendingAction !== null}
          onChange={(event) => setMcpJson(event.target.value)}
          aria-label="MCP server JSON"
          placeholder='{"id":"example","displayName":"Example","enabled":false,"workspaceIds":["ws_personal"],"transport":{"type":"streamable-http","url":"https://example.com/mcp"},"toolPolicies":[],"connectTimeoutMs":10000,"requestTimeoutMs":30000}'
        />
        <div className={styles.actions}>
          <button
            type="button"
            disabled={mcpJson.trim().length === 0 || pendingAction !== null}
            onClick={() => void saveMcpServer()}
          >
            {pendingAction === "mcp" ? "Saving…" : "Validate & save MCP server"}
          </button>
        </div>
        <p className={styles.muted}>
          Saving a server does not grant node/tool authority. Tool policies and Hub governance
          remain separate execution gates.
        </p>
      </section>
    </main>
  );
}
ECR_FILE_EOF

echo "==> Rebuild @ecorione/shared-ui (memastikan dist konsisten dengan source)"
pnpm --filter @ecorione/shared-ui run build

echo "==> Selesai. Restart dev server (Ctrl+C lalu 'pnpm dev' lagi) dan hard-refresh browser (Ctrl+Shift+R)."
