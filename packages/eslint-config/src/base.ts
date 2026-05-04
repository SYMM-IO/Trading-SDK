import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import pluginTurbo from "eslint-plugin-turbo";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export const baseConfig = defineConfig(
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  {
    plugins: { turbo: pluginTurbo },
    rules: {
      "turbo/no-undeclared-env-vars": "warn",
    },
  },
  {
    ignores: ["**/dist/**", "**/.next/**", "**/node_modules/**", "**/storybook-static/**"],
  },
);
