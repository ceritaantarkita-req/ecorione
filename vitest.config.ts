import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  test: {
    include: [
      "packages/**/*.test.ts",
      "packages/**/*.test.tsx",
      "services/**/*.test.ts",
      "services/**/*.test.tsx",
      "apps/**/*.test.ts",
      "apps/**/*.test.tsx",
      "evals/**/*.test.ts",
      "evals/**/*.test.tsx",
      "test/**/*.test.ts",
      "test/**/*.test.tsx",
      "test/**/*.test.mjs",
    ],
    environment: "node",
    globals: false,
    reporters: ["default"],
    testTimeout: 15_000,
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**", "services/*/src/**", "apps/ai/lib/**", "apps/ai/app/**"],
    },
  },
});
