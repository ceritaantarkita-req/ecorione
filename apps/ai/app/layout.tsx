import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "ecorione — Ai",
  description:
    "Antarmuka chat ecorione — memori dan biaya selalu terlihat, tidak ada fallback diam-diam.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
