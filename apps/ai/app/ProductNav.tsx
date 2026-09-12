"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  applyTheme,
  persistTheme,
  readStoredTheme,
  type ThemeChoice,
} from "@ecorione/shared-ui";

const NAV_ITEMS = [
  ["Ai", "/"],
  ["Space", "/space"],
  ["Flow", "/flow"],
  ["Operations", "/ops"],
  ["Settings", "/settings"],
] as const;

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

export default function ProductNav() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<ThemeChoice | null>(null);

  useEffect(() => {
    const initial = readStoredTheme(window.localStorage);
    applyTheme(initial, document.documentElement);
    setTheme(initial);
  }, []);

  function chooseTheme(choice: ThemeChoice): void {
    applyTheme(choice, document.documentElement);
    persistTheme(choice, window.localStorage);
    setTheme(choice);
  }

  return (
    <nav className="ecr-global-nav" aria-label="Navigasi utama ecorione">
      <div className="ecr-global-nav__inner">
        <Link className="ecr-global-nav__brand" href="/" aria-label="ecorione — Ai">
          <SealMark />
          <span>ecorione</span>
        </Link>

        <div className="ecr-global-nav__links" aria-label="Area produk">
          {NAV_ITEMS.map(([label, href]) => {
            const active = isActivePath(pathname, href);
            return (
              <Link
                className={`ecr-global-nav__link${active ? " ecr-global-nav__link--active" : ""}`}
                href={href}
                key={href}
                aria-current={active ? "page" : undefined}
              >
                {label}
              </Link>
            );
          })}
        </div>

        <div className="ecr-theme-switch" aria-label="Tema tampilan">
          <button
            type="button"
            className={
              theme === "light" ? "ecr-theme-switch__item is-active" : "ecr-theme-switch__item"
            }
            aria-pressed={theme === "light"}
            onClick={() => chooseTheme("light")}
          >
            Terang
          </button>
          <button
            type="button"
            className={
              theme === "dark" ? "ecr-theme-switch__item is-active" : "ecr-theme-switch__item"
            }
            aria-pressed={theme === "dark"}
            onClick={() => chooseTheme("dark")}
          >
            Gelap
          </button>
        </div>
      </div>
    </nav>
  );
}
