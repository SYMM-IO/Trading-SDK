"use client";

import { ResultError, ResultNote } from "@/components/result";
import type { EnigmaMetadata } from "@symmio/trading-core";
import { useEnigmaPriceServiceMetadata, useEnigmaPriceServiceSymbolsInfo } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { MarketSelect, type MarketSelectItem } from "@symmio/ui/components/market-select";
import { Spinner } from "@symmio/ui/components/spinner";
import { cn } from "@symmio/ui/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { MethodCard } from "../inspector/method-card";
import { buildDexScreenerPairUrl, DEXSCREENER_INTERVAL_OPTIONS, type DexScreenerInterval } from "./dexscreener-embed";
import { LowcapChart } from "./lowcap-chart";

/**
 * The lowcap half of the page: no `CandleSource`, one metadata read, and a
 * chart someone else renders.
 *
 * Lowcap markets trade in an on-chain pool, so there is no reference exchange to
 * pull bars from — the market above shows what that dead end looks like. What
 * the SDK does carry is the pool itself: `useEnigmaPriceServiceMetadata`
 * returns the market's `chain_id` and `pair_address`, and those two fields are
 * exactly what DexScreener needs to draw the pool's chart in an iframe.
 */
export function LowcapConsole() {
  const [address, setAddress] = useState("");
  const [interval, setChartInterval] = useState<DexScreenerInterval>("15");

  const symbols = useEnigmaPriceServiceSymbolsInfo({ query: { staleTime: 60_000 } });

  const marketItems = useMemo<MarketSelectItem[]>(
    () =>
      [...(symbols.data ?? [])]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((symbol) => ({
          id: symbol.address,
          /** Market names arrive as `TOKEN::<short address>_SFLOW`; lead with the ticker. */
          label: symbol.name.split("::")[0] ?? symbol.name,
          description: symbol.name,
          searchText: `${symbol.name} ${symbol.address}`,
        })),
    [symbols.data],
  );

  /** Land on a market rather than an empty frame; the picker takes over after that. */
  useEffect(() => {
    const first = marketItems[0];
    if (!address && first) setAddress(first.id);
  }, [address, marketItems]);

  const metadata = useEnigmaPriceServiceMetadata({
    addresses: address ? [address] : [],
    query: { enabled: Boolean(address), staleTime: 60_000 },
  });

  const pair = address ? metadata.data?.[address] : undefined;
  const chainSlug = pair?.chain_id?.toLowerCase();
  const isResolving = Boolean(address) && (metadata.isPending || metadata.isFetching);
  /** Metadata came back without a pool — the honest answer is "no chart", not a broken frame. */
  const isUnresolvable = metadata.isSuccess && !(pair?.pair_address && chainSlug);

  return (
    <MethodCard
      testId="method-useEnigmaPriceServiceMetadata-chart"
      name="useEnigmaPriceServiceMetadata → DexScreener"
      mutability="view"
      description="Chart a lowcap market from its liquidity pool. The price service resolves the market's chain and pair address; DexScreener renders that pool in an embedded frame. The pool sits on whatever chain the token trades on — the position itself is still USDC-margined on this deployment."
      wide
    >
      <div className="flex flex-wrap items-center gap-2">
        <MarketSelect
          idPrefix="lowcap-market"
          value={address}
          items={marketItems}
          onValueChange={(next) => {
            /** `MarketSelect` clears to `""`; keep the frame on its current pool instead. */
            if (next) setAddress(next);
          }}
          placeholder={symbols.isLoading ? "Loading markets…" : "Select a market…"}
          searchPlaceholder="Search market or token address…"
          emptyLabel="No markets available."
          emptyResultsLabel="No markets match this search."
          clearLabel="Clear market"
          className="w-56"
        />

        <div className="border-border inline-flex overflow-hidden rounded-md border" role="group" aria-label="Interval">
          {DEXSCREENER_INTERVAL_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setChartInterval(option.value)}
              aria-pressed={interval === option.value}
              data-testid={`button-lowcap-interval-${option.value}`}
              className={cn(
                "hover:bg-muted px-2.5 py-1.5 text-xs transition-colors motion-reduce:transition-none",
                interval === option.value
                  ? "bg-primary text-primary-foreground hover:bg-primary"
                  : "text-muted-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {pair?.pair_address && chainSlug ? (
          <Button asChild size="sm" variant="outline" data-testid="link-lowcap-dexscreener">
            <a href={buildDexScreenerPairUrl(chainSlug, pair.pair_address)} target="_blank" rel="noreferrer">
              Open on DexScreener
            </a>
          </Button>
        ) : null}

        <span className="text-muted-foreground ml-auto text-xs tabular-nums">
          {isResolving ? <Spinner className="size-3.5" /> : pair ? `$${pair.price_usd}` : null}
        </span>
      </div>

      {symbols.error ? (
        <ResultError testId="method-lowcap-symbols-error" kind={symbols.error.kind} message={symbols.error.message} />
      ) : null}

      {metadata.error ? (
        <ResultError
          testId="method-lowcap-metadata-error"
          kind={metadata.error.kind}
          message={metadata.error.message}
        />
      ) : null}

      {pair ? <PairSummary pair={pair} /> : null}

      <LowcapChart
        chainSlug={chainSlug}
        pairAddress={pair?.pair_address}
        interval={interval}
        loading={isResolving && !pair}
        emptyLabel={isUnresolvable ? "The price service has no pool for this market." : "Select a market to chart."}
      />

      <ResultNote testId="method-lowcap-basis">
        The frame draws the pool’s own spot price — a <code>dex-pool</code> basis, in the SDK’s vocabulary — not the
        SYMMIO solver mark a trade settles against. It is display-only: read prices from the price service, never from
        the chart.
      </ResultNote>
    </MethodCard>
  );
}

/** The metadata fields the chart is built from, shown so the wiring stays visible. */
function PairSummary({ pair }: { pair: EnigmaMetadata }) {
  const liquidity = pair.liquidity?.usd;

  return (
    <dl
      className="text-muted-foreground flex flex-wrap items-center gap-x-6 gap-y-1 text-xs"
      data-testid="lowcap-pair-summary"
    >
      <SummaryItem label="chain_id" value={pair.chain_id} />
      <SummaryItem label="dex_id" value={pair.dex_id} />
      <SummaryItem label="pair_address" value={shorten(pair.pair_address)} />
      {liquidity !== undefined && liquidity !== null ? (
        <SummaryItem label="liquidity" value={formatCompactUsd(liquidity)} />
      ) : null}
    </dl>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <dt className="font-mono">{label}</dt>
      <dd className="text-foreground font-mono">{value}</dd>
    </div>
  );
}

/** Pool addresses are EVM hex or Solana base58 — trim by length, not by format. */
function shorten(value: string): string {
  return value.length > 14 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}

function formatCompactUsd(value: number): string {
  return `$${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value)}`;
}
