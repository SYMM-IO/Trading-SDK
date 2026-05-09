import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(dirname, "src");

export default defineConfig({
  plugins: [
    react(),
    dts({
      outDir: "dist",
      entryRoot: "src",
      insertTypesEntry: true,
      tsconfigPath: "./tsconfig.json",
    }),
  ],
  build: {
    emptyOutDir: true,
    sourcemap: true,
    target: "es2022",
    lib: {
      entry: path.resolve(dirname, "src/index.ts"),
      formats: ["es"],
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime"],
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
});
