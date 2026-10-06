import { JsonLd } from "@/components/json-ld";
import { BecomeAffiliateCta } from "@/features/affiliate/become-affiliate-cta";
import { AppsSection } from "@/features/apps/apps-section";
import { CapabilityTicker } from "@/features/capabilities/capability-ticker";
import { GetStarted } from "@/features/get-started/get-started";
import { Hero } from "@/features/hero/hero";
import { LibrariesSection } from "@/features/libraries/libraries-section";
import { PrinciplesSection } from "@/features/principles/principles-section";
import { SdkLayers } from "@/features/sdk/sdk-layers";
import { organization, siteDescription, siteLinks, siteName, siteUrl } from "@/lib/site";

const organizationId = `${organization.url}#organization`;

/**
 * Home-page structured data: the SYMMIO organization, this site (Google reads the
 * `WebSite` name as the site name shown above results), and the SDK itself.
 */
const structuredData = {
  "@graph": [
    {
      "@type": "Organization",
      "@id": organizationId,
      name: organization.name,
      url: organization.url,
      logo: `${siteUrl}/apple-icon`,
      sameAs: organization.sameAs,
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: siteName,
      alternateName: "SYMMIO SDK",
      url: `${siteUrl}/`,
      inLanguage: "en",
      publisher: { "@id": organizationId },
    },
    {
      "@type": "SoftwareSourceCode",
      "@id": `${siteUrl}/#sdk`,
      name: siteName,
      description: siteDescription,
      url: `${siteUrl}/`,
      image: `${siteUrl}/opengraph-image.png`,
      codeRepository: siteLinks.github,
      programmingLanguage: "TypeScript",
      runtimePlatform: ["Node.js", "Web browser"],
      license: `${siteLinks.github}/blob/main/LICENSE`,
      author: { "@id": organizationId },
    },
  ],
};

export default function LandingPage() {
  return (
    <>
      <Hero />
      <CapabilityTicker />
      <SdkLayers />
      <PrinciplesSection />
      <LibrariesSection />
      <AppsSection />
      <BecomeAffiliateCta />
      <GetStarted />
      <JsonLd data={structuredData} />
    </>
  );
}
