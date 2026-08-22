"use client";

import { ChainPill, SolverPill } from "@/components/pill";
import { Numeric, Stat } from "@/components/value";
import { AccountSelector } from "@/features/accounts/account-selector";
import { solverMarketKey } from "@/features/markets/market-key";
import type { PrismMarket } from "@/features/markets/types";
import { useMarketStats } from "@/features/markets/use-market-stats";
import { usePoolMetadata } from "@/features/markets/use-pool-metadata";
import { useMarkPrice, useMarkTick } from "@/features/prices/price-provider";
import { formatCompact, formatLeverage, formatPercent, formatPrice, formatUsd } from "@/lib/format";
import { useFundingInfo, useNotionalCapBySymbolId } from "@symmio/trading-react";
import { useMemo } from "react";
import { MarketPicker, type MarketPickerProps } from "./market-picker";

export interface MarketHeaderProps extends MarketPickerProps {
  selected?: PrismMarket;
}

/**
 * The market strip: identity on the left, market stats on the right.
 *
 * Every figure comes from the deployment that serves this market — the header
 * is where the merged book resolves back to one concrete solver.
 */
export function MarketHeader({ markets, selected, onSelect }: MarketHeaderProps) {
  return (
    <div className="prism-trade-header shrink-0 items-center gap-x-8 gap-y-4 border-b border-line-subtle bg-bg-1 px-5 py-3.5">
      {/* The strip shares the workspace's column template, so the stat rail ends
          where the order book ends and the account selector sits over the
          ticket. A flex-wrapping header would instead re-height every row below
          it whenever a stat's width changed. */}
      <div className="flex min-w-0 items-center gap-x-8 gap-y-4 xl:col-start-1 xl:col-end-4">
        <div className="flex shrink-0 items-center gap-3">
          <MarketPicker markets={markets} selected={selected} onSelect={onSelect} />
          {selected ? (
            <div className="flex items-center gap-1.5">
              <SolverPill family={selected.family} />
              <ChainPill family={selected.family} />
            </div>
          ) : null}
        </div>

        {selected ? <MarketStats market={selected} /> : null}
      </div>

      {/* The strip's right edge used to be dead space. It now carries the one
          fact the ticket cannot state loudly enough: whose money this trades. */}
      {selected ? (
        <AccountSelector className="ml-auto shrink-0 xl:col-start-5 xl:ml-0" family={selected.family} />
      ) : null}
    </div>
  );
}

/**
 * Live stats for one market.
 *
 * Split out so the SDK reads receive a concrete `symbolId` rather than an
 * optional one — the SDK's query options treat a required action input as
 * required, and gating with `enabled` instead would be dishonest about it.
 */
function MarketStats({ market: entry }: { market: PrismMarket }) {
  const { chainId, solverId } = entry.deployment;

  /* Both figures key off the solver's market NAME, and the market-info read
     returns the whole book in one call — so this is the same query the markets
     table makes, shared through the cache rather than duplicated per screen. */
  const stats = useMarketStats();
  /* The filter must use the solver's own key — Enigma answers `{}` for a
     decorated market name, which reads as "no funding" rather than as a miss. */
  const marketKey = solverMarketKey(entry.market);
  const funding = useFundingInfo({ chainId, solverId, symbols: [marketKey] });
  const notional = useNotionalCapBySymbolId({ chainId, solverId, symbolId: entry.market.symbolId });

  /* Subscribing per market means the header repaints when THIS market ticks,
     not when any of the ~740 symbols on the Binance stream do. */
  const price = useMarkPrice(entry.family, entry.market.name);
  const tick = useMarkTick(entry.family, entry.market.name);

  /* Binance ticks carry an index price; the Enigma service does not. Narrowing
     on `provider` is how the SDK exposes that difference. */
  const indexPrice = tick?.provider === "binance" ? Number(tick.indexPrice) : undefined;

  const stat = stats.statOf(entry.family, entry.market.name, entry.market.symbol);

  /**
   * The two kinds report open interest differently under one type. Enigma's
   * per-symbol response carries real `openInterest` plus the side-by-side
   * availability that actually caps an order; Rasa's carries only the notional
   * already `used` against the cap. Reading `used` for both — as this header
   * first did — showed every lowcap as $0.00.
   */
  const cap = notional.data;
  const openInterest = cap ? (cap.kind === "enigma" ? cap.openInterest : cap.used) : undefined;
  const availableToTrade = cap?.kind === "enigma" ? Math.max(cap.availableToLong, cap.availableToShort) : undefined;

  /* A pool-priced market publishes no change through market-info, but its pool
     does. Same figure, different source — so the column is filled either way. */
  /* Memoised so the lookup's address list keeps a stable identity across the
     price ticks that re-render this header. */
  const poolScope = useMemo(() => [entry], [entry]);
  const pool = usePoolMetadata(poolScope);
  const change24h = stat?.change24h ?? pool.changeOf(entry);
  const fundingRow = funding.data?.find((row) => row.symbol === marketKey);

  return (
    <>
      <div className="flex flex-col gap-0.5">
        <Numeric size="2xl" tone="strong">
          {price === undefined ? "—" : formatPrice(price, entry.market.pricePrecision)}
        </Numeric>
        <span className="text-2xs text-fg-3">
          Mark{indexPrice !== undefined ? ` · index ${formatPrice(indexPrice, entry.market.pricePrecision)}` : ""}
        </span>
      </div>

      <div className="flex flex-wrap items-start gap-x-8 gap-y-3 xl:ml-auto">
        <Stat
          label="24h volume"
          value={
            <Numeric size="md" tone="strong">
              {stat === undefined ? "—" : formatUsd(stat.volume24h)}
            </Numeric>
          }
          sub={stat?.change24h === undefined ? undefined : `${formatPercent(stat.change24h, { signed: true })} 24h`}
        />
        <Stat
          label="Open interest"
          value={
            <Numeric size="md" tone="strong">
              {openInterest === undefined ? "—" : formatUsd(openInterest)}
            </Numeric>
          }
          sub={
            cap
              ? availableToTrade !== undefined
                ? `${formatCompact(availableToTrade)} available`
                : `cap ${formatCompact(Number(cap.totalCap))}`
              : notional.isError
                ? "unavailable"
                : undefined
          }
        />
        <Stat
          label="Funding / epoch"
          value={
            <Numeric size="md" signed={fundingRow?.nextFundingRateLong}>
              {fundingRow === undefined
                ? "—"
                : formatPercent(fundingRow.nextFundingRateLong * 100, { signed: true, decimals: 4 })}
            </Numeric>
          }
          sub={
            fundingRow && fundingRow.epochDurationSeconds > 0
              ? `every ${Math.round(fundingRow.epochDurationSeconds / 3600)}h · long side`
              : undefined
          }
        />
        <Stat
          label="Max leverage"
          value={
            <Numeric size="md" tone="strong">
              {formatLeverage(entry.market.maxLeverage)}
            </Numeric>
          }
        />
      </div>
    </>
  );
}
