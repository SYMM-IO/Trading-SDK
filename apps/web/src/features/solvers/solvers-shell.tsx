"use client";

import { PageHeader } from "@/components/page-header";
import { SUPPORTED_CHAIN_IDS } from "@/config/symmio-config-schema";
import { SymmioSupportedChainId } from "@symmio/trading-core";
import { Button } from "@symmio/ui/components/button";
import { useChainId, useSwitchChain } from "wagmi";
import { MethodGroup } from "../inspector/method-group";
import { ReadMarkets } from "../inspector/read-markets";
import { WalletPanel } from "../inspector/wallet-panel";
import { QuotesCard } from "../quotes/quotes-card";
import { EnigmaEstimatedPriceCard } from "./enigma-estimated-price-card";
import { EnigmaInstantCloseCard } from "./enigma-instant-close-card";
import { EnigmaInstantOpenCard } from "./enigma-instant-open-card";
import { RasaBalanceInfoCard } from "./rasa-balance-info-card";
import { RasaErrorMessageCard } from "./rasa-error-message-card";
import { RasaNotificationsCard } from "./rasa-notifications-card";
import { RasaOpenInterestCard } from "./rasa-open-interest-card";
import { RasaPartyAUpnlCard } from "./rasa-party-a-upnl-card";
import { RasaPositionStatesCard } from "./rasa-position-states-card";
import { RasaPriceRangeCard } from "./rasa-price-range-card";
import { RasaReadinessCard } from "./rasa-readiness-card";
import { RasaWhitelistCard } from "./rasa-whitelist-card";
import { ReadFundingInfoCard } from "./read-funding-info-card";
import { ReadInstantOpensCard } from "./read-instant-opens-card";
import { ReadLockedParams } from "./read-locked-params";
import { ReadMarketInfoCard } from "./read-market-info-card";
import { ReadNotionalCap } from "./read-notional-cap";
import { ReadNotionalCapTotals } from "./read-notional-cap-totals";
import { ReadOpenInterest } from "./read-open-interest";
import { SolverErrorCodesCard } from "./solver-error-codes-card";

const CHAIN_LABELS: Record<number, string> = {
  [SymmioSupportedChainId.HYPER_EVM]: "HyperEVM (Enigma)",
  [SymmioSupportedChainId.BASE]: "Base (Rasa)",
};

/** Segmented switch between the supported chains (HyperEVM ↔ Base). */
function ChainSwitch() {
  const activeChainId = useChainId();
  const { switchChain } = useSwitchChain();

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Chain</span>
      {SUPPORTED_CHAIN_IDS.map((chainId) => (
        <Button
          key={chainId}
          type="button"
          size="sm"
          variant={activeChainId === chainId ? "default" : "outline"}
          onClick={() => switchChain({ chainId })}
          data-testid={`button-solvers-chain-${chainId}`}
        >
          {CHAIN_LABELS[chainId] ?? `Chain ${chainId}`}
        </Button>
      ))}
    </div>
  );
}

/**
 * Solvers page. The solver is an off-chain API (not a contract), so it sits
 * outside the Contracts hub. Renders solver reads and writes in the same
 * collapsible method groups as contract pages. Cards carry their own solver
 * selector (Enigma · HyperEVM / Rasa · Base); the Rasa-only group is served
 * exclusively by the `rasa` solver kind.
 */
export function SolversShell() {
  const activeChainId = useChainId();

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <PageHeader
        eyebrow="React SDK · Solvers"
        title={`Solvers · ${activeChainId === SymmioSupportedChainId.BASE ? "Base" : "HyperEVM"}`}
        description="The solver is an off-chain service, not a contract. Fetch tradable markets, funding, caps, and Rasa-only account/state reads straight from the chain's solver."
      />

      <WalletPanel />
      <ChainSwitch />

      <MethodGroup label="Reads" count={11} fullWidth>
        <ReadLockedParams />
        <ReadNotionalCap />
        <ReadNotionalCapTotals />
        <ReadOpenInterest />
        <ReadFundingInfoCard />
        <EnigmaEstimatedPriceCard />
        <ReadMarketInfoCard />
        <ReadMarkets />
        <ReadInstantOpensCard />
        <SolverErrorCodesCard />
        <QuotesCard />
      </MethodGroup>

      <MethodGroup label="Rasa-only reads" count={8} fullWidth>
        <RasaBalanceInfoCard />
        <RasaPartyAUpnlCard />
        <RasaOpenInterestCard />
        <RasaPriceRangeCard />
        <RasaPositionStatesCard />
        <RasaNotificationsCard />
        <RasaErrorMessageCard />
        <RasaReadinessCard />
      </MethodGroup>

      <MethodGroup label="Writes" count={3} fullWidth>
        <EnigmaInstantOpenCard />
        <EnigmaInstantCloseCard />
        <RasaWhitelistCard />
      </MethodGroup>
    </section>
  );
}
