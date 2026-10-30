import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  // Bound concurrent PGlite database boots; retain every test and the default timeout.
  test: { include: ["tests/unit/**/*.test.ts", "tests/db/**/*.test.ts"], maxWorkers: 2 },
});
