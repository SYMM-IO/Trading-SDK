import { nextJsConfig } from "@symmio/eslint-config/next-js";

export default [
  ...nextJsConfig,
  {
    ignores: ["public/_pagefind/**"],
  },
];
