"use client";

import { Stat } from "@/components/stat";
import { ListingMarketStatus, type ListingMarket } from "@symmio/trading-core";
import { Badge } from "@symmio/ui/components/badge";
import { Card } from "@symmio/ui/components/card";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import {
  depositChainLabel,
  formatListingRate,
  formatListingUsd,
  LISTING_STATUS_DISPLAY,
  rateTone,
  truncateContractAddress,
} from "./format-listing-value";
import { PoolSelect } from "./pool-select";

interface PoolScopeValue {
  /** Selected pool's `contractAddress`, or `""` when none. */
  contractAddress: string;
  /** The selected catalog row, for cards that need more than the address (its `chainId`, `symbolId`, …). */
  market: ListingMarket | null;
  /** True once a pool is picked — the gate every scoped card reads. */
  hasPool: boolean;
  setContractAddress: (contractAddress: string) => void;
  setMarket: (market: ListingMarket | null) => void;
}

const PoolScopeContext = createContext<PoolScopeValue | null>(null);

/**
 * One pool selection shared by every card in a section.
 *
 * A pool page asks the user for the pool once; the cards below then read it.
 * Before this, each card carried its own picker and the user re-selected the
 * same pool four times down the page. Mount one provider per section that
 * shares a selection (pool detail, the user's position) so the two stay
 * independent.
 */
export function PoolScopeProvider({ children }: { children: ReactNode }) {
  const [contractAddress, setContractAddress] = useState("");
  const [market, setMarket] = useState<ListingMarket | null>(null);

  const value = useMemo<PoolScopeValue>(
    () => ({
      contractAddress,
      market,
      hasPool: contractAddress !== "" && market !== null,
      setContractAddress,
      setMarket,
    }),
    [contractAddress, market],
  );

  return <PoolScopeContext.Provider value={value}>{children}</PoolScopeContext.Provider>;
}

/** The section's shared pool selection. Throws outside a {@link PoolScopeProvider}. */
export function usePoolScope(): PoolScopeValue {
  const value = useContext(PoolScopeContext);
  if (value === null) throw new Error("usePoolScope must be used within a PoolScopeProvider");
  return value;
}

interface PoolScopeBarProps {
  /** Namespaces the picker's ids and test ids (`{idPrefix}-trigger`, `-search`, `-select`). */
  idPrefix: string;
  /** What the picked pool feeds — shown while nothing is picked. */
  hint: string;
  /** Gate the underlying catalog read; the picker stays inert when `false`. */
  enabled?: boolean;
}

/**
 * The section's pool picker, with a summary of the picked pool beside it.
 *
 * The summary earns the bar its space: ticker, chain, lifecycle status, and the
 * catalog figures every card below is about — so the reader knows which pool the
 * whole section is on without scrolling back up to the catalog.
 */
export function PoolScopeBar({ idPrefix, hint, enabled = true }: PoolScopeBarProps) {
  const { contractAddress, market, setContractAddress, setMarket } = usePoolScope();

  return (
    <Card size="sm" className="@container" data-testid={`${idPrefix}-scope`}>
      <div className="flex flex-col gap-4 px-4 @3xl:flex-row @3xl:items-center">
        <div className="flex min-w-0 flex-col gap-1.5 @3xl:w-96 @3xl:shrink-0">
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Pool</span>
          <PoolSelect
            idPrefix={idPrefix}
            value={contractAddress}
            onValueChange={setContractAddress}
            onSelectedMarketChange={setMarket}
            enabled={enabled}
          />
        </div>
        {market === null ? (
          <p className="text-muted-foreground text-sm @3xl:pt-5">{hint}</p>
        ) : (
          <PoolSummary market={market} testId={`${idPrefix}-summary`} />
        )}
      </div>
    </Card>
  );
}

/** The picked pool at a glance: identity on one line, catalog figures on the next. */
function PoolSummary({ market, testId }: { market: ListingMarket; testId: string }) {
  const status = LISTING_STATUS_DISPLAY[market.marketStatus];
  const apr = market.marketStatus === ListingMarketStatus.LISTED ? market.apr : null;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3" data-testid={testId}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-foreground text-sm font-medium">{market.tokenTicker}</span>
        <span className="text-muted-foreground truncate text-sm">{market.tokenName}</span>
        <span className="text-muted-foreground font-mono text-xs" title={market.contractAddress}>
          {truncateContractAddress(market.contractAddress)}
        </span>
        <Badge variant="outline">{depositChainLabel(market.chainId)}</Badge>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 @xl:grid-cols-4">
        <Stat size="sm" label="TVL" value={formatListingUsd(market.tvl)} />
        <Stat size="sm" label="APR" value={formatListingRate(apr)} tone={rateTone(apr)} />
        <Stat size="sm" label="Open interest" value={formatListingUsd(market.openInterest)} />
        <Stat
          size="sm"
          label="Market id"
          value={market.symbolId === null ? "—" : `#${market.symbolId}`}
          hint={market.symbolId === null ? "Not on the solver yet" : `${market.maxLeverage}× max leverage`}
        />
      </div>
    </div>
  );
}
