"use client";

import { ChainPill } from "@/components/pill";
import { DataRow } from "@/components/table";
import { Numeric } from "@/components/value";
import { FAMILY_PALETTE } from "@/config/deployments";
import { usePriceFlash } from "@/features/prices/use-price-flash";
import { cn } from "@/lib/cn";
import { formatLeverage, formatPercent, formatPrice, formatUsd, marketDisplayName } from "@/lib/format";
import Link from "next/link";
import type { MarketRowModel } from "./market-filters";

export interface MarketRowProps {
  row: MarketRowModel;
  /** Column template, shared with the header so the grid never drifts. */
  columns: string;
  /** Live mark price for this market, or `undefined` before the first tick. */
  price?: number;
  /** Open interest in dollars, or `undefined` when the solver has none for it. */
  openInterest?: number;
  /** Whether this listing is new enough to earn the badge. */
  isNew: boolean;
  /** Navigate the whole row to the ticket. */
  onOpen: () => void;
}

/**
 * One market in the merged book.
 *
 * Every row looks identical whichever solver listed it — the only difference is
 * the family stripe and the chain pill, which say where the trade will settle.
 * That sameness is the product claim: the user picks a market, not a solver.
 */
export function MarketRow({ row, columns, price, openInterest, isNew, onOpen }: MarketRowProps) {
  const { entry, volume24h, change24h } = row;
  const palette = FAMILY_PALETTE[entry.family];
  const priceFlash = usePriceFlash(price);

  return (
    <DataRow columns={columns} accent={palette.base} onClick={onOpen}>
      <div className="flex min-w-0 items-center gap-2">
        <span aria-hidden className="size-[7px] shrink-0 rounded-full" style={{ background: palette.base }} />
        <span className="truncate font-display text-md font-semibold tracking-[-0.02em] text-fg-0">
          {marketDisplayName(entry.market.name)}
        </span>
        {isNew ? (
          <span
            className="shrink-0 rounded-full border px-1.5 py-[1px] font-mono text-2xs font-semibold tracking-[0.12em] uppercase"
            style={{ color: palette.base, background: palette.soft, borderColor: palette.border }}
          >
            New
          </span>
        ) : null}
        <ChainPill family={entry.family} className="shrink-0" />
      </div>

      <div
        className={cn(
          "-my-1 -mr-1.5 rounded-sm py-1 pr-1.5 text-right",
          priceFlash === "up" && "prism-flash-long",
          priceFlash === "down" && "prism-flash-short",
        )}
      >
        {price === undefined ? (
          <Numeric tone="muted">—</Numeric>
        ) : (
          <Numeric tone="strong">{formatPrice(price, entry.market.pricePrecision)}</Numeric>
        )}
      </div>

      <div className="text-right">
        {change24h === undefined ? (
          <Numeric tone="muted">—</Numeric>
        ) : (
          <Numeric signed={change24h}>{formatPercent(change24h, { signed: true })}</Numeric>
        )}
      </div>

      <div className="text-right">
        {volume24h === undefined ? <Numeric tone="muted">—</Numeric> : <Numeric>{formatUsd(volume24h)}</Numeric>}
      </div>

      <div className="text-right">
        {openInterest === undefined ? <Numeric tone="muted">—</Numeric> : <Numeric>{formatUsd(openInterest)}</Numeric>}
      </div>

      <div className="text-right">
        <Numeric tone="muted">{formatLeverage(entry.market.maxLeverage)}</Numeric>
      </div>

      <div className="flex justify-end">
        <Link
          href={`/?market=${encodeURIComponent(entry.key)}`}
          onClick={(event) => event.stopPropagation()}
          className="inline-flex h-7 cursor-pointer items-center justify-center rounded-sm border border-line bg-bg-2 px-3 text-sm font-semibold whitespace-nowrap text-fg-0 transition-all duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:border-line-strong hover:bg-bg-3"
        >
          Trade
        </Link>
      </div>
    </DataRow>
  );
}
