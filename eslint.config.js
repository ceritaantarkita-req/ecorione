import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/*.tsbuildinfo",
      "**/coverage/**",
      "**/.next/**",
      // Dihasilkan otomatis oleh Next.js sendiri (`next dev`/`next build`) — "This file
      // should not be edited" tertulis di isinya. Triple-slash reference ke
      // `./.next/types/routes.d.ts` di baris terakhirnya melanggar aturan lint kita
      // sendiri; ini konvensi resmi Next.js, bukan sesuatu yang perlu "diperbaiki".
      "**/next-env.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "no-restricted-syntax": [
        "error",
        {
          // ADR-01: prefix stabil tidak boleh mengandung nilai yang berubah tiap panggilan.
          // Date.now() / new Date() di dalam perakitan prefix akan membatalkan cache secara diam-diam.
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message:
            "Date.now() dilarang di jalur perakitan prefix (ADR-01). Injeksikan clock lewat parameter supaya bisa diuji dan supaya prefix tetap byte-identik.",
        },
      ],
    },
  },
  {
    // Next 15 removed `next lint`; keep framework rules in the root flat config.
    files: ["apps/ai/**/*.{ts,tsx}"],
    plugins: { "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },
  {
    // Test dan tooling boleh pakai clock nyata.
    files: ["**/*.test.ts", "**/scripts/**/*.mjs", "**/*.config.ts"],
    rules: { "no-restricted-syntax": "off" },
  },
  {
    // Satu-satunya tempat clock nyata boleh masuk ke kode produksi: `clock.ts` per
    // service, satu fungsi `nowIso()`. Semua route handler mengimpor dari sini alih-
    // alih memanggil Date.now()/new Date() sendiri-sendiri — jadi ada satu titik audit
    // untuk "dari mana waktu nyata masuk", persis pola "injeksikan clock" ADR-01, hanya
    // dipindah ke tepi I/O yang memang wajib menghasilkannya (Fase 1: RnD/Context/
    // Connect/Hub HTTP layer, apps/ai route handler).
    files: ["**/src/clock.ts", "apps/*/app/**/clock.ts"],
    rules: { "no-restricted-syntax": "off" },
  },
  {
    // Tooling scripts run on Node 22. Keep the globals explicit so browser code does
    // not accidentally inherit server capabilities from the lint configuration.
    files: ["**/scripts/**/*.mjs", "*.mjs"],
    languageOptions: {
      globals: {
        URL: "readonly",
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        fetch: "readonly",
        AbortSignal: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
      },
    },
  },
);
