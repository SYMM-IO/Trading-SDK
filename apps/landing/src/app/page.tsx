import { AppsSection } from "@/features/apps/apps-section";
import { CapabilityTicker } from "@/features/capabilities/capability-ticker";
import { GetStarted } from "@/features/get-started/get-started";
import { Hero } from "@/features/hero/hero";
import { LibrariesSection } from "@/features/libraries/libraries-section";
import { PrinciplesSection } from "@/features/principles/principles-section";
import { SdkLayers } from "@/features/sdk/sdk-layers";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <CapabilityTicker />
      <SdkLayers />
      <PrinciplesSection />
      <LibrariesSection />
      <AppsSection />
      <GetStarted />
    </>
  );
}
