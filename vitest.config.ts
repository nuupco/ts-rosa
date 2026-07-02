import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "tests/e2e/**"],
    environment: "node",
    globals: false,
    pool: "forks",
    setupFiles: ["tests/setup.ts"],
    passWithNoTests: true,
  },
});
