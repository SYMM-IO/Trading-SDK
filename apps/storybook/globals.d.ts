/**
 * Allow side-effect imports of CSS files (e.g. `import "@symmio/ui/globals.css"`
 * in `.storybook/preview.ts`) to type-check. Vite handles the actual loading at
 * runtime — TypeScript just needs to know the module exists.
 */
declare module "*.css";
