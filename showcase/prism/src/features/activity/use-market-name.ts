"use client";

import type { MarketFamily } from "@/config/deployments";
import { marketKey } from "@/features/markets/types";
import { useMergedMarkets } from "@/features/markets/use-merged-markets";
import { marketDisplayName } from "@/lib/format";
import { useCallback } from "react";

/** Resolves a `(family, symbolId)` pair to a display ticker. */
export type MarketNameLookup = (family: MarketFamily, marketId: number, fallback?: string | null) => string;

/**
 * Turn a market id into a ticker, using the merged market list as the index.
 *
 * Subgraph and notification payloads identify a market by `symbolId` and, at
 * best, a raw solver-decorated symbol (`BTCUSDT`, `WIF::`). The market list is
 * already loaded and cached for five minutes, so resolving against it costs
 * nothing and keeps every screen spelling a market the same way.
 *
 * Scope is `all` on purpose: an Activity row can outlive the palette mode that
 * produced it, and a row whose ticker disappears when the mode changes would be
 * worse than one that never had it.
 */
export function useMarketNameLookup(): MarketNameLookup {
  const { byKey } = useMergedMarkets({ scope: "all" });

  return useCallback(
    (family, marketId, fallback) => {
      const found = byKey.get(marketKey(family, marketId));
      if (found) return marketDisplayName(found.market.name);
      if (fallback) return marketDisplayName(fallback);
      return `#${marketId}`;
    },
    [byKey],
  );
}
