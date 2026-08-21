"use client";

import { hasPlaceholderSubgraph } from "@/features/activity/subgraph-notice";
import { solverMarketKey } from "@/features/markets/market-key";
import type { PrismMarket } from "@/features/markets/types";
import { useMarkPrice } from "@/features/prices/price-provider";
import { fromWei } from "@/lib/format";
import { PositionType } from "@symmio/trading-core";
import { useFundingInfo, useQuoteGroupFunding } from "@symmio/trading-react";
import { useMemo } from "react";
import type { PrismGroup } from "./positions-provider";
import type { SettledFundingState } from "./use-position-funding";

export interface GroupFunding {
  /** Which of the six states the settled figure is in. */
  settledState: SettledFundingState;
  /**
   * Funding this group has settled over its life, wei — the sum across the
   * children the indexer answered for. **Positive means it earned.** A lower
   * bound while {@link isComplete} is `false`.
   */
  netSettled: bigint;
  /** Cumulative funding paid out across the resolved children, wei. */
  paid: bigint;
  /** Cumulative funding taken in across the resolved children, wei. */
  received: bigint;
  /** Children that produced a funding row. */
  resolvedCount: number;
  /** On-chain children the indexer is expected to answer for. */
  expectedCount: number;
  /** `true` when every on-chain child resolved, so the total is the group's whole settled funding. */
  isComplete: boolean;
  /**
   * Estimated funding for the epoch now running across the whole group, in
   * collateral units, as an unsigned magnitude — see {@link isUpcomingIncome}
   * for its direction. `undefined` when the market has no funding row or no
   * live mark.
   */
  upcoming?: number;
  /** True when the solver's rate says this side *receives* the upcoming charge. */
  isUpcomingIncome: boolean;
  /** Unix milliseconds of the next settlement. `undefined` when unreported. */
  nextFundingTime?: number;
  /** Epoch length in seconds — what "per epoch" means on this market. */
  epochSeconds?: number;
  /** The per-epoch rate this group's side is charged, as a decimal fraction. */
  rate?: number;
  isUpcomingLoading: boolean;
}

/**
 * What funding has cost a grouped position, and what the next epoch will cost it.
 *
 * The group-level twin of `usePositionFunding`, and it keeps that hook's two
 * distinctions — settled history versus a live estimate, and six different
 * reasons for "no number" rather than a `$0.00` that is wrong in five of them.
 * Two things are specific to a group:
 *
 * - **The settled total is a sum with a completeness flag.** Every child is
 *   fetched in one subgraph round-trip and folded by core's own
 *   `aggregateGroupFunding`, which reports how many children answered. A group
 *   whose newest leg is not indexed yet has a real total for its other legs, so
 *   the figure is shown as a lower bound and labelled, rather than withheld.
 * - **The upcoming estimate is sized on the group's whole open quantity.** The
 *   protocol charges each leg separately at the same rate, so the group's bill
 *   is the rate applied to the aggregate notional at the live mark.
 *
 * The settled figure is income-positive, the SDK's convention on
 * `QuoteGroupFunding.netReceived`. The *upcoming* figure is returned unsigned
 * with its direction beside it, because the sign convention of the solver's
 * published next-epoch rate is not something this app can prove.
 */
export function useGroupFunding(row: PrismGroup, market?: PrismMarket): GroupFunding {
  const { group, deployment } = row;

  const isAnchored = group.quotes.some((quote) => quote.quoteId !== undefined && quote.quoteId > 0n);
  /* Base's registry entry is a placeholder that answers with HyperEVM's data,
     so a majors group would report another chain's funding as its own. */
  const hasIndexer = !hasPlaceholderSubgraph(deployment);
  const isReadable = isAnchored && hasIndexer;

  const settled = useQuoteGroupFunding({
    group,
    chainId: deployment.chainId,
    query: { enabled: isReadable },
  });

  /* The filter is the solver's own market key, not the display name: Enigma
     answers `{}` for a decorated name, which reads as "no funding" rather than
     as a miss. */
  const symbol = market ? solverMarketKey(market.market) : undefined;
  const funding = useFundingInfo({
    chainId: deployment.chainId,
    solverId: deployment.solverId,
    symbols: symbol ? [symbol] : undefined,
    /* Without a refetch the countdown on the sheet runs to 00:00:00 and stays there. */
    query: { enabled: symbol !== undefined, refetchInterval: 60_000 },
  });

  const mark = useMarkPrice(row.family, market?.market.name ?? "");

  /* A group is keyed on market + direction, so every child shares one side —
     the fallback covers a custom fold that keyed on something else. */
  const positionType = group.by.positionType ?? group.quotes[0]?.positionType;

  return useMemo(() => {
    const info = symbol ? funding.data?.find((entry) => entry.symbol === symbol) : undefined;
    const rate = info
      ? positionType === PositionType.LONG
        ? info.nextFundingRateLong
        : info.nextFundingRateShort
      : undefined;

    /* Sized at the live mark rather than at entry: funding is charged on what
       the position is worth now, not on what it cost. */
    const notional = mark === undefined ? undefined : fromWei(group.metrics.openQuantity) * mark;
    const upcoming = rate !== undefined && notional !== undefined ? Math.abs(notional * rate) : undefined;

    const aggregate = settled.funding;
    const settledState: SettledFundingState = !isAnchored
      ? "off-chain"
      : !hasIndexer
        ? "no-indexer"
        : settled.error
          ? "error"
          : settled.isLoading
            ? "loading"
            : aggregate.resolvedCount > 0
              ? "known"
              : "not-indexed";

    return {
      settledState,
      netSettled: aggregate.netReceived,
      paid: aggregate.paid,
      received: aggregate.received,
      resolvedCount: aggregate.resolvedCount,
      expectedCount: aggregate.expectedCount,
      isComplete: aggregate.isComplete,
      upcoming,
      isUpcomingIncome: (rate ?? 0) > 0,
      nextFundingTime: info && info.nextFundingTime > 0 ? info.nextFundingTime : undefined,
      epochSeconds: info && info.epochDurationSeconds > 0 ? info.epochDurationSeconds : undefined,
      rate,
      isUpcomingLoading: funding.isLoading,
    };
  }, [
    settled.funding,
    settled.isLoading,
    settled.error,
    funding.data,
    funding.isLoading,
    symbol,
    group.metrics.openQuantity,
    positionType,
    mark,
    isAnchored,
    hasIndexer,
  ]);
}
