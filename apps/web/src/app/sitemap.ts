import { ALL_PAGES } from "@/features/contracts/pages";
import { navLinks } from "@/features/layout/nav";
import { siteUrl } from "@/lib/site";
import type { MetadataRoute } from "next";

/**
 * Every console route: the navigation destinations plus each Contracts
 * sub-page, from the same `ALL_PAGES` registry `generateStaticParams`
 * prerenders — so a new route lands here as soon as it is in the navigation.
 * No `lastModified`: Vercel's shallow clones carry no meaningful file times.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [...navLinks.map((link) => link.href), ...ALL_PAGES.map((page) => `/contracts/${page.slug}`)];
  return paths.map((path) => ({ url: path === "/" ? siteUrl : `${siteUrl}${path}` }));
}
