import { PageHeader } from "@/components/page-header";
import { MethodGroup } from "../inspector/method-group";
import { ReadEnigmaPriceServiceHealth } from "./read-enigma-price-service-health";
import { ReadEnigmaPriceServiceMetadata } from "./read-enigma-price-service-metadata";
import { ReadEnigmaPriceServicePrices } from "./read-enigma-price-service-prices";
import { ReadEnigmaPriceServiceSymbolsInfo } from "./read-enigma-price-service-symbols-info";

/** Price-service page with read cards for the configured Enigma endpoint. */
export function PriceServiceShell() {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <PageHeader
        eyebrow="React SDK · Price Service"
        title="Enigma Price Service"
        description="Read mark prices, token metadata, symbol listings, and service health from the chain's configured price-service endpoint."
      />

      <MethodGroup label="Reads" count={4} fullWidth>
        <ReadEnigmaPriceServiceHealth />
        <ReadEnigmaPriceServicePrices />
        <ReadEnigmaPriceServiceMetadata />
        <ReadEnigmaPriceServiceSymbolsInfo />
      </MethodGroup>
    </section>
  );
}
