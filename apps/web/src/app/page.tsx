import { JsonLd } from "@/components/json-ld";
import { HomePanel } from "@/features/home/home-panel";
import { siteName, siteUrl } from "@/lib/site";

/** schema.org `WebSite` for the console home — Google reads its `name` as the site name shown above results. */
const website = {
  "@type": "WebSite",
  name: siteName,
  alternateName: "SYMMIO SDK Console",
  url: `${siteUrl}/`,
  inLanguage: "en",
};

export default function Home() {
  return (
    <>
      <HomePanel />
      <JsonLd data={website} />
    </>
  );
}
