#!/usr/bin/env bash
set -euo pipefail
# Terapkan revisi sidebar kiri + panel kanan collapsible ke working copy ini.
# Jalankan dari root repo (folder yang ada package.json-nya), mis. ~/projects/ecorione
if [ ! -f package.json ] || ! grep -q "\"name\": \"ecorione\"" package.json; then
  echo "Jalankan script ini dari root repo ecorione (folder yang ada package.json)." >&2
  exit 1
fi

mkdir -p "apps/ai/app"
cat > "apps/ai/app/ProductNav.tsx" << 'ECORIONE_EOF_apps_ai_app_ProductNav_tsx'
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  applySidebarCollapsed,
  applyTheme,
  persistSidebarCollapsed,
  persistTheme,
  readStoredSidebarCollapsed,
  readStoredTheme,
  type ThemeChoice,
} from "@ecorione/shared-ui";

const NAV_ITEMS = [
  ["Ai", "/", "ai"],
  ["Space", "/space", "space"],
  ["Flow", "/flow", "flow"],
  ["Operations", "/ops", "ops"],
  ["Settings", "/settings", "settings"],
] as const;

type NavIconKey = (typeof NAV_ITEMS)[number][2];

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SealMark() {
  return (
    <svg
      className="ecr-global-nav__seal"
      viewBox="0 0 28 28"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M14 2.75 24.5 8.8v10.4L14 25.25 3.5 19.2V8.8L14 2.75Z" />
      <path d="M8.1 10.45 14 7.05l5.9 3.4v7.1L14 20.95l-5.9-3.4v-7.1Z" />
      <path d="M14 7.05v13.9M8.1 10.45l11.8 7.1M19.9 10.45l-11.8 7.1" />
    </svg>
  );
}

/** Ikon garis tipis per area produk — konsisten dengan gaya `SealMark` (stroke, tanpa isi). */
function NavIcon({ icon }: { icon: NavIconKey }) {
  const shared = {
    className: "ecr-global-nav__icon",
    viewBox: "0 0 20 20",
    "aria-hidden": true,
    focusable: false,
  } as const;
  switch (icon) {
    case "ai":
      return (
        <svg {...shared}>
          <path d="M3.5 5.5c0-1.1.9-2 2-2h9c1.1 0 2 .9 2 2v6c0 1.1-.9 2-2 2H8.4l-3.4 2.9v-2.9h-1.5c-1.1 0-2-.9-2-2Z" />
        </svg>
      );
    case "space":
      return (
        <svg {...shared}>
          <path d="M5 3h7l3 3v11H5Z" />
          <path d="M12 3v3h3M7.3 10.2h5.4M7.3 13h5.4" />
        </svg>
      );
    case "flow":
      return (
        <svg {...shared}>
          <circle cx="4.7" cy="5" r="1.9" />
          <circle cx="15.3" cy="5" r="1.9" />
          <circle cx="10" cy="15" r="1.9" />
          <path d="M6.3 6.2 8.5 13M13.7 6.2 11.5 13M6.6 5h6.8" />
        </svg>
      );
    case "ops":
      return (
        <svg {...shared}>
          <path d="M2.8 11h3l1.7-5.4L9.9 15l2-8 1.6 4h3.7" />
        </svg>
      );
    case "settings":
      return (
        <svg {...shared}>
          <circle cx="10" cy="10" r="2.7" />
          <path d="M10 3.3v2M10 14.7v2M16.7 10h-2M5.3 10h-2M14.7 5.3l-1.4 1.4M6.7 13.3l-1.4 1.4M14.7 14.7l-1.4-1.4M6.7 6.7 5.3 5.3" />
        </svg>
      );
    default:
      return null;
  }
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      className="ecr-global-nav__collapse-icon"
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3" y="3.5" width="14" height="13" rx="2" />
      <path
        d={collapsed ? "M8.6 6.5v7M13.2 8.6l-2 1.4 2 1.4" : "M8.6 6.5v7M7 8.6l2 1.4-2 1.4"}
      />
    </svg>
  );
}

function rootTheme(): ThemeChoice {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function readBrowserTheme(): ThemeChoice {
  try {
    return readStoredTheme(window.localStorage);
  } catch {
    // Accessing the localStorage property itself can throw in privacy-restricted contexts.
    return rootTheme();
  }
}

function readBrowserSidebarCollapsed(): boolean {
  try {
    return readStoredSidebarCollapsed(window.localStorage);
  } catch {
    return document.documentElement.getAttribute("data-sidebar") === "collapsed";
  }
}

export default function ProductNav() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<ThemeChoice | null>(null);
  const [collapsed, setCollapsed] = useState<boolean | null>(null);

  useEffect(() => {
    const initialTheme = readBrowserTheme();
    applyTheme(initialTheme, document.documentElement);
    setTheme(initialTheme);

    const initialCollapsed = readBrowserSidebarCollapsed();
    applySidebarCollapsed(initialCollapsed, document.documentElement);
    setCollapsed(initialCollapsed);
  }, []);

  function chooseTheme(choice: ThemeChoice): void {
    applyTheme(choice, document.documentElement);
    try {
      persistTheme(choice, window.localStorage);
    } catch {
      // The visible theme should still change even when browser storage is unavailable.
    }
    setTheme(choice);
  }

  function toggleCollapsed(): void {
    const next = !(collapsed ?? false);
    applySidebarCollapsed(next, document.documentElement);
    try {
      persistSidebarCollapsed(next, window.localStorage);
    } catch {
      // The sidebar should still toggle even when browser storage is unavailable.
    }
    setCollapsed(next);
  }

  const isCollapsed = collapsed ?? false;

  return (
    <nav className="ecr-global-nav" aria-label="Navigasi utama ecorione">
      <div className="ecr-global-nav__brand-row">
        <Link className="ecr-global-nav__brand" href="/" aria-label="ecorione — Ai">
          <SealMark />
          <span className="ecr-global-nav__brand-label">ecorione</span>
        </Link>
        <button
          type="button"
          className="ecr-global-nav__collapse-btn"
          aria-label={isCollapsed ? "Buka sidebar" : "Ciutkan sidebar"}
          aria-expanded={!isCollapsed}
          onClick={toggleCollapsed}
        >
          <CollapseIcon collapsed={isCollapsed} />
        </button>
      </div>

      <div className="ecr-global-nav__links" aria-label="Area produk">
        {NAV_ITEMS.map(([label, href, icon]) => {
          const active = isActivePath(pathname, href);
          return (
            <Link
              className={`ecr-global-nav__link${active ? " ecr-global-nav__link--active" : ""}`}
              href={href}
              key={href}
              aria-current={active ? "page" : undefined}
              title={isCollapsed ? label : undefined}
            >
              <NavIcon icon={icon} />
              <span className="ecr-global-nav__label">{label}</span>
            </Link>
          );
        })}
      </div>

      <div className="ecr-theme-switch" role="group" aria-label="Tema tampilan">
        <button
          type="button"
          className={
            theme === "light" ? "ecr-theme-switch__item is-active" : "ecr-theme-switch__item"
          }
          aria-pressed={theme === "light"}
          aria-label="Gunakan tema terang"
          title={isCollapsed ? "Terang" : undefined}
          onClick={() => chooseTheme("light")}
        >
          <span className="ecr-theme-switch__glyph" aria-hidden="true">
            ○
          </span>
          <span className="ecr-global-nav__label">Terang</span>
        </button>
        <button
          type="button"
          className={
            theme === "dark" ? "ecr-theme-switch__item is-active" : "ecr-theme-switch__item"
          }
          aria-pressed={theme === "dark"}
          aria-label="Gunakan tema gelap"
          title={isCollapsed ? "Gelap" : undefined}
          onClick={() => chooseTheme("dark")}
        >
          <span className="ecr-theme-switch__glyph" aria-hidden="true">
            ●
          </span>
          <span className="ecr-global-nav__label">Gelap</span>
        </button>
      </div>
    </nav>
  );
}
ECORIONE_EOF_apps_ai_app_ProductNav_tsx

mkdir -p "apps/ai/app"
cat > "apps/ai/app/globals.css" << 'ECORIONE_EOF_apps_ai_app_globals_css'
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
  min-height: calc(100dvh - var(--app-nav-height));
  display: flex;
  flex-direction: column;
}

.ai-topbar {
  width: min(100%, var(--content-max));
  margin: 0 auto;
  padding: 30px 28px 20px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-lg);
  border-bottom: 1px solid var(--border);
}

.ai-topbar__title {
  font-size: clamp(24px, 3.4vw, 38px);
  line-height: 1.05;
  letter-spacing: -0.025em;
}

.ai-topbar__lead {
  margin: 7px 0 0;
  color: var(--text-muted);
  font-size: 11.5px;
  line-height: 1.55;
}

.ai-topbar__session {
  max-width: 260px;
  overflow: hidden;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-main {
  width: min(100%, var(--content-max));
  flex: 1;
  margin: 0 auto;
  padding: 0 28px 56px;
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

.ai-route-control {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 11px 0 9px;
  border-top: 1px solid var(--border);
}

.ai-route-control__label {
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.ai-route-control__select {
  width: 118px;
}

.ai-route-control__hint {
  min-width: min(100%, 300px);
  flex: 1;
  color: var(--text-muted);
  font-size: 10.5px;
}

.ai-composer {
  position: sticky;
  bottom: 0;
  z-index: 10;
  margin: 0 -10px;
  padding: 10px 10px max(10px, env(safe-area-inset-bottom));
  display: flex;
  align-items: flex-end;
  gap: 8px;
  background: color-mix(in srgb, var(--bg) 94%, transparent);
  backdrop-filter: blur(14px);
}

.ai-composer__field {
  min-height: 48px;
  max-height: 200px;
  flex: 1;
  resize: vertical;
  padding: 12px 13px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
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
  .ai-topbar {
    padding: 22px 16px 15px;
    align-items: flex-start;
    flex-direction: column;
  }

  .ai-topbar__session {
    max-width: 100%;
  }

  .ai-main {
    padding: 0 16px 38px;
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

  .ai-route-control {
    align-items: flex-start;
  }

  .ai-route-control__hint {
    flex-basis: 100%;
  }

  .ai-composer {
    margin-inline: -6px;
    padding-inline: 6px;
  }

  .ai-composer .ecr-btn {
    min-width: 68px;
    min-height: 44px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ecr-btn {
    transition: none;
  }
}
ECORIONE_EOF_apps_ai_app_globals_css

mkdir -p "apps/ai/app"
cat > "apps/ai/app/layout.tsx" << 'ECORIONE_EOF_apps_ai_app_layout_tsx'
import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, Manrope } from "next/font/google";
import type { CSSProperties, ReactNode } from "react";
import { SIDEBAR_BOOTSTRAP_SCRIPT, THEME_BOOTSTRAP_SCRIPT } from "@ecorione/shared-ui";
import ProductNav from "./ProductNav";
import "./globals.css";
import "./navigation.css";

const displayFont = Fraunces({
  subsets: ["latin"],
  variable: "--ecr-font-display",
  display: "swap",
});

const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--ecr-font-body",
  display: "swap",
});

const monoFont = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--ecr-font-mono",
  display: "swap",
});

const appFontTokens = {
  "--font-display": "var(--ecr-font-display)",
  "--font-body": "var(--ecr-font-body)",
  "--font-mono": "var(--ecr-font-mono)",
} as CSSProperties;

export const metadata: Metadata = {
  title: "ecorione — Ai",
  description:
    "Workspace local-first ecorione untuk Ai, Space, Flow, Operations, dan pengaturan runtime.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: SIDEBAR_BOOTSTRAP_SCRIPT }} />
      </head>
      <body style={appFontTokens}>
        <div className="ecr-app-shell">
          <ProductNav />
          <div className="ecr-app-content">{children}</div>
        </div>
      </body>
    </html>
  );
}
ECORIONE_EOF_apps_ai_app_layout_tsx

mkdir -p "apps/ai/app"
cat > "apps/ai/app/navigation.css" << 'ECORIONE_EOF_apps_ai_app_navigation_css'
/*
 * Sidebar navigasi kiri, collapsible — kontrak atribut: `data-sidebar="collapsed"` di <html>,
 * dipasang oleh `SIDEBAR_BOOTSTRAP_SCRIPT` sebelum cat pertama dan oleh `ProductNav` saat
 * pengguna menekan tombol collapse (`packages/shared-ui/src/sidebar.ts`).
 */
.ecr-global-nav {
  --ecr-sidebar-w: var(--ecr-sidebar-width);
  position: sticky;
  top: 0;
  z-index: 100;
  flex: none;
  align-self: flex-start;
  width: var(--ecr-sidebar-w);
  height: 100dvh;
  overflow-x: hidden;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  padding: 14px 10px;
  border-right: 1px solid var(--border);
  background: var(--surface);
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
  transition: width 160ms ease;
}

html[data-sidebar="collapsed"] .ecr-global-nav {
  --ecr-sidebar-w: var(--ecr-sidebar-width-collapsed);
}

.ecr-global-nav__brand-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 0 4px;
}

.ecr-global-nav__brand {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  flex: 1;
  color: var(--text);
  text-decoration: none;
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.ecr-global-nav__brand-label {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.ecr-global-nav__seal {
  width: 23px;
  height: 23px;
  flex: none;
  fill: none;
  stroke: var(--accent);
  stroke-width: 1.05;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.ecr-global-nav__collapse-btn {
  flex: none;
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.ecr-global-nav__collapse-btn:hover,
.ecr-global-nav__collapse-btn:focus-visible {
  color: var(--text);
  background: var(--surface-2);
}

.ecr-global-nav__collapse-icon {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.15;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.ecr-global-nav__links {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.ecr-global-nav__link {
  position: relative;
  flex: none;
  min-height: 36px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  gap: 11px;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  font-size: 12.5px;
  font-weight: 550;
  text-decoration: none;
  white-space: nowrap;
  transition:
    color 140ms ease,
    background 140ms ease;
}

.ecr-global-nav__icon {
  width: 17px;
  height: 17px;
  flex: none;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.15;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.ecr-global-nav__label {
  overflow: hidden;
  text-overflow: ellipsis;
}

.ecr-global-nav__link::before {
  content: "";
  position: absolute;
  left: -10px;
  top: 4px;
  bottom: 4px;
  width: 2px;
  background: transparent;
  transition: background 140ms ease;
}

.ecr-global-nav__link:hover,
.ecr-global-nav__link:focus-visible {
  color: var(--text);
  background: var(--surface-2);
}

.ecr-global-nav__link--active {
  color: var(--text);
  background: var(--surface-2);
}

.ecr-global-nav__link--active::before {
  background: var(--accent);
}

.ecr-theme-switch {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
}

.ecr-theme-switch__item {
  min-height: 30px;
  display: inline-flex;
  align-items: center;
  gap: 11px;
  padding: 0 8px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  font-family: var(--font-body);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}

.ecr-theme-switch__glyph {
  flex: none;
  width: 17px;
  font-size: 12px;
  text-align: center;
}

.ecr-theme-switch__item:hover,
.ecr-theme-switch__item:focus-visible {
  color: var(--text);
}

.ecr-theme-switch__item.is-active {
  background: var(--surface-3);
  color: var(--text);
}

/* Collapsed: sembunyikan label teks, sisakan ikon rata tengah + tooltip lewat `title`. */
html[data-sidebar="collapsed"] .ecr-global-nav__label,
html[data-sidebar="collapsed"] .ecr-global-nav__brand-label {
  display: none;
}

html[data-sidebar="collapsed"] .ecr-global-nav__brand-row {
  flex-direction: column;
  height: auto;
  gap: 10px;
}

html[data-sidebar="collapsed"] .ecr-global-nav__link,
html[data-sidebar="collapsed"] .ecr-theme-switch__item {
  justify-content: center;
  padding: 0;
}

@media (max-width: 780px) {
  .ecr-global-nav {
    --ecr-sidebar-w: var(--ecr-sidebar-width-collapsed);
  }

  html[data-sidebar="collapsed"] .ecr-global-nav {
    --ecr-sidebar-w: 0px;
    padding-inline: 0;
    border-right: 0;
    overflow: hidden;
  }

  html[data-sidebar="collapsed"] .ecr-global-nav__brand-row,
  html[data-sidebar="collapsed"] .ecr-global-nav__links,
  html[data-sidebar="collapsed"] .ecr-theme-switch {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ecr-global-nav,
  .ecr-global-nav__link,
  .ecr-global-nav__link::before {
    transition: none;
  }
}
ECORIONE_EOF_apps_ai_app_navigation_css

mkdir -p "apps/ai/app"
cat > "apps/ai/app/page.tsx" << 'ECORIONE_EOF_apps_ai_app_page_tsx'
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
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [forgettingId, setForgettingId] = useState<string | null>(null);
  const [memoryFeedback, setMemoryFeedback] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);
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
      <main className={`ai-main${panelCollapsed ? " ai-main--panel-collapsed" : ""}`}>
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
ECORIONE_EOF_apps_ai_app_page_tsx

mkdir -p "packages/shared-ui/src"
cat > "packages/shared-ui/src/index.ts" << 'ECORIONE_EOF_packages_shared_ui_src_index_ts'
/**
 * @ecorione/shared-ui
 *
 * Turunan kode dari `design.md`: token warna/tipografi/spacing (§2, §3, §6), kontrak tema
 * terang-gelap (§9), dan perlengkapan dasar (§7). Didefinisikan **sekali** di sini dan
 * diimpor semua modul — jangan menyalin nilai hex atau nama font ke dalam modul.
 *
 * Tanpa dependensi runtime dengan sengaja: paket ini dipakai kode server-rendered maupun
 * browser, dan setiap dependensi di sini jadi dependensi keduanya.
 */

export * from "./tokens.js";
export * from "./css.js";
export * from "./theme.js";
export * from "./sidebar.js";
export * from "./components.js";
ECORIONE_EOF_packages_shared_ui_src_index_ts

mkdir -p "packages/shared-ui/src"
cat > "packages/shared-ui/src/sidebar.ts" << 'ECORIONE_EOF_packages_shared_ui_src_sidebar_ts'
/**
 * Penerapan & penyimpanan status collapse sidebar navigasi kiri.
 *
 * Pola sama persis dengan `theme.ts`: satu atribut (`data-sidebar="collapsed"` di elemen
 * root), storage dibungkus try/catch supaya kegagalan localStorage tidak pernah mematikan
 * halaman, dan bootstrap script inline supaya lebar sidebar sudah benar sebelum cat pertama
 * (mencegah kedipan lebar sidebar yang salah, sama alasannya dengan `THEME_BOOTSTRAP_SCRIPT`).
 */

/** Kunci penyimpanan — sengaja terpisah dari `THEME_STORAGE_KEY`, dua preferensi independen. */
export const SIDEBAR_STORAGE_KEY = "ecorione-sidebar-collapsed";

/**
 * Status collapse saat preferensi tidak diketahui (belum pernah diubah, atau storage gagal
 * dibaca). Default tidak collapse — sidebar penuh label saat pertama kali dibuka, konsisten
 * dengan `design.md` yang tidak pernah mengasumsikan pengguna sudah tahu ikon mana yang mana.
 */
export const DEFAULT_SIDEBAR_COLLAPSED = false;

/**
 * Permukaan minimal `localStorage` yang benar-benar dipakai. Sama strukturnya dengan
 * `ThemeStorage` di `theme.ts` — dideklarasikan ulang di sini (bukan diimpor) supaya modul ini
 * tetap bisa dibaca berdiri sendiri tanpa harus melompat ke file tema untuk tahu bentuk kontrak
 * storage-nya.
 */
export interface SidebarStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Pasang/lepas status collapse ke elemen root.
 *
 * `root` wajib dioper, tidak diam-diam mengambil `document.documentElement`: paket ini juga
 * diimpor kode server-rendered, dan menyentuh `document` di sana melempar.
 */
export function applySidebarCollapsed(collapsed: boolean, root: Element): void {
  if (collapsed) {
    root.setAttribute("data-sidebar", "collapsed");
  } else {
    root.removeAttribute("data-sidebar");
  }
}

/**
 * Baca preferensi tersimpan.
 *
 * Akses storage dibungkus try/catch karena `localStorage` bukan cuma bisa penuh — di beberapa
 * konteks (iframe pihak ketiga, Safari private mode, browser yang memblokir site data)
 * **mengakses propertinya saja sudah melempar**. Sidebar yang membuat halaman mati gara-gara
 * mengingat preferensi lebar adalah bug, bukan fitur; setiap kegagalan jatuh ke
 * {@link DEFAULT_SIDEBAR_COLLAPSED}.
 */
export function readStoredSidebarCollapsed(storage: SidebarStorage): boolean {
  try {
    return storage.getItem(SIDEBAR_STORAGE_KEY) === "1";
  } catch {
    return DEFAULT_SIDEBAR_COLLAPSED;
  }
}

/**
 * Simpan preferensi. Gagal menyimpan tidak pernah dipropagasikan — pengguna kehilangan
 * ingatan preferensi, bukan halamannya. Mengembalikan `false` kalau penyimpanan gagal, supaya
 * pemanggil yang peduli bisa tahu tanpa harus menangkap exception sendiri.
 */
export function persistSidebarCollapsed(collapsed: boolean, storage: SidebarStorage): boolean {
  try {
    storage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "1" : "0");
    return true;
  } catch {
    return false;
  }
}

/**
 * Snippet inline untuk `<head>`, **sebelum** konten dirender.
 *
 * Kenapa inline dan sinkron: kalau atribut `data-sidebar` baru dipasang setelah bundle JS
 * dimuat, sidebar sempat tampil lebar penuh lalu melompat ke lebar collapsed (atau
 * sebaliknya) begitu hydration selesai. Satu blok kecil tanpa dependensi di `<head>`
 * menghilangkan jendela lompatan-layout itu — sama alasannya dengan `THEME_BOOTSTRAP_SCRIPT`.
 *
 * Ditulis ES5 dan defensif dengan sengaja: ia jalan sebelum apa pun yang lain, jadi ia tidak
 * boleh mengandalkan bundler, polyfill, atau storage yang bisa diakses.
 */
export const SIDEBAR_BOOTSTRAP_SCRIPT = `(function(){
  try {
    var saved = localStorage.getItem(${JSON.stringify(SIDEBAR_STORAGE_KEY)});
    if (saved === '1') document.documentElement.setAttribute('data-sidebar', 'collapsed');
  } catch (e) {}
})();`;
ECORIONE_EOF_packages_shared_ui_src_sidebar_ts

mkdir -p "packages/shared-ui/src"
cat > "packages/shared-ui/src/sidebar.test.ts" << 'ECORIONE_EOF_packages_shared_ui_src_sidebar_test_ts'
import { describe, expect, it } from "vitest";

import {
  applySidebarCollapsed,
  DEFAULT_SIDEBAR_COLLAPSED,
  persistSidebarCollapsed,
  readStoredSidebarCollapsed,
  SIDEBAR_BOOTSTRAP_SCRIPT,
  SIDEBAR_STORAGE_KEY,
  type SidebarStorage,
} from "./sidebar.js";

function memoryStorage(initial?: string): SidebarStorage {
  const map = new Map<string, string>();
  if (initial !== undefined) map.set(SIDEBAR_STORAGE_KEY, initial);
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

/** Storage yang melempar bahkan saat dibaca — Safari private mode, iframe yang diblokir. */
const hostileStorage: SidebarStorage = {
  getItem() {
    throw new Error("storage diblokir");
  },
  setItem() {
    throw new Error("storage diblokir");
  },
};

describe("readStoredSidebarCollapsed", () => {
  it("mengembalikan status tersimpan", () => {
    expect(readStoredSidebarCollapsed(memoryStorage("1"))).toBe(true);
    expect(readStoredSidebarCollapsed(memoryStorage("0"))).toBe(false);
  });

  it("jatuh ke default kalau kosong atau nilainya tidak dikenal", () => {
    expect(readStoredSidebarCollapsed(memoryStorage())).toBe(DEFAULT_SIDEBAR_COLLAPSED);
    expect(readStoredSidebarCollapsed(memoryStorage("expanded"))).toBe(
      DEFAULT_SIDEBAR_COLLAPSED,
    );
  });

  it("tidak melempar saat storage sendiri melempar", () => {
    expect(() => readStoredSidebarCollapsed(hostileStorage)).not.toThrow();
    expect(readStoredSidebarCollapsed(hostileStorage)).toBe(DEFAULT_SIDEBAR_COLLAPSED);
  });
});

describe("persistSidebarCollapsed", () => {
  it("menyimpan dan bisa dibaca ulang", () => {
    const storage = memoryStorage();
    expect(persistSidebarCollapsed(true, storage)).toBe(true);
    expect(readStoredSidebarCollapsed(storage)).toBe(true);
    expect(persistSidebarCollapsed(false, storage)).toBe(true);
    expect(readStoredSidebarCollapsed(storage)).toBe(false);
  });

  it("melaporkan gagal tanpa melempar", () => {
    expect(persistSidebarCollapsed(true, hostileStorage)).toBe(false);
  });
});

describe("applySidebarCollapsed", () => {
  it("menyetel data-sidebar=collapsed saat true", () => {
    const seen: string[] = [];
    const root = {
      setAttribute(name: string, value: string) {
        seen.push(`set ${name}=${value}`);
      },
      removeAttribute(name: string) {
        seen.push(`remove ${name}`);
      },
    } as unknown as Element;
    applySidebarCollapsed(true, root);
    expect(seen).toEqual(["set data-sidebar=collapsed"]);
  });

  it("melepas atribut saat false, tidak menyetel nilai kosong", () => {
    const seen: string[] = [];
    const root = {
      setAttribute(name: string, value: string) {
        seen.push(`set ${name}=${value}`);
      },
      removeAttribute(name: string) {
        seen.push(`remove ${name}`);
      },
    } as unknown as Element;
    applySidebarCollapsed(false, root);
    expect(seen).toEqual(["remove data-sidebar"]);
  });
});

describe("SIDEBAR_BOOTSTRAP_SCRIPT", () => {
  it("sinkron, dibungkus try/catch, dan memakai kunci yang sama", () => {
    // Kalau atribut baru dipasang setelah bundle dimuat, sidebar sempat melompat lebar.
    expect(SIDEBAR_BOOTSTRAP_SCRIPT).toContain(SIDEBAR_STORAGE_KEY);
    expect(SIDEBAR_BOOTSTRAP_SCRIPT).toContain("try {");
    expect(SIDEBAR_BOOTSTRAP_SCRIPT).toContain("data-sidebar");
    expect(SIDEBAR_BOOTSTRAP_SCRIPT).not.toContain("await");
  });
});
ECORIONE_EOF_packages_shared_ui_src_sidebar_test_ts

echo "Semua file diperbarui. Membangun ulang packages/shared-ui..."
pnpm --filter @ecorione/shared-ui run build
echo "Selesai. Restart pnpm dev (Ctrl+C lalu jalankan lagi), lalu refresh localhost:3000."
