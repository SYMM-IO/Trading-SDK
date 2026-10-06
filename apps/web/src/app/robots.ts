import { siteUrl } from "@/lib/site";
import type { MetadataRoute } from "next";

/** Every console route prerenders public content — let all crawlers in and point them at the sitemap. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
