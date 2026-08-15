import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dts from "vite-plugin-dts";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(dirname, "src");

export default defineConfig({
  plugins: [
    react(),
    dts({
      outDirs: "dist",
      entryRoot: "src",
      insertTypesEntry: true,
      tsconfigPath: "./tsconfig.json",
      exclude: ["**/*.test.ts", "**/*.test.tsx", "**/test/**", "**/integration/**"],
    }),
  ],
  build: {
    emptyOutDir: true,
    sourcemap: true,
    target: "es2022",
    lib: {
      /**
       * Each public sub-barrel is its own entry so rollup emits a real
       * `dist/<sub>/index.js` for it. With a single root entry and
       * `preserveModules`, sub-barrels that only re-export get hoisted away,
       * which leaves the `./<sub>` paths in `package.json#exports` pointing to
       * files that do not exist.
       */
      entry: {
        index: path.resolve(srcRoot, "index.ts"),
        "provider/index": path.resolve(srcRoot, "provider/index.ts"),
        "account-layer/index": path.resolve(srcRoot, "account-layer/index.ts"),
        "instant-layer/index": path.resolve(srcRoot, "instant-layer/index.ts"),
        "wallet/index": path.resolve(srcRoot, "wallet/index.ts"),
        "errors/index": path.resolve(srcRoot, "errors/index.ts"),
        "transactions/index": path.resolve(srcRoot, "transactions/index.ts"),
        "markets/index": path.resolve(srcRoot, "markets/index.ts"),
        "fees/index": path.resolve(srcRoot, "fees/index.ts"),
        "price-service/index": path.resolve(srcRoot, "price-service/index.ts"),
        "candles/index": path.resolve(srcRoot, "candles/index.ts"),
      },
      formats: ["es"],
    },
    rollupOptions: {
      /**
       * Peer dependencies are kept external so the host's copies are used. The
       * direct deps (`zustand`, `decimal.js`, `@tanstack/react-query`) are also
       * marked external so we don't bundle them — the consumer resolves them
       * via their own node_modules, which is critical for `@tanstack/react-query`
       * to share its `QueryClient` context with the host's wagmi setup.
       */
      external: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "viem",
        /^viem\//,
        "wagmi",
        /^wagmi\//,
        "@tanstack/react-query",
        "@symmio/trading-core",
        /^@symmio\/core\//,
        "@symmio/utils",
        /^@symmio\/utils\//,
        "zustand",
        /^zustand\//,
        "decimal.js",
      ],
      output: {
        dir: path.resolve(dirname, "dist"),
        preserveModules: true,
        preserveModulesRoot: srcRoot,
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
     * Two Vitest projects: `unit` runs colocated `*.test.ts(x)` files in a
     * happy-dom environment with mocked wagmi; `integration` runs `*.integration.test.ts`
     * files in node against real Hyperliquid RPC. CI runs `unit` by default;
     * `pnpm test:integration` runs the integration suite.
     */
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "happy-dom",
          include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
          exclude: ["src/integration/**"],
          globals: false,
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          /**
           * `happy-dom` (not `node`) because integration tests render hooks
           * with `@testing-library/react` against real Hyperliquid RPC, so a
           * DOM is required. Network access works the same in either env.
           */
          environment: "happy-dom",
          include: ["src/integration/**/*.integration.test.ts", "src/integration/**/*.integration.test.tsx"],
          globals: false,
          testTimeout: 30_000,
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json", "json-summary"],
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/**/index.ts", "src/test/**", "src/integration/**"],
    },
  },
});
