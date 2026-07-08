import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../../../packages/**/src/**/*.stories.@(ts|tsx|mdx)", "../../../apps/web/src/**/*.stories.@(ts|tsx|mdx)"],
  // Serve `public/` statically. Storybook picks up `favicon.svg` from here for
  // the manager UI, so the tab icon matches the SDK apps (see public/favicon.svg).
  staticDirs: ["../public"],
  addons: ["@storybook/addon-docs", "@storybook/addon-themes"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
};

export default config;
