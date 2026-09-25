import { reactLibraryConfig } from "@symmio/eslint-config/react-library";
import globals from "globals";

/**
 * The terminal app renders React (via Ink) but runs on Node, so it needs the
 * React/hooks rules from `react-library` plus Node globals (`process`, `Buffer`,
 * timers). PropTypes and unescaped-entity checks are noise here — types come
 * from TypeScript and all JSX text is plain terminal copy.
 */
export default [
  ...reactLibraryConfig,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      "react/prop-types": "off",
      "react/no-unescaped-entities": "off",
      "react/display-name": "off",
    },
  },
];
