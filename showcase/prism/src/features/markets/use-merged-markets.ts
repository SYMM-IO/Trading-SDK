"use client";

import type { Deployment } from "@/config/deployments";
import { useDeploymentQueries } from "@/features/data/use-deployment-queries";
import { getMarketsQueryOptions, type Market } from "@symmio/trading-core";
import { useMemo } from "react";
import { toMarketList } from "./market-list";
import { marketKey, type PrismMarket } from "./types";

export interface UseMergedMarketsResult {
  /** Every in-scope market, deduped per deployment then merged. */
  markets: readonly PrismMarket[];
  /**
   * Every listing by `family:symbolId` — including the ones `markets` collapses.
   *
   * A strict superset of `markets`, and it has to be: `toMarketList` keeps one
   * row per market *name*, so roughly three quarters of Rasa's `symbolId`s are
   * absent from the visible list. A position carries the exact symbolId it
   * traded, which is usually one of the dropped fee tiers — looked up in the
   * collapsed list it resolves to nothing, and the row renders as `#787` with no
   * symbol, no price precision and no mark price, indistinguishable from a
   * market list that has not loaded.
   *
   * `symbolId` is unique per raw row, so widening the index cannot change what
   * an existing key resolves to.
   */
  byKey: ReadonlyMap<string, PrismMarket>;
  isLoading: boolean;
  isFetching: boolean;
  /** Deployments whose market list failed to load. Others still render. */
  failures: readonly { deployment: Deployment; error: Error }[];
}

/**
 * Every market from every in-scope deployment, in one list.
 *
 * This is the "one book" of the app: majors and lowcaps side by side, each row
 * still carrying the deployment that will execute it. Filtering to one family
 * is then a filter on the tag, not a different code path.
 *
 * Market lists are large and change rarely, so they are cached for five minutes
 * and never refetched on focus.
 */
export function useMergedMarkets(options: { scope?: "mode" | "all" } = {}): UseMergedMarketsResult {
  const { results, isLoading, isFetching, failures } = useDeploymentQueries<Market[]>(
    (config, deployment) => ({
      ...getMarketsQueryOptions(config, {
        chainId: deployment.chainId,
        solverId: deployment.solverId,
      }),
      staleTime: 5 * 60_000,
      gcTime: 10 * 60_000,
    }),
    { scope: options.scope },
  );

  /** Indexed before the collapse, so a position can find the tier it traded. */
  const byKey = useMemo(() => {
    const index = new Map<string, PrismMarket>();

    for (const result of results) {
      if (!result.data) continue;
      for (const market of result.data) {
        if (!market.name) continue;
        const key = marketKey(result.deployment.family, market.symbolId);
        index.set(key, {
          market,
          deployment: result.deployment,
          family: result.deployment.family,
          key,
        });
      }
    }

    return index;
  }, [results]);

  const markets = useMemo(() => {
    const merged: PrismMarket[] = [];

    for (const result of results) {
      if (!result.data) continue;
      for (const market of toMarketList(result.data)) {
        merged.push({
          market,
          deployment: result.deployment,
          family: result.deployment.family,
          key: marketKey(result.deployment.family, market.symbolId),
        });
      }
    }

    /* Deepest markets first across the merged set, so BTC and ETH lead the
       combined book rather than whichever solver answered first. */
    return merged.sort(
      (a, b) => b.market.maxNotionalValue - a.market.maxNotionalValue || a.market.name.localeCompare(b.market.name),
    );
  }, [results]);

  return { markets, byKey, isLoading, isFetching, failures };
}
