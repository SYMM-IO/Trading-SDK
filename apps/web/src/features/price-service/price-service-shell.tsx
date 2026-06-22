import { PageHeader } from "@/components/page-header";
import { MethodGroup } from "../inspector/method-group";
import { ReadEnigmaPriceServiceHealth } from "./read-enigma-price-service-health";
import { ReadEnigmaPriceServiceMetadata } from "./read-enigma-price-service-metadata";
import { ReadEnigmaPriceServicePricesByAddresses } from "./read-enigma-price-service-prices-by-addresses";
import { ReadEnigmaPriceServicePricesByNames } from "./read-enigma-price-service-prices-by-names";
import { ReadEnigmaPriceServiceSymbolsInfo } from "./read-enigma-price-service-symbols-info";
import { WatchEnigmaPriceByMarket } from "./watch-enigma-price-by-market";
import { WatchEnigmaPrices } from "./watch-enigma-prices";

/** Price-service page with read cards for the configured Enigma endpoint. */
export function PriceServiceShell() {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <PageHeader
        eyebrow="React SDK · Price Service"
        title="Enigma Price Service"
        description="Read mark prices, token metadata, symbol listings, and service health from the chain's configured price-service endpoint."
      />

      <MethodGroup label="Reads" count={5} fullWidth>
        <ReadEnigmaPriceServiceHealth />
        <ReadEnigmaPriceServicePricesByAddresses />
        <ReadEnigmaPriceServicePricesByNames />
        <ReadEnigmaPriceServiceMetadata />
        <ReadEnigmaPriceServiceSymbolsInfo />
      </MethodGroup>

      <MethodGroup label="Streams" count={2} fullWidth>
        <WatchEnigmaPrices />
        <WatchEnigmaPriceByMarket />
      </MethodGroup>
    </section>
  );
}
