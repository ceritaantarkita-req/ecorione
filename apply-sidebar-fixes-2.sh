#!/usr/bin/env bash
# Menerapkan perbaikan sidebar (ikon, mobile drawer, ikon tema) ke clone ecorione ini.
# Jalankan dari root repo ecorione, contoh:
#   cd ~/projects/ecorione && bash apply-sidebar-fixes-2.sh
set -euo pipefail

if [[ ! -f "package.json" ]] || ! grep -q '"name": "ecorione"' package.json 2>/dev/null; then
  if [[ ! -d "apps/ai" || ! -d "packages/shared-ui" ]]; then
    echo "Error: jalankan script ini dari root repo ecorione (folder yang berisi apps/ai dan packages/shared-ui)." >&2
    exit 1
  fi
fi

echo "==> Menulis apps/ai/app/ProductNav.tsx"
cat > apps/ai/app/ProductNav.tsx << 'FILE_EOF'
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

const MOBILE_BREAKPOINT_QUERY = "(max-width: 780px)";

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

/** Ikon matahari — dipakai untuk tombol tema terang, gaya sama dengan `NavIcon`. */
function SunIcon() {
  return (
    <svg
      className="ecr-theme-switch__icon"
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="10" cy="10" r="3.3" />
      <path d="M10 2.4v2.1M10 15.5v2.1M17.6 10h-2.1M4.5 10H2.4M15.4 4.6l-1.5 1.5M6.1 13.9l-1.5 1.5M15.4 15.4l-1.5-1.5M6.1 6.1 4.6 4.6" />
    </svg>
  );
}

/** Ikon bulan sabit — tombol tema gelap. */
function MoonIcon() {
  return (
    <svg
      className="ecr-theme-switch__icon"
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M16.1 12.4A6.35 6.35 0 0 1 7.6 3.9a6.7 6.7 0 1 0 8.5 8.5Z" />
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
  const [isNarrow, setIsNarrow] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const initialTheme = readBrowserTheme();
    applyTheme(initialTheme, document.documentElement);
    setTheme(initialTheme);

    const initialCollapsed = readBrowserSidebarCollapsed();
    applySidebarCollapsed(initialCollapsed, document.documentElement);
    setCollapsed(initialCollapsed);
  }, []);

  // Rel navigasi jadi drawer di layar sempit (lihat navigation.css), jadi butuh tahu
  // apakah kita sedang di bawah breakpoint mobile untuk memutuskan apa yang tombol
  // collapse lakukan dan bagaimana ikonnya harus tampak.
  useEffect(() => {
    const query = window.matchMedia(MOBILE_BREAKPOINT_QUERY);
    const update = () => setIsNarrow(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // Tutup drawer mobile begitu pengguna berpindah halaman — pola drawer standar.
  useEffect(() => {
    setMobileNavOpen(false);
    document.documentElement.removeAttribute("data-mobile-nav");
  }, [pathname]);

  function chooseTheme(choice: ThemeChoice): void {
    applyTheme(choice, document.documentElement);
    try {
      persistTheme(choice, window.localStorage);
    } catch {
      // The visible theme should still change even when browser storage is unavailable.
    }
    setTheme(choice);
  }

  function closeMobileNav(): void {
    setMobileNavOpen(false);
    document.documentElement.removeAttribute("data-mobile-nav");
  }

  function toggleNav(): void {
    if (isNarrow) {
      setMobileNavOpen((prev) => {
        const next = !prev;
        if (next) {
          document.documentElement.setAttribute("data-mobile-nav", "open");
        } else {
          document.documentElement.removeAttribute("data-mobile-nav");
        }
        return next;
      });
      return;
    }
    const next = !(collapsed ?? false);
    applySidebarCollapsed(next, document.documentElement);
    try {
      persistSidebarCollapsed(next, window.localStorage);
    } catch {
      // The sidebar should still toggle even when browser storage is unavailable.
    }
    setCollapsed(next);
  }

  // Status visual gabungan: di desktop ini mengikuti state collapse tersimpan; di mobile,
  // rel selalu tampil ikon-saja secara default dan "collapsed" di sini berarti drawer-nya
  // sedang tertutup (lihat blok `@media (max-width: 780px)` di navigation.css).
  const visuallyCollapsed = isNarrow ? !mobileNavOpen : (collapsed ?? false);

  return (
    <nav className="ecr-global-nav" aria-label="Navigasi utama ecorione">
      <div className="ecr-global-nav__inner">
        <div className="ecr-global-nav__brand-row">
          <Link className="ecr-global-nav__brand" href="/" aria-label="ecorione — Ai">
            <SealMark />
            <span className="ecr-global-nav__brand-label">ecorione</span>
          </Link>
          <button
            type="button"
            className="ecr-global-nav__collapse-btn"
            aria-label={visuallyCollapsed ? "Buka sidebar" : "Ciutkan sidebar"}
            aria-expanded={!visuallyCollapsed}
            onClick={toggleNav}
          >
            <CollapseIcon collapsed={visuallyCollapsed} />
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
                title={visuallyCollapsed ? label : undefined}
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
            title={visuallyCollapsed ? "Terang" : undefined}
            onClick={() => chooseTheme("light")}
          >
            <SunIcon />
            <span className="ecr-global-nav__label">Terang</span>
          </button>
          <button
            type="button"
            className={
              theme === "dark" ? "ecr-theme-switch__item is-active" : "ecr-theme-switch__item"
            }
            aria-pressed={theme === "dark"}
            aria-label="Gunakan tema gelap"
            title={visuallyCollapsed ? "Gelap" : undefined}
            onClick={() => chooseTheme("dark")}
          >
            <MoonIcon />
            <span className="ecr-global-nav__label">Gelap</span>
          </button>
        </div>
      </div>

      {mobileNavOpen ? (
        <button
          type="button"
          className="ecr-global-nav__backdrop"
          aria-label="Tutup navigasi"
          onClick={closeMobileNav}
        />
      ) : null}
    </nav>
  );
}
FILE_EOF

echo "==> Menulis apps/ai/app/navigation.css"
cat > apps/ai/app/navigation.css << 'FILE_EOF'
/*
 * Sidebar navigasi kiri, collapsible — kontrak atribut: `data-sidebar="collapsed"` di <html>,
 * dipasang oleh `SIDEBAR_BOOTSTRAP_SCRIPT` sebelum cat pertama dan oleh `ProductNav` saat
 * pengguna menekan tombol collapse (`packages/shared-ui/src/sidebar.ts`). Di layar sempit
 * (`@media (max-width: 780px)` di bawah), atribut yang dipakai berbeda: `data-mobile-nav="open"`,
 * transient (tidak disimpan), mengontrol drawer yang melayang di atas rel ikon.
 *
 * `.ecr-global-nav` (luar) HANYA mengurus posisi & lebar rel — lebarnya tidak pernah berubah
 * saat drawer mobile dibuka/ditutup, supaya `.ecr-app-content` di sebelahnya tidak pernah
 * "kedorong" atau berantakan. `.ecr-global-nav__inner` (dalam) yang membesar jadi drawer
 * lewat `position: absolute`, melayang di atas konten tanpa memengaruhi tata letak luar.
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
  border-right: 1px solid var(--border);
  background: var(--surface);
  transition: width 160ms ease;
}

html[data-sidebar="collapsed"] .ecr-global-nav {
  --ecr-sidebar-w: var(--ecr-sidebar-width-collapsed);
}

.ecr-global-nav__inner {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  padding: 14px 10px;
  overflow-x: hidden;
  overflow-y: auto;
  background: var(--surface);
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
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
  min-height: 38px;
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
  width: 18px;
  height: 18px;
  flex: none;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.ecr-global-nav__link--active .ecr-global-nav__icon {
  stroke: var(--accent);
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
  min-height: 32px;
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

.ecr-theme-switch__icon {
  flex: none;
  width: 17px;
  height: 17px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.ecr-theme-switch__item:hover,
.ecr-theme-switch__item:focus-visible {
  color: var(--text);
}

.ecr-theme-switch__item.is-active {
  background: var(--surface-3);
  color: var(--text);
}

.ecr-theme-switch__item.is-active .ecr-theme-switch__icon {
  stroke: var(--accent);
}

/* Collapsed (desktop): sembunyikan label teks, sisakan ikon rata tengah + tooltip lewat `title`. */
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

/* Ekstra tak terlihat penting: `.ecr-global-nav__backdrop` di-render hanya saat drawer
   mobile terbuka (lihat `ProductNav`), tapi tetap disembunyikan di layar lebar untuk jaga-jaga. */
.ecr-global-nav__backdrop {
  display: none;
}

@media (max-width: 780px) {
  .ecr-global-nav {
    --ecr-sidebar-w: var(--ecr-sidebar-width-collapsed);
  }

  .ecr-global-nav__label,
  .ecr-global-nav__brand-label {
    display: none;
  }

  .ecr-global-nav__brand-row {
    flex-direction: column;
    height: auto;
    gap: 10px;
  }

  .ecr-global-nav__link,
  .ecr-theme-switch__item {
    justify-content: center;
    padding: 0;
  }

  /* Drawer terbuka: hanya `__inner` yang membesar & melayang (absolute), rel luar
     (`.ecr-global-nav`) tetap 60px sepanjang waktu — jadi tidak ada reflow konten. */
  html[data-mobile-nav="open"] .ecr-global-nav__inner {
    position: absolute;
    top: 0;
    left: 0;
    width: min(80vw, 264px);
    height: 100dvh;
    z-index: 210;
    border-right: 1px solid var(--border);
    box-shadow: 0 16px 44px rgba(10, 9, 6, 0.4);
  }

  html[data-mobile-nav="open"] .ecr-global-nav__label,
  html[data-mobile-nav="open"] .ecr-global-nav__brand-label {
    display: inline;
  }

  html[data-mobile-nav="open"] .ecr-global-nav__brand-row {
    flex-direction: row;
    height: auto;
  }

  html[data-mobile-nav="open"] .ecr-global-nav__link,
  html[data-mobile-nav="open"] .ecr-theme-switch__item {
    justify-content: flex-start;
    padding: 0 10px;
  }

  html[data-mobile-nav="open"] .ecr-global-nav__backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 205;
    margin: 0;
    padding: 0;
    border: 0;
    background: rgba(10, 9, 6, 0.45);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ecr-global-nav,
  .ecr-global-nav__link,
  .ecr-global-nav__link::before {
    transition: none;
  }
}
FILE_EOF

echo "==> Selesai. Tidak perlu rebuild shared-ui kali ini (hanya file di apps/ai yang berubah)."
echo "==> Restart dev server (Ctrl+C lalu 'pnpm dev' lagi) kalau perubahan belum otomatis ke-refresh, lalu hard-refresh browser (Ctrl+Shift+R)."
