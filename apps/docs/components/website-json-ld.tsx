import { siteName, siteUrl } from "../lib/site";

/**
 * schema.org `WebSite` for the docs home. Google reads its `name` as the site
 * name it shows above search results.
 */
const website = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: siteName,
  alternateName: "SYMMIO SDK Docs",
  url: `${siteUrl}/`,
  inLanguage: "en",
};

/**
 * Server-rendered JSON-LD `<script>` for the docs home, rendered once at the end
 * of `app/page.mdx`. `<` is escaped to `<` so no value can close the tag early.
 */
export function WebsiteJsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(website).replace(/</g, "\\u003c") }}
    />
  );
}
