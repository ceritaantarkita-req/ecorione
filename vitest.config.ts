import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/**/*.test.ts",
      "services/**/*.test.ts",
      "apps/**/*.test.ts",
      "test/**/*.test.ts",
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