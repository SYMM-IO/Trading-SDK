import pluginBetterTailwindcss from "eslint-plugin-better-tailwindcss";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import { defineConfig } from "eslint/config";
import globals from "globals";
import { baseConfig } from "./base.js";

export const reactLibraryConfig = defineConfig(
  ...baseConfig,
  pluginReact.configs.flat.recommended!,
  pluginReact.configs.flat["jsx-runtime"]!,
  {
    languageOptions: {
      ...pluginReact.configs.flat.recommended!.languageOptions,
      globals: {
        ...globals.serviceworker,
        ...globals.browser,
      },
    },
  },
  {
    plugins: { "react-hooks": pluginReactHooks },
    settings: { react: { version: "detect" } },
    rules: { ...pluginReactHooks.configs.recommended.rules },
  },
  {
    /**
     * Tailwind class hygiene. Only the rules that work without an `entryPoint`
     * (i.e. without parsing the consuming package's Tailwind CSS) are enabled
     * here — class ordering is left to `prettier-plugin-tailwindcss`. Consumers
     * that want richer checks (`no-unregistered-classes`, etc.) can extend
     * their own eslint config and supply `entryPoint` in `settings`.
     */
    files: ["**/*.{ts,tsx,js,jsx,mts,mtsx}"],
    plugins: { "better-tailwindcss": pluginBetterTailwindcss },
    settings: {
      "better-tailwindcss": {
        callees: ["cn", "clsx", "cva"],
      },
    },
    rules: {
      "better-tailwindcss/no-duplicate-classes": "error",
      "better-tailwindcss/no-unnecessary-whitespace": "error",
    },
  },
);
