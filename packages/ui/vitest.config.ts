import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    /**
     * Component tests need a DOM. `happy-dom` matches what `@symmio/trading-react`
     * already runs on, so the two packages behave identically under test.
     */
    environment: "happy-dom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    /**
     * Explicit imports from "vitest" rather than ambient globals, matching every
     * other package in the workspace.
     */
    globals: false,
  },
});
