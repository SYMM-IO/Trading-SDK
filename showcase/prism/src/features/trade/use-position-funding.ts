"use client";

import { hasPlaceholderSubgraph } from "@/features/activity/subgraph-notice";
import { solverMarketKey } from "@/features/markets/market-key";
import type { PrismMarket } from "@/features/markets/types";
import { useMarkPrice } from "@/features/prices/price-provider";
import { fromWei } from "@/lib/format";
import { PositionType } from "@symmio/trading-core";
import { useFundingInfo, useQuotesFunding } from "@symmio/trading-react";
import { useMemo } from "react";
import type { PrismQuote } from "./positions-provider";

/** Why the settled figure is not a number. Each needs different words. */
export type SettledFundingState =
  | "known"
  /** The quote has no on-chain id yet, so no subgraph row can exist. */
  | "off-chain"
  | "loading"
  /** The read failed. */
  | "error"
  /** The quote is on-chain but the indexer has not caught up. */
  | "not-indexed"
  /** This deployment's subgraph is a placeholder that answers with another chain's data. */
  | "no-indexer";

export interface PositionFunding {
  /** Which of the six states the settled figure is in. */
  settledState: SettledFundingState;
  /**
   * Funding this position has settled over its life, wei. **Positive means it
   * earned** — the SDK nets `received − paid` so a consumer never negates.
   * Only meaningful when {@link settledState} is `"known"`.
   */
  netSettled: bigint;
  /** Cumulative funding paid out, wei. */
  paid: bigint;
  /** Cumulative funding taken in, wei. */
  received: bigint;
  /**
   * Estimated funding for the epoch now running, in collateral units, as an
   * unsigned magnitude — see {@link isUpcomingIncome} for its direction.
   * `undefined` when the market has no funding row or no live mark.
   */
  upcoming?: number;
  /** True when the solver's rate says this side *receives* the upcoming charge. */
  isUpcomingIncome: boolean;
  /** Unix milliseconds of the next settlement. `undefined` when unreported. */
  nextFundingTime?: number;
  /** Epoch length in seconds — what "per epoch" means on this market. */
  epochSeconds?: number;
  /** The per-epoch rate this position's side is charged, as a decimal fraction. */
  rate?: number;
  isUpcomingLoading: boolean;
}

/**
 * What funding has cost this position, and what the next epoch will cost it.
 *
 * Two different facts from two different places, and the difference is worth
 * keeping straight in the UI:
 *
 * - **Settled** funding is history the protocol has already charged and the
 *   analytics subgraph has indexed. It is exact, and it exists only for a quote
 *   that is on-chain. Six distinct things can produce "no number" here — a
 *   pre-anchor row, a read in flight, a failed read, an indexer behind the
 *   chain, a deployment with no real indexer at all, and a genuine zero — so the
 *   state is reported rather than collapsed into `0n`. `$0.00` is the one answer
 *   that is wrong in five of those six cases.
 * - **Upcoming** funding is an estimate: the solver's next-epoch rate for this
 *   side, applied to the position's notional at the current mark. It moves with
 *   the price and is finalized at `nextFundingTime`.
 *
 * The settled figure is income-positive, which is the SDK's stated convention on
 * `QuoteFundingData.netReceived`. The *upcoming* figure is returned unsigned
 * with its direction beside it, because the sign convention of the solver's
 * published rate is not something this app can prove — see the caller's note.
 */
export function usePositionFunding(row: PrismQuote, market?: PrismMarket): PositionFunding {
  const { quote, deployment } = row;

  const isAnchored = quote.quoteId !== undefined && quote.quoteId > 0n;
  /* Base's registry entry is a placeholder that answers with HyperEVM's data,
     so a majors row would report another chain's funding as its own. */
  const hasIndexer = !hasPlaceholderSubgraph(deployment);

  /* The batched reader, not the single-quote wrapper: only this one reports
     `missingQuoteIds`, which is what separates "indexed as zero" from "not
     indexed yet". */
  const quotes = useMemo(
    () => (isAnchored && hasIndexer ? [{ quoteId: quote.quoteId }] : []),
    [isAnchored, hasIndexer, quote.quoteId],
  );
  const settled = useQuotesFunding({ quotes, chainId: deployment.chainId });

  /* The filter is the solver's own market key, not the display name: Enigma
     answers `{}` for a decorated name, which reads as "no funding" rather than
     as a miss. */
  const symbol = market ? solverMarketKey(market.market) : undefined;
  const funding = useFundingInfo({
    chainId: deployment.chainId,
    solverId: deployment.solverId,
    symbols: symbol ? [symbol] : undefined,
    /* Without a refetch the countdown below runs to 00:00:00 and stays there. */
    query: { enabled: symbol !== undefined, refetchInterval: 60_000 },
  });

  const mark = useMarkPrice(row.family, market?.market.name ?? "");

  return useMemo(() => {
    const info = symbol ? funding.data?.find((entry) => entry.symbol === symbol) : undefined;
    const rate = info
      ? quote.positionType === PositionType.LONG
        ? info.nextFundingRateLong
        : info.nextFundingRateShort
      : undefined;

    /* Sized at the live mark rather than at entry: funding is charged on what
       the position is worth now, not on what it cost. */
    const notional = mark === undefined ? undefined : fromWei(quote.openQuantity) * mark;
    const upcoming = rate !== undefined && notional !== undefined ? Math.abs(notional * rate) : undefined;

    const row0 = settled.rows[0] ?? null;
    const settledState: SettledFundingState = !isAnchored
      ? "off-chain"
      : !hasIndexer
        ? "no-indexer"
        : settled.error
          ? "error"
          : settled.isLoading
            ? "loading"
            : row0
              ? "known"
              : "not-indexed";

    return {
      settledState,
      netSettled: row0?.netReceived ?? 0n,
      paid: row0?.paid ?? 0n,
      received: row0?.received ?? 0n,
      upcoming,
      isUpcomingIncome: (rate ?? 0) > 0,
      nextFundingTime: info && info.nextFundingTime > 0 ? info.nextFundingTime : undefined,
      epochSeconds: info && info.epochDurationSeconds > 0 ? info.epochDurationSeconds : undefined,
      rate,
      isUpcomingLoading: funding.isLoading,
    };
  }, [
    settled.rows,
    settled.isLoading,
    settled.error,
    funding.data,
    funding.isLoading,
    symbol,
    quote,
    mark,
    isAnchored,
    hasIndexer,
  ]);
}
