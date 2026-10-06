/**
 * Canonical origin of the docs. `metadataBase`, robots.txt, the sitemap, and the
 * JSON-LD build their absolute URLs from it, so the production host lives in one place.
 */
export const siteUrl = "https://doc.trading-sdk.symm.io";

/** Brand name — the `<title>` suffix, `og:site_name`, and the JSON-LD `WebSite` name. */
export const siteName = "SYMMIO Trading-SDK Docs";

/** SYMMIO's X handle, emitted as `twitter:site`. */
export const twitterSite = "@symm_io";

/** The sibling SYMMIO Trading-SDK surfaces the docs link out to. */
export const siteLinks = {
  /** The marketing site — `apps/landing`. */
  landing: "https://trading-sdk.symm.io",
  /** The live SDK console — `apps/web`. */
  console: "https://console.trading-sdk.symm.io",
  /** The source repository. */
  github: "https://github.com/SYMM-IO/Trading-SDK",
} as const;
