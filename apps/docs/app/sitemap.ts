import type { MetadataRoute } from "next";
import type { PageMapItem } from "nextra";
import { getPageMap } from "nextra/page-map";
import { siteUrl } from "../lib/site";

/**
 * Routes of every MDX page in a page map. Pages carry `frontMatter`; `_meta`
 * entries, separators, and external links carry none, so they drop out.
 */
function collectPageRoutes(items: PageMapItem[]): string[] {
  return items.flatMap((item) => {
    if ("children" in item) {
      /** A folder is itself a page only when Nextra lifted its index page's front matter onto it. */
      const own = "frontMatter" in item ? [item.route] : [];
      return [...own, ...collectPageRoutes(item.children)];
    }
    return "frontMatter" in item ? [item.route] : [];
  });
}

/**
 * One entry per docs page, read from the same page map the sidebar renders, so a
 * new `page.mdx` lands here automatically. (`getRouteToFilepath()` only lists
 * `content/` pages and is empty for this `app/`-directory site.) URLs carry the
 * trailing slash `trailingSlash: true` serves, matching each page's canonical.
 * No `lastModified`: Vercel's shallow clones make file and git times meaningless.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes = [...new Set(collectPageRoutes(await getPageMap()))].sort();
  return routes.map((route) => ({ url: `${siteUrl}${route.replace(/\/?$/, "/")}` }));
}
