import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// Published-entry-point E2E config (Phase 6, packaging-shipping-fix).
//
// Resolves the package name through the built `dist/` output via the same
// `exports`-based entry point a real consumer would use — NOT a relative
// `src/` import — so a regression in the public barrel (e.g. dropping
// registerXmlParser/getXmlParser) is caught here.
//
// Requires `bun run build` to have produced `dist/index.js` first; the
// `test:e2e` script runs the build automatically.
export default defineConfig({
  test: {
    include: ["tests/e2e/**/*.test.ts"],
    environment: "node",
    globals: false,
    pool: "forks",
    passWithNoTests: false,
  },
  resolve: {
    alias: {
      "@nuup/ts-rosa": resolve(__dirname, "./dist/index.js"),
    },
  },
});
