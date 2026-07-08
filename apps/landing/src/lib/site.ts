/**
 * Central place for the outbound destinations the landing page links to — the
 * deployed surfaces of the SYMM Frontier workspace. Update these if the hosts
 * change.
 */
export const siteLinks = {
  /** The production web console — `apps/web`. */
  console: "https://symm-frontier-web.vercel.app",
  /** The Nextra documentation site — `apps/docs`. */
  docs: "https://symmio-frontier.vercel.app",
  /** The component explorer — `apps/storybook`. TODO: confirm deployed host. */
  storybook: "https://symmio-frontier-storybook.vercel.app",
  /** Source repository. */
  github: "https://github.com/SYMM-IO",
  /** Protocol docs for high-level concepts. */
  protocol: "https://docs.symm.io",
} as const;

/** Per-package documentation pages on the docs site. */
export const docsPaths = {
  core: `${siteLinks.docs}/core`,
  react: `${siteLinks.docs}/react`,
  sessionKey: `${siteLinks.docs}/session-key`,
  utils: `${siteLinks.docs}/utils`,
} as const;

/** In-page anchors used by the header nav. */
export const sectionAnchors = {
  sdk: "#sdk",
  libraries: "#libraries",
  apps: "#apps",
  start: "#start",
} as const;
