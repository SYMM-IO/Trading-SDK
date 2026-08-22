"use client";

import { MicroLabel } from "@/components/panel";
import { EmptyState, Skeleton } from "@/components/table";
import { Numeric } from "@/components/value";
import type { PrismMarket } from "@/features/markets/types";
import { formatPercent, formatPrice, formatRelativeTime, formatUsd, shortenAddress } from "@/lib/format";
import { useEnigmaPriceServiceMetadata } from "@symmio/trading-react";
import { buildPoolPairUrl, poolChainColor } from "./dexscreener-embed";

export interface PoolStatsProps {
  market: PrismMarket;
}

/**
 * Pool vitals for a lowcap market — the counterpart to a depth ladder.
 *
 * A pool-traded market has no resting book, so there are no levels to show. It
 * does have the figures that actually govern a fill there: how deep the pool
 * is, what the token is worth in total, and how far it has moved today. The SDK
 * returns all of them from one metadata lookup, so showing an empty ladder
 * instead would be throwing away real information.
 */
export function PoolStats({ market: entry }: PoolStatsProps) {
  const tokenAddress = entry.market.kind === "enigma" ? entry.market.tokenAddress : undefined;

  const metadata = useEnigmaPriceServiceMetadata({
    chainId: entry.deployment.chainId,
    addresses: tokenAddress ? [tokenAddress] : [],
    query: { enabled: Boolean(tokenAddress), staleTime: 60_000 },
  });

  const pool = tokenAddress ? metadata.data?.[tokenAddress] : undefined;

  if (metadata.isPending && tokenAddress) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (!pool) {
    return (
      <EmptyState
        className="my-auto"
        title="No pool indexed"
        body="The price service did not return pool metadata for this market, so there is nothing to quote depth against."
      />
    );
  }

  const liquidity = pool.liquidity?.usd;
  const change = pool.price_change?.h24 ?? undefined;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-line-subtle px-4 py-2">
        <MicroLabel>Liquidity pool</MicroLabel>
        <span className="ml-auto font-mono text-2xs tracking-[0.12em] text-fg-3 uppercase">{pool.dex_id}</span>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <Row label="Pool liquidity" value={liquidity === undefined ? "—" : formatUsd(liquidity)} strong />
        <Row label="Market cap" value={pool.market_cap == null ? "—" : formatUsd(pool.market_cap)} />
        <Row
          label="24h change"
          value={change === undefined ? "—" : formatPercent(change, { signed: true })}
          signed={change}
        />
        <Row label="Price (USD)" value={formatPrice(Number(pool.price_usd), entry.market.pricePrecision)} />
        <Row label="Price (native)" value={formatPrice(Number(pool.price_native), entry.market.pricePrecision)} />

        <div className="mt-1 flex flex-col gap-2 border-t border-line-subtle pt-3">
          <Row label="Base token" value={pool.base_token.symbol} />
          <Row label="Pool created" value={formatRelativeTime(pool.pair_created_at)} />
          <Row label="Updated" value={formatRelativeTime(pool.updated_at)} />
        </div>

        {/* A lowcap perp settles on HyperEVM, but its pool lives on whatever
            chain the token launched on — often a different one entirely. The
            chain pill here is the POOL's chain, coloured by its own brand hex,
            so the two are never confused. */}
        <a
          href={buildPoolPairUrl(pool.chain_id, pool.pair_address)}
          target="_blank"
          rel="noreferrer"
          className="mt-1 flex items-center justify-center gap-2 rounded-md border border-line bg-bg-2 px-3 py-2 font-mono text-2xs text-fg-2 transition-colors duration-[var(--dur-fast)] hover:border-line-strong hover:text-fg-0"
        >
          <span
            aria-hidden
            className="size-[5px] shrink-0 rounded-full"
            style={{ background: poolChainColor(pool.chain_id) }}
          />
          {shortenAddress(pool.pair_address)} on {pool.chain_id} ↗
        </a>
      </div>

      <p className="mt-auto border-t border-line-subtle px-4 py-3 text-2xs leading-relaxed text-fg-3">
        This market fills against a pool, not a resting book. Size limits come from the market&rsquo;s notional cap
        rather than from depth at a price level.
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  strong = false,
  signed,
}: {
  label: string;
  value: string;
  strong?: boolean;
  signed?: number;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm text-fg-2">{label}</span>
      <Numeric size="sm" tone={strong ? "strong" : undefined} signed={signed}>
        {value}
      </Numeric>
    </div>
  );
}
