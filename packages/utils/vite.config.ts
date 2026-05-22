import path from "node:path";
import { fileURLToPath } from "node:url";
import dts from "vite-plugin-dts";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(dirname, "src");

export default defineConfig({
  plugins: [
    dts({
      outDirs: "dist",
      entryRoot: "src",
      insertTypesEntry: true,
      tsconfigPath: "./tsconfig.json",
      exclude: ["**/*.test.ts"],
    }),
  ],
  build: {
    emptyOutDir: true,
    sourcemap: true,
    target: "es2022",
    lib: {
      /**
       * Each sub-barrel is its own entry so rollup emits a real `.js` file
       * for it under `dist/<sub>/index.js`. With a single root entry and
       * `preserveModules`, sub-barrels that only re-export get hoisted away,
       * which leaves the `./<sub>` paths in `package.json#exports` pointing
       * to files that do not exist.
       */
      entry: {
        index: path.resolve(srcRoot, "index.ts"),
        "address/index": path.resolve(srcRoot, "address/index.ts"),
        "amounts/index": path.resolve(srcRoot, "amounts/index.ts"),
        "decimal/index": path.resolve(srcRoot, "decimal/index.ts"),
        "format/index": path.resolve(srcRoot, "format/index.ts"),
      },
      formats: ["es"],
    },
    rollupOptions: {
      /**
       * `viem` is a peer dependency; `decimal.js` is a direct dep we want
       * resolved by the consumer's node_modules so a single Decimal class is
       * shared across the SDK and host app.
       */
      external: ["viem", /^viem\//, "decimal.js"],
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
    globals: false,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/index.ts"],
    },
  },
});
