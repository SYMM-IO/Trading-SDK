import { routes, siteUrl } from "@/lib/site";
import type { MetadataRoute } from "next";

/** The landing's indexable pages. No `lastModified`: Vercel's shallow clones carry no meaningful file times. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: siteUrl }, { url: `${siteUrl}${routes.affiliate}` }];
}
