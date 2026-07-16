/**
 * Central place for the outbound destinations the landing page links to — the
 * deployed surfaces of the SYMMIO Trading-SDK workspace. Update these if the hosts
 * change.
 */
export const siteLinks = {
  /** The production web console — `apps/web`. */
  console: "https://console.trading-sdk.symm.io",
  /** The Nextra documentation site — `apps/docs`. */
  docs: "https://doc.trading-sdk.symm.io",
  /** The component explorer — `apps/storybook`. TODO: confirm deployed host. */
  storybook: "https://symmio-frontier-storybook.vercel.app",
  /** Source repository. */
  github: "https://github.com/SYMM-IO/Trading-SDK",
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
