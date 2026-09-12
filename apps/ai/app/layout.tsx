import type { Metadata } from "next";
import type { ReactNode } from "react";
import { THEME_STORAGE_KEY } from "@ecorione/shared-ui";
import ProductNav from "./ProductNav";
import "./globals.css";
import "./navigation.css";

const APP_THEME_BOOTSTRAP_SCRIPT = `(function(){
  try {
    var saved = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    document.documentElement.setAttribute('data-theme', saved === 'light' ? 'light' : 'dark');
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();`;

export const metadata: Metadata = {
  title: "ecorione — Ai",
  description:
    "Workspace local-first ecorione untuk Ai, Space, Flow, Operations, dan pengaturan runtime.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: APP_THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body>
        <ProductNav />
        {children}
      </body>
    </html>
  );
}
