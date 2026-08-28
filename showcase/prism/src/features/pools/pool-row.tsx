"use client";

import { DataRow } from "@/components/table";
import { Numeric } from "@/components/value";
import { formatLeverage, shortenAddress } from "@/lib/format";
import type { ListingMarket } from "@symmio/trading-core";
import { ListingStatusPill } from "./listing-chips";
import { depositChainColor, depositChainLabel, listingDate, listingRate, listingUsd, rateTone } from "./listing-values";

/**
 * The catalog's column template.
 *
 * It lives with the row rather than with the panel because the row is the one
 * piece that cannot take it as a prop — the head and the skeleton rows import
 * it from here, so the three can never drift apart. Every track carries a
 * `min-content` floor: a long token name must not shift the figures out from
 * under their own column heads.
 */
export const POOL_COLUMNS =
  "minmax(170px,1.8fr) minmax(130px,1.2fr) minmax(112px,min-content) minmax(90px,0.9fr) minmax(90px,0.9fr) minmax(92px,0.9fr) minmax(92px,0.9fr) minmax(96px,0.9fr) minmax(80px,0.8fr) minmax(72px,0.7fr) minmax(92px,min-content)";

export interface PoolRowProps {
  /** One catalog row, exactly as the listing service returned it. */
  row: ListingMarket;
  /** Open this pool's page. The whole row is the affordance. */
  onOpen: (row: ListingMarket) => void;
}

/**
 * One pool in the catalog.
 *
 * Three kinds of number sit side by side here and only two of them share a
 * scale: TVL and the volume columns are 18-decimal USD, APY is 18-decimal but
 * already a percentage, and max leverage is a bare multiplier. Every cell goes
 * through the helper that knows which one it is holding. Nothing on the row is
 * derived, filtered or re-sorted — the service already decided this pool
 * belongs on this page, in this position.
 */
export function PoolRow({ row, onOpen }: PoolRowProps) {
  return (
    <DataRow columns={POOL_COLUMNS} accent={depositChainColor(row.chainId)} onClick={() => onOpen(row)}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate font-display text-md font-semibold tracking-[-0.02em] text-fg-0">
          {row.tokenTicker}
        </span>
        <span className="truncate text-2xs text-fg-3">{row.tokenName}</span>
      </div>

      {/* The address is the pool's id in the rest of the listing API, and on
          Solana it is base58 rather than `0x…` — so it is shortened as a plain
          string and never handed to an EVM address helper. */}
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-1.5 text-sm text-fg-1">
          <span
            aria-hidden
            className="size-[6px] shrink-0 rounded-full"
            style={{ background: depositChainColor(row.chainId) }}
          />
          <span className="truncate">{depositChainLabel(row.chainId)}</span>
        </span>
        <span className="tnum truncate font-mono text-2xs text-fg-3">{shortenAddress(row.contractAddress)}</span>
      </div>

      <div className="min-w-0">
        <ListingStatusPill status={row.marketStatus} dot />
      </div>

      <MoneyCell value={row.tvl} />
      <MoneyCell value={row.vol24h} />
      <MoneyCell value={row.liquidity} />
      <MoneyCell value={row.marketCap} />
      <MoneyCell value={row.openInterest} />

      {/* The headline `apr`, which the catalog presents as APY. Descaled it is
          already the percentage — `listingRate` is the only formatter that knows
          that, and multiplying by 100 here would render −0.76% as −75.78%. */}
      <div className="text-right">
        <Numeric tone={rateTone(row.apr)}>{listingRate(row.apr)}</Numeric>
      </div>

      {/* Max leverage is a plain multiplier, not an 18-decimal figure — one of
          the few fields on this row that needs no descaling at all. */}
      <div className="text-right">
        <Numeric tone="muted">{formatLeverage(row.maxLeverage)}</Numeric>
      </div>

      <div className="text-right">
        <Numeric tone={row.listingTime === null ? "muted" : "default"} size="sm">
          {listingDate(row.listingTime)}
        </Numeric>
      </div>
    </DataRow>
  );
}

/**
 * One USD figure from the listing service.
 *
 * `null` is the service saying it has no value, which is not the same as `$0`:
 * a pool with no volume snapshot has not reported a quiet day. It renders as a
 * muted dash so the two can never be read as the same answer.
 */
function MoneyCell({ value }: { value: bigint | null }) {
  return (
    <div className="text-right">
      <Numeric tone={value === null ? "muted" : "default"}>{listingUsd(value)}</Numeric>
    </div>
  );
}
