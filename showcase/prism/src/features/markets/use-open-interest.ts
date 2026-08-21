"use client";

import { getDeployment, type Deployment, type MarketFamily } from "@/config/deployments";
import { useDeploymentQueries } from "@/features/data/use-deployment-queries";
import {
  getNotionalCapAllQueryOptions,
  getNotionalCapBySymbolIdQueryOptions,
  type GetNotionalCapAllReturnType,
  type MarketNotionalCap,
} from "@symmio/trading-core";
import { useSymmioConfig } from "@symmio/trading-react";
import { useQueries, type UseQueryOptions } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import type { PrismMarket } from "./types";

/**
 * Ceiling on per-symbol notional-cap reads.
 *
 * Solvers without a list endpoint need one request per market, so this bounds
 * the burst even if the render window is opened wide. Rows past the ceiling
 * report no open interest rather than firing hundreds of requests at a solver.
 */
export const MAX_PER_SYMBOL_OPEN_INTEREST = 60;

/** Where a family's open-interest figure came from — drives the honest label. */
export type OpenInterestSource = "solver-list" | "per-symbol";

export interface UseOpenInterestResult {
  /** Open interest in dollars for one merged row, when the solver reports it. */
  openInterestOf: (market: PrismMarket) => number | undefined;
  /** How a family's figure is sourced, so the UI can say so out loud. */
  sourceOf: (family: MarketFamily) => OpenInterestSource;
  /** Σ open interest for one family, only when the solver publishes a total. */
  totalOf: (family: MarketFamily) => number | undefined;
  /** True while any in-scope open-interest read is still loading. */
  isLoading: boolean;
  /** Deployments whose list read failed. The others still render. */
  failures: readonly { deployment: Deployment; error: Error }[];
}

/**
 * Open interest per market, merged across every in-scope solver.
 *
 * This is the sharpest edge of the multi-solver story. `getNotionalCapAll`
 * (`GET /notional_cap`) is an **Enigma-only** list endpoint: one call returns
 * every market's open interest plus the book-wide total. Rasa has no such
 * endpoint — only `GET /notional_cap/{symbolId}` — so majors have to be read a
 * symbol at a time, and Rasa's response carries `used` (notional consumed
 * against the cap) rather than a true open-interest figure.
 *
 * Prism therefore does both: one list call for the lowcap book, and per-symbol
 * calls for the majors rows that are actually on screen, capped at
 * {@link MAX_PER_SYMBOL_OPEN_INTEREST}. The screen labels which is which
 * instead of pretending the two columns mean the same thing.
 *
 * @param visible The rows currently rendered. Per-symbol reads follow the
 *   window, so scrolling the table does not fetch the whole book.
 */
export function useOpenInterest(visible: readonly PrismMarket[]): UseOpenInterestResult {
  const config = useSymmioConfig();

  const listed = useDeploymentQueries<GetNotionalCapAllReturnType>((sdkConfig, deployment) => ({
    ...getNotionalCapAllQueryOptions(sdkConfig, {
      chainId: deployment.chainId,
      solverId: deployment.solverId,
      /* The list endpoint exists on Enigma only. Gate on the solver kind
           rather than calling and catching UNSUPPORTED_BY_SOLVER. */
      query: { enabled: deployment.solverId === "enigma" },
    }),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  }));

  /* Rows whose solver has no list endpoint, bounded so a wide window cannot
     turn into hundreds of requests. */
  const perSymbolTargets = useMemo(
    () => visible.filter((entry) => entry.deployment.solverId !== "enigma").slice(0, MAX_PER_SYMBOL_OPEN_INTEREST),
    [visible],
  );

  const perSymbolQueries = useQueries({
    queries: perSymbolTargets.map(
      (entry) =>
        ({
          ...getNotionalCapBySymbolIdQueryOptions(config, {
            chainId: entry.deployment.chainId,
            solverId: entry.deployment.solverId,
            symbolId: entry.market.symbolId,
          }),
          staleTime: 30_000,
          gcTime: 5 * 60_000,
          /* A staging solver that 404s one symbol must not stall the column. */
          retry: 0,
        }) as UseQueryOptions<MarketNotionalCap, Error, MarketNotionalCap, readonly unknown[]>,
    ),
  });

  const listedByFamily = useMemo(() => {
    const grouped = new Map<MarketFamily, Map<number, number>>();
    for (const result of listed.results) {
      if (!result.data) continue;
      const bySymbolId = new Map<number, number>();
      for (const row of result.data.symbols) bySymbolId.set(row.symbolId, row.openInterest);
      grouped.set(result.deployment.family, bySymbolId);
    }
    return grouped;
  }, [listed.results]);

  const listedTotals = useMemo(() => {
    const totals = new Map<MarketFamily, number>();
    for (const result of listed.results) {
      if (!result.data) continue;
      totals.set(result.deployment.family, result.data.totalOpenInterest);
    }
    return totals;
  }, [listed.results]);

  const perSymbolByKey = useMemo(() => {
    const byKey = new Map<string, number>();
    perSymbolTargets.forEach((entry, index) => {
      const cap = perSymbolQueries[index]?.data;
      if (!cap) return;
      /* Enigma's per-symbol response carries real open interest; Rasa's carries
         only the notional already used against the cap. */
      byKey.set(entry.key, cap.kind === "enigma" ? cap.openInterest : cap.used);
    });
    return byKey;
  }, [perSymbolTargets, perSymbolQueries]);

  const openInterestOf = useCallback(
    (market: PrismMarket) => {
      if (market.deployment.solverId === "enigma") {
        return listedByFamily.get(market.family)?.get(market.market.symbolId);
      }
      return perSymbolByKey.get(market.key);
    },
    [listedByFamily, perSymbolByKey],
  );

  /* Derived from the solver kind, not from whether data has arrived — the label
     must be right on the first paint, before either read resolves. */
  const sourceOf = useCallback(
    (family: MarketFamily): OpenInterestSource =>
      getDeployment(family).solverId === "enigma" ? "solver-list" : "per-symbol",
    [],
  );

  const totalOf = useCallback((family: MarketFamily) => listedTotals.get(family), [listedTotals]);

  const isLoading = listed.isLoading || perSymbolQueries.some((query) => query.isLoading);

  return { openInterestOf, sourceOf, totalOf, isLoading, failures: listed.failures };
}
