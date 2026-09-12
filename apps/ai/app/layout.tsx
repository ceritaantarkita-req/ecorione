import type { Metadata } from "next";
import type { ReactNode } from "react";
import { THEME_BOOTSTRAP_SCRIPT } from "@ecorione/shared-ui";
import ProductNav from "./ProductNav";
import "./globals.css";
import "./navigation.css";

export const metadata: Metadata = {
  title: "ecorione — Ai",
  description:
    "Workspace local-first ecorione untuk Ai, Space, Flow, Operations, dan pengaturan runtime.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
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
