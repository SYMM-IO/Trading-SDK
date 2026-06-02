import path from "node:path";
import { fileURLToPath } from "node:url";
import dts from "vite-plugin-dts";
import { defineConfig } from "vitest/config";

/**
 * ESM equivalent of __dirname — needed because this file runs as an ES module
 * and `path.resolve` calls below require an absolute base directory.
 */
const dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(dirname, "src");

export default defineConfig({
  plugins: [
    /**
     * Generates `.d.ts` files alongside the JS output so consumers of
     * `@symm-frontier/core` get full TypeScript types from the published package.
     */
    dts({
      /**
       * Where the generated declarations are written. Matches
       * `build.rollupOptions.output.dir` so each `.js` file has a sibling `.d.ts`.
       */
      outDirs: "dist",
      /**
       * Root for resolving the output tree. Without this, declarations would be
       * nested under an extra `src/` folder in `dist`.
       */
      entryRoot: "src",
      /**
       * Emits a top-level `dist/index.d.ts` entry so the `types` field in
       * `package.json` resolves correctly for bundlers and editors.
       */
      insertTypesEntry: true,
      /**
       * Uses the package's tsconfig (strict mode, paths, etc.) when emitting
       * declarations — keeps the published types consistent with local typecheck.
       */
      tsconfigPath: "./tsconfig.json",
      /**
       * Tests are not part of the public surface; excluding them keeps test-only
       * types and helpers out of the shipped declarations.
       */
      exclude: ["**/*.test.ts", "**/test/**"],
    }),
  ],
  build: {
    /**
     * Wipes `dist/` before each build so stale files from removed modules
     * don't leak into the published package.
     */
    emptyOutDir: true,
    /**
     * Ships source maps so consumers can debug into the SDK in their own apps.
     */
    sourcemap: true,
    /**
     * Matches the repo-wide TS target. `es2022` gives us native top-level await,
     * class fields, and `Error.cause` without downleveling.
     */
    target: "es2022",
    /**
     *  Library mode — produces a package meant to be imported, not a bundled app.
     */
    lib: {
      /**
       * Single public entry. Sub-paths (e.g. `@symm-frontier/core/account-layer`)
       * are exposed via `package.json` `exports`, not extra entries here.
       */
      entry: path.resolve(dirname, "src/index.ts"),
      /**
       * ESM only. The SDK targets modern toolchains; CJS would force us to
       * dual-publish and complicates tree-shaking and `exports` maps.
       */
      formats: ["es"],
    },
    rollupOptions: {
      /**
       * viem is a peer dependency (see AGENTS.md). Marking it external prevents
       * it from being bundled into our output, so consumers use their own copy
       * and we don't ship a duplicate. The regex covers viem sub-paths like
       * `viem/chains`, `viem/actions`, etc.
       */
      external: ["viem", /^viem\//, "@tanstack/query-core"],
      output: {
        dir: path.resolve(dirname, "dist"),
        /**
         * Emits one output file per source file instead of a single bundle.
         * Critical for tree-shaking — consumers only pay for what they import.
         */
        preserveModules: true,
        /**
         * Strips the `src/` prefix from output paths so `src/foo/bar.ts`
         * becomes `dist/foo/bar.js` (not `dist/src/foo/bar.js`).
         */
        preserveModulesRoot: srcRoot,
        /**
         * Keep file names stable (no hashes) — this is a library, not a deployed
         * app, and consumers reference these paths via the `exports` map.
         */
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name][extname]",
      },
    },
  },
  test: {
    /**
     * The worker-thread pool. Vitest's default `forks` pool serializes worker
     * messages in a way that throws on `BigInt`; SDK tests assert on `bigint`
     * args (pagination offsets/limits), so `threads` (structured clone) is
     * required for them to run.
     */
    pool: "threads",
    /**
     * Explicit imports from `vitest` are preferred over global `describe`/`it`
     * so test files are self-contained and editor tooling can resolve symbols.
     */
    globals: false,
    /**
     * SDK is framework-agnostic and runs in Node-like environments during tests.
     * No DOM is needed; jsdom would just slow tests down.
     */
    environment: "node",
    /**
     * Colocated tests pattern — `foo.ts` lives next to `foo.test.ts`.
     */
    include: ["src/**/*.test.ts"],
    coverage: {
      /** v8 is faster than istanbul and built into Node — no extra instrumentation. */
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      /**
       * Test files and barrel `index.ts` re-exports aren't meaningful coverage
       * targets; excluding them keeps the report focused on real logic.
       */
      exclude: ["src/**/*.test.ts", "src/**/index.ts"],
    },
  },
});
