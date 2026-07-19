import { addons } from "storybook/manager-api";
import { create } from "storybook/theming";

/**
 * Ember-flavored dark theme for the Storybook manager UI (sidebar, toolbar,
 * addon panel). This keeps the chrome consistent with the dark story canvas —
 * the canvas itself defaults to the `dark` class via the theme decorator in
 * `preview.ts`. Colors mirror the `.dark` tokens in `@symmio/ui` globals.css.
 */
const emberDark = create({
  base: "dark",
  brandTitle: "SYMMIO UI",

  colorPrimary: "hsl(5, 100%, 72%)",
  colorSecondary: "hsl(5, 100%, 72%)",

  appBg: "hsl(0, 33%, 3%)",
  appContentBg: "hsl(0, 33%, 3%)",
  appPreviewBg: "hsl(0, 33%, 3%)",
  appBorderColor: "hsl(0, 8%, 16%)",
  appBorderRadius: 8,

  barBg: "hsl(0, 24%, 5%)",
  barTextColor: "hsl(0, 4%, 56%)",
  barSelectedColor: "hsl(5, 100%, 72%)",
  barHoverColor: "hsl(5, 100%, 72%)",

  textColor: "hsl(0, 20%, 95%)",
  textInverseColor: "hsl(0, 33%, 3%)",
  textMutedColor: "hsl(0, 4%, 56%)",

  inputBg: "hsl(0, 18%, 7%)",
  inputBorder: "hsl(0, 8%, 16%)",
  inputTextColor: "hsl(0, 20%, 95%)",
  inputBorderRadius: 8,

  fontBase: '"Manrope", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  fontCode: '"JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, monospace',
});

addons.setConfig({ theme: emberDark });
