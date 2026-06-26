import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const uiSrc = path.resolve(dirname, "../../packages/ui/src");

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      /**
       * `@theoldvarorg/ui/globals.css` lives at `src/styles/globals.css` in
       * the package, so it needs its own alias entry — the broader directory
       * alias below would otherwise resolve it to `src/globals.css`.
       */
      "@theoldvarorg/ui/globals.css": path.resolve(uiSrc, "styles/globals.css"),
      "@theoldvarorg/ui": uiSrc,
    },
  },
});
