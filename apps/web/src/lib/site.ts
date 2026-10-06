/**
 * The console's own identity — what metadata, robots.txt, the sitemap, and the
 * JSON-LD build on — and the sibling SYMMIO Trading-SDK surfaces it links out
 * to. Update these if the hosts change.
 */

/** Canonical origin of the console. */
export const siteUrl = "https://console.trading-sdk.symm.io";

/** Brand name — the `<title>` suffix, `og:site_name`, and the JSON-LD `WebSite` name. */
export const siteName = "SYMMIO Trading-SDK Console";

/** SYMMIO's X handle, emitted as `twitter:site`. */
export const twitterSite = "@symm_io";

/** The sibling surfaces the console links out to (footer "Resources"). */
export const siteLinks = {
  /** The marketing site — `apps/landing`. */
  landing: "https://trading-sdk.symm.io",
  /** The Nextra documentation site — `apps/docs`. */
  docs: "https://doc.trading-sdk.symm.io",
  /** The source repository. */
  github: "https://github.com/SYMM-IO/Trading-SDK",
} as const;
