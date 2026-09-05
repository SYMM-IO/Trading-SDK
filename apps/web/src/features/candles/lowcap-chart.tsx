"use client";

import { useTheme } from "next-themes";
import { buildDexScreenerEmbedUrl, type DexScreenerInterval } from "./dexscreener-embed";

interface Props {
  /** Network slug from the price service's metadata (`chain_id`). */
  chainSlug?: string;
  /** Pool address from the price service's metadata (`pair_address`). */
  pairAddress?: string;
  /** Bar size to open the frame on. */
  interval: DexScreenerInterval;
  /** Metadata is still in flight — hold the layout with a skeleton. */
  loading?: boolean;
  /** Shown when there is no pool to point the frame at. */
  emptyLabel?: string;
}

/**
 * A lowcap market's chart, rendered by DexScreener inside an iframe.
 *
 * This is the counterpart to `CandleChart`, and the difference between
 * them is the point: that one draws bars the SDK handed it, this one hands a
 * pool address to someone else's chart. Lowcaps trade in an on-chain pool with
 * no reference-exchange listing, so there is no `CandleSource` to stream — the
 * pool is what the market *is*, and DexScreener already indexes it.
 *
 * The frame is opaque: it has no error event and no API for pushing state into
 * it. Everything configurable is a query flag baked into the src, so a theme or
 * interval change reloads the frame rather than updating it in place.
 */
export function LowcapChart({ chainSlug, pairAddress, interval, loading = false, emptyLabel }: Props) {
  const { resolvedTheme } = useTheme();
  /** Until `next-themes` resolves, dark is the safer guess against a dark card. */
  const theme = resolvedTheme === "light" ? "light" : "dark";

  if (loading) {
    return <div className="bg-muted/40 h-105 w-full animate-pulse rounded-xl" data-testid="lowcap-chart-skeleton" />;
  }

  if (!chainSlug || !pairAddress) {
    return (
      <div
        className="border-border/70 text-muted-foreground flex h-105 w-full items-center justify-center rounded-xl border border-dashed px-6 text-center text-sm"
        data-testid="lowcap-chart-empty"
      >
        {emptyLabel ?? "No pool for this market."}
      </div>
    );
  }

  const src = buildDexScreenerEmbedUrl({ chainSlug, pairAddress, theme, interval });

  return (
    <div className="border-border/70 h-105 w-full overflow-hidden rounded-xl border" data-testid="lowcap-chart">
      <iframe
        /** Reload on any flag change — the frame cannot be updated in place. */
        key={src}
        title="DexScreener chart"
        src={src}
        width="100%"
        height="100%"
        className="block border-0"
      />
    </div>
  );
}
