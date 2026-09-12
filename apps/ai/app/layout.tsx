import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, Manrope } from "next/font/google";
import type { ReactNode } from "react";
import { THEME_BOOTSTRAP_SCRIPT } from "@ecorione/shared-ui";
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
      </head>
      <body>
        <ProductNav />
        {children}
      </body>
    </html>
  );
}
