import type { Linter } from "eslint";
import { defineConfig, globalIgnores } from "eslint/config";
import pluginNext from "@next/eslint-plugin-next";
import { reactLibraryConfig } from "./react-library.js";

export const nextJsConfig = defineConfig(
  ...reactLibraryConfig,
  {
    plugins: { "@next/next": pluginNext },
    rules: {
      ...pluginNext.configs.recommended.rules,
      ...pluginNext.configs["core-web-vitals"].rules,
      "@next/next/no-html-link-for-pages": "off",
    } as Linter.RulesRecord,
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
);
