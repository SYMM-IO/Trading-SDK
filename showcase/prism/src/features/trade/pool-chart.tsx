"use client";

import { EmptyState, Skeleton } from "@/components/table";
import type { PrismMarket } from "@/features/markets/types";
import { useEnigmaPriceServiceMetadata } from "@symmio/trading-react";
import { buildPoolEmbedUrl } from "./dexscreener-embed";

/**
 * Height of the DexScreener branding strip at the bottom of the embed, in
 * pixels. Measured from the rendered frame — if their footer ever changes
 * height, this is the one number to re-measure.
 */
const POOL_CHART_CHROME_PX = 36;

export interface PoolChartProps {
  market: PrismMarket;
}

/**
 * A lowcap market's chart, rendered from its liquidity pool.
 *
 * This is the counterpart to the candle chart, and the difference between them
 * is the point. A major has a reference-exchange listing, so the SDK can hand
 * over bars through a `CandleSource`. A lowcap has no listing at all — the pool
 * *is* the market — so there are no bars to stream, and the chart instead comes
 * from an indexer pointed at that pool.
 *
 * The SDK is still what makes this possible: `useEnigmaPriceServiceMetadata`
 * resolves a market's token address to its `chain_id` and `pair_address`, which
 * is exactly the pair a pool indexer needs. Without that lookup the app would
 * have no way to know which pool a SYMMIO lowcap market trades in.
 */
export function PoolChart({ market: entry }: PoolChartProps) {
  /* Enigma markets carry the underlying token address; majors have no such
     field, which is why this component is only ever rendered for lowcaps. */
  const tokenAddress = entry.market.kind === "enigma" ? entry.market.tokenAddress : undefined;

  const metadata = useEnigmaPriceServiceMetadata({
    chainId: entry.deployment.chainId,
    addresses: tokenAddress ? [tokenAddress] : [],
    query: { enabled: Boolean(tokenAddress), staleTime: 60_000 },
  });

  const pool = tokenAddress ? metadata.data?.[tokenAddress] : undefined;
  const chainSlug = pool?.chain_id?.toLowerCase();
  const pairAddress = pool?.pair_address;

  if (metadata.isPending && tokenAddress) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <Skeleton className="h-full min-h-[260px] w-full" />
      </div>
    );
  }

  if (metadata.isError) {
    return (
      <EmptyState
        className="my-auto"
        title="Pool lookup failed"
        body={metadata.error?.message ?? "The price service did not return pool metadata for this market."}
      />
    );
  }

  if (!chainSlug || !pairAddress) {
    return (
      <EmptyState
        className="my-auto"
        title="No pool indexed for this market"
        body="The price service knows this market but did not return a pool address, so there is no chart to point at. The live mark price above is still real."
      />
    );
  }

  const src = buildPoolEmbedUrl({ chainSlug, pairAddress });

  return (
    <div className="relative flex-1 overflow-hidden">
      {/* The frame is opaque — no error event, no API to push state into. Every
          option is a query flag baked into the src, so `key` forces a reload
          when one changes rather than trying to update in place.

          It also ends in a fixed-height branding strip that no query flag turns
          off, and CSS cannot reach into another origin's document. So the frame
          is given `POOL_CHART_CHROME_PX` of extra height past the clipping box:
          every control the chart owns stays reachable, the strip lands outside
          the visible area, and the pool's DexScreener link keeps its place in
          the stats panel beside this one. */}
      <iframe
        key={src}
        title="Pool chart"
        src={src}
        className="absolute top-0 left-0 w-full border-0"
        style={{ height: `calc(100% + ${POOL_CHART_CHROME_PX}px)` }}
        loading="lazy"
      />
    </div>
  );
}
