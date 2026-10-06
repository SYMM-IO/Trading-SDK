/**
 * Central place for the landing site's own identity (origin, name, description —
 * what metadata, robots.txt, the sitemap, and JSON-LD build on) and for the
 * outbound destinations it links to: the deployed surfaces of the SYMMIO
 * Trading-SDK workspace. Update these if the hosts change.
 */

/** Canonical origin of this site. */
export const siteUrl = "https://trading-sdk.symm.io";

/** Brand name — the `<title>` suffix, `og:site_name`, and the JSON-LD `WebSite` name. */
export const siteName = "SYMMIO Trading-SDK";

/** Default meta description — also the JSON-LD `SoftwareSourceCode` description. */
export const siteDescription =
  "The SYMMIO SDK for builders: @symmio/trading-core and @symmio/trading-react wrap contracts, solvers, prices and Muon in one typed API for perps UIs.";

/** SYMMIO's X handle, emitted as `twitter:site`. */
export const twitterSite = "@symm_io";

/** SYMMIO, the organization behind the SDK — its main site and official profiles (from the symm.io footer). */
export const organization = {
  name: "SYMMIO",
  url: "https://www.symm.io/",
  sameAs: ["https://twitter.com/symm_io", "https://discord.gg/symmio", "https://github.com/SYMM-IO"],
} as const;

/** Outbound destinations — the deployed surfaces of the workspace and their sources. */
export const siteLinks = {
  /** The production web console — `apps/web`. */
  console: "https://console.trading-sdk.symm.io",
  /** The Nextra documentation site — `apps/docs`. */
  docs: "https://doc.trading-sdk.symm.io",
  /** Source repository. */
  github: "https://github.com/SYMM-IO/Trading-SDK",
  /** Source of the `@symmio/ui` design system (`packages/ui`). */
  uiSource: "https://github.com/SYMM-IO/Trading-SDK/tree/main/packages/ui",
  /** Protocol docs for high-level concepts. */
  protocol: "https://docs.symm.io",
} as const;

/**
 * Per-package documentation pages on the docs site. They end in `/` because the
 * docs site serves trailing-slash URLs — a bare path costs a redirect.
 */
export const docsPaths = {
  core: `${siteLinks.docs}/core/`,
  react: `${siteLinks.docs}/react/`,
  sessionKey: `${siteLinks.docs}/session-key/`,
  utils: `${siteLinks.docs}/utils/`,
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
