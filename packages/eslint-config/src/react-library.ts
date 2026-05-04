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
);
