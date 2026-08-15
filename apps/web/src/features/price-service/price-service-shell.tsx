import { PageHeader } from "@/components/page-header";
import { MethodGroup } from "../inspector/method-group";
import { ReadBinanceHealth } from "./read-binance-health";
import { ReadBinancePremiumIndex } from "./read-binance-premium-index";
import { ReadBinanceSymbolsInfo } from "./read-binance-symbols-info";
import { ReadEnigmaPriceServiceHealth } from "./read-enigma-price-service-health";
import { ReadEnigmaPriceServiceMetadata } from "./read-enigma-price-service-metadata";
import { ReadEnigmaPriceServicePricesByAddresses } from "./read-enigma-price-service-prices-by-addresses";
import { ReadEnigmaPriceServicePricesByNames } from "./read-enigma-price-service-prices-by-names";
import { ReadEnigmaPriceServiceSymbolsInfo } from "./read-enigma-price-service-symbols-info";
import { ReadMarkPrices } from "./read-mark-prices";
import { WatchBinancePrices } from "./watch-binance-prices";
import { WatchEnigmaPriceByMarket } from "./watch-enigma-price-by-market";
import { WatchEnigmaPrices } from "./watch-enigma-prices";
import { WatchPrices } from "./watch-prices";

/**
 * Price-service page.
 *
 * The first group is provider-agnostic: switching the solver target switches the
 * price source (Enigma's lowcap service on HyperEVM, Binance USD-M Futures on
 * Base) with no other change. The Enigma-only groups below call that vendor
 * directly and therefore throw `UNSUPPORTED_BY_PRICE_SERVICE` on a chain whose
 * configured provider is not Enigma.
 */
export function PriceServiceShell() {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <PageHeader
        eyebrow="React SDK · Price Service"
        title="Price Service"
        description="Read and stream mark prices from whichever provider serves the selected solver — Enigma's lowcap service, or Binance USD-M Futures for major markets."
      />

      <MethodGroup label="All providers" count={2} fullWidth>
        <WatchPrices />
        <ReadMarkPrices />
      </MethodGroup>

      <MethodGroup label="Binance-only reads" count={3} fullWidth>
        <ReadBinanceHealth />
        <ReadBinancePremiumIndex />
        <ReadBinanceSymbolsInfo />
      </MethodGroup>

      <MethodGroup label="Binance-only streams" count={1} fullWidth>
        <WatchBinancePrices />
      </MethodGroup>

      <MethodGroup label="Enigma-only reads" count={5} fullWidth>
        <ReadEnigmaPriceServiceHealth />
        <ReadEnigmaPriceServicePricesByAddresses />
        <ReadEnigmaPriceServicePricesByNames />
        <ReadEnigmaPriceServiceMetadata />
        <ReadEnigmaPriceServiceSymbolsInfo />
      </MethodGroup>

      <MethodGroup label="Enigma-only streams" count={2} fullWidth>
        <WatchEnigmaPrices />
        <WatchEnigmaPriceByMarket />
      </MethodGroup>
    </section>
  );
}
