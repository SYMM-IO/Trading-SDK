"use client";

import type { Deployment, MarketFamily } from "@/config/deployments";
import { useDeploymentQueries } from "@/features/data/use-deployment-queries";
import { getMarketInfoQueryOptions, type MarketInfo } from "@symmio/trading-core";
import { useCallback, useMemo } from "react";

/**
 * The 24-hour figures Prism can show for one market.
 *
 * `change24h` is optional on purpose: `/get_market_info` is one endpoint with
 * two shapes. Rasa returns price / change / volume / cap per market; Enigma
 * returns volume + lifetime value and no price change at all. The SDK surfaces
 * that divergence as a discriminated union rather than papering over it, so the
 * merged row type has to admit that one solver simply has no answer here.
 */
export interface MarketStat {
  /** Rolling 24-hour traded value, in dollars as the solver reports it. */
  volume24h: number;
  /** 24-hour price change in percent. Rasa only — Enigma publishes none. */
  change24h?: number;
}

export interface UseMarketStatsResult {
  /**
   * One market's 24h figures.
   *
   * Pass BOTH the market's `name` and its `symbol`: the two solvers key their
   * market-info map differently and the SDK does not reconcile it. Rasa keys by
   * name (`"SOLUSDT"`); Enigma keys by symbol (`"$WIF"`, where the market's name
   * is `"$WIF::EK..jm_SFLOW"`). The SDK normalises both into a field called
   * `symbol`, so keying by that field alone silently misses every Enigma market.
   */
  statOf: (family: MarketFamily, name: string, symbol?: string) => MarketStat | undefined;
  /** Σ 24h traded value for one family, or `undefined` while it loads. */
  volume24hOf: (family: MarketFamily) => number | undefined;
  /** True while any in-scope deployment is still loading its first response. */
  isLoading: boolean;
  /** Deployments whose market-info read failed. The others still render. */
  failures: readonly { deployment: Deployment; error: Error }[];
}

/**
 * Per-market 24h volume and price change, merged across every in-scope solver.
 *
 * One `useMarketInfo`-shaped read fanned out over the deployments: a single
 * call per solver returns the whole book's figures, which is why the merged
 * table can show volume for ~700 markets without a request per row.
 *
 * Market info moves on a 24h window, so it is cached for a minute rather than
 * polled — the live number on this screen is the mark price, not the volume.
 */
export function useMarketStats(): UseMarketStatsResult {
  const { results, isLoading, failures } = useDeploymentQueries<MarketInfo>((config, deployment) => ({
    ...getMarketInfoQueryOptions(config, {
      chainId: deployment.chainId,
      solverId: deployment.solverId,
    }),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  }));

  const { byFamily, totals } = useMemo(() => {
    const statsByFamily = new Map<MarketFamily, Map<string, MarketStat>>();
    const volumeByFamily = new Map<MarketFamily, number>();

    for (const result of results) {
      const info = result.data;
      if (!info) continue;

      const rows = new Map<string, MarketStat>();

      if (info.kind === "enigma") {
        for (const row of info.markets) {
          rows.set(row.symbol, { volume24h: row.tradingVolume });
        }
        /* Enigma publishes the aggregate itself — use it rather than re-summing. */
        volumeByFamily.set(result.deployment.family, info.totalValue24h);
      } else {
        let total = 0;
        for (const row of info.markets) {
          rows.set(row.symbol, { volume24h: row.tradeVolume, change24h: row.priceChangePercent });
          total += row.tradeVolume;
        }
        /* Rasa exposes no totals, so the family figure is summed here. The map
           is keyed by name, so fee-tier duplicates cannot double-count. */
        volumeByFamily.set(result.deployment.family, total);
      }

      statsByFamily.set(result.deployment.family, rows);
    }

    return { byFamily: statsByFamily, totals: volumeByFamily };
  }, [results]);

  const statOf = useCallback(
    (family: MarketFamily, name: string, symbol?: string) => {
      const rows = byFamily.get(family);
      return rows?.get(name) ?? (symbol ? rows?.get(symbol) : undefined);
    },
    [byFamily],
  );

  const volume24hOf = useCallback((family: MarketFamily) => totals.get(family), [totals]);

  return { statOf, volume24hOf, isLoading, failures };
}
