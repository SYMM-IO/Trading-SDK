import type { MetadataRoute } from "next";
import { siteUrl } from "../lib/site";

/** Every docs page is public — let all crawlers in and point them at the sitemap. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
