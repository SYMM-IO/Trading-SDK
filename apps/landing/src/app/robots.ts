import { siteUrl } from "@/lib/site";
import type { MetadataRoute } from "next";

/** Every page is crawlable; only the POST-only affiliate notify endpoint under `/api/` is off-limits. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
