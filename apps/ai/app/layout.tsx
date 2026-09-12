import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";
import "./navigation.css";

export const metadata: Metadata = {
  title: "ecorione — Ai",
  description:
    "Antarmuka chat ecorione — memori dan biaya selalu terlihat, tidak ada fallback diam-diam.",
};

const NAV_ITEMS = [
  ["Ai", "/"],
  ["Space", "/space"],
  ["Flow", "/flow"],
  ["Operations", "/ops"],
  ["Settings", "/settings"],
] as const;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body>
        <nav className="ecr-global-nav" aria-label="Navigasi utama ecorione">
          <Link className="ecr-global-nav__brand" href="/">
            ecorione
          </Link>
          {NAV_ITEMS.map(([label, href]) => (
            <Link className="ecr-global-nav__link" href={href} key={href}>
              {label}
            </Link>
          ))}
        </nav>
        {children}
      </body>
    </html>
  );
}
