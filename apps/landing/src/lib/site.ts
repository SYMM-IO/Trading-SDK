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

/**
 * Home-page section anchors, used by the header, footer, and hero.
 *
 * Root-relative (`/#sdk`, never a bare `#sdk`) so they resolve from **any**
 * route. On the home page the browser reads them as a same-document fragment
 * jump — no reload. From a sub-route like `/affiliate`, a bare `#sdk` would
 * point at an element that does not exist there and do nothing; the leading `/`
 * makes it navigate home first and then scroll.
 */
export const sectionAnchors = {
  top: "/#top",
  sdk: "/#sdk",
  libraries: "/#libraries",
  apps: "/#apps",
  start: "/#start",
} as const;

/** Internal routes on the landing site (pages beyond the home page). */
export const routes = {
  /** The affiliate registration page — the one wallet-connected surface. */
  affiliate: "/affiliate",
} as const;
