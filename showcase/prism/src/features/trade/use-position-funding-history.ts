"use client";

import { hasPlaceholderSubgraph } from "@/features/activity/subgraph-notice";
import { fromWei } from "@/lib/format";
import { FUNDING_HISTORY_EVENT_TYPES, QuoteEventType } from "@symmio/trading-core";
import { useQuoteEventsByType } from "@symmio/trading-react";
import { useMemo } from "react";
import type { PrismQuote } from "./positions-provider";

/**
 * Rows per read. A position charged hourly runs four days before it fills this,
 * and the subgraph's own ceiling is 1000 — deep enough that `hasMore` is the
 * rare case rather than the normal one, which is what lets the listed rows be
 * presented as the position's whole funding life.
 */
const PAGE_SIZE = 200;

/** Why the timeline is not a list of charges. Each needs different words. */
export type FundingHistoryState =
  | "known"
  /** The quote has no on-chain id yet, so no subgraph row can exist. */
  | "off-chain"
  | "loading"
  /** The read failed. */
  | "error"
  /** The quote is on-chain but no charge has been indexed against it. */
  | "empty"
  /** This deployment's subgraph is a placeholder that answers with another chain's data. */
  | "no-indexer";

/** One settled funding charge against the position. */
export interface FundingCharge {
  /** Subgraph event id — stable across refetches, so it is the React key. */
  key: string;
  /** Charge timestamp, seconds. */
  timestamp: number;
  /**
   * `received − paid` for this tick, wei. **Positive means it earned**, matching
   * the sign convention of the lifetime `netReceived` figure above it.
   */
  net: bigint;
  /**
   * The rate applied for this tick as an **unsigned** decimal fraction —
   * see {@link FundingCharge.net} for the direction. `undefined` when the event
   * carried no rate in its metadata.
   */
  rate?: number;
  /** A deferred catch-up charge rather than a periodic tick. */
  isCatchUp: boolean;
}

export interface PositionFundingHistory {
  /** Which of the six states the timeline is in. */
  state: FundingHistoryState;
  /** The charges, newest first. Empty unless {@link PositionFundingHistory.state} is `"known"`. */
  charges: readonly FundingCharge[];
  /** Sum of `net` over the listed charges, wei. */
  netListed: bigint;
  /** The subgraph held more charges than one page could return. */
  hasMore: boolean;
}

/**
 * Every funding charge this position has settled, newest first.
 *
 * The companion to `usePositionFunding`'s **Net funding**: that figure is the
 * lifetime total the analytics subgraph nets for a quote, this is the ledger it
 * nets *from*. A trader who sees a position has paid $18 of funding cannot tell
 * from the total whether it bled evenly for a week or took one punitive charge
 * when the rate flipped — and those are different trades to be holding.
 *
 * Each row nets its own tick the same way the total does, so the listed rows sum
 * to the total whenever the whole timeline fits in one page. They can disagree
 * for one honest reason, which the section reports rather than hides: a position
 * older than {@link PAGE_SIZE} charges is showing a window, not a life.
 *
 * The gating matches `usePositionFunding` exactly — same two preconditions, same
 * vocabulary for a missing answer — because the two figures sit next to each
 * other and a sheet that calls the same absence "not indexed yet" in one row and
 * "—" in the next reads as a bug in the row that is actually fine.
 *
 * @param row - The position, which carries its own deployment.
 * @returns The charges plus the state that explains them when there are none.
 */
export function usePositionFundingHistory(row: PrismQuote): PositionFundingHistory {
  const { quote, deployment } = row;

  const isAnchored = quote.quoteId !== undefined && quote.quoteId > 0n;
  /* Base's registry entry is a placeholder that answers with HyperEVM's data,
     so a majors row would list another chain's charges as its own. */
  const hasIndexer = !hasPlaceholderSubgraph(deployment);
  const enabled = isAnchored && hasIndexer;

  const events = useQuoteEventsByType({
    /* Never read when disabled — `0n` only has to keep the cache key hashable. */
    quoteId: enabled ? quote.quoteId! : 0n,
    types: FUNDING_HISTORY_EVENT_TYPES,
    chainId: deployment.chainId,
    first: PAGE_SIZE,
    orderDirection: "desc",
    query: { enabled },
  });

  return useMemo(() => {
    const charges: FundingCharge[] = (events.data?.rows ?? []).map((event) => ({
      key: event.eventId,
      timestamp: event.timestamp,
      net: (event.fundingReceived ?? 0n) - (event.fundingPaid ?? 0n),
      /* Magnitude only: the row's own paid/received answers the direction, and
         the sign convention of the published rate is not something this app can
         prove — a signed rate beside an opposite-signed amount reads as a bug. */
      rate: event.rate === undefined ? undefined : Math.abs(fromWei(event.rate)),
      isCatchUp: event.type === QuoteEventType.ChargeAccumulatedFundingFee,
    }));

    const state: FundingHistoryState = !isAnchored
      ? "off-chain"
      : !hasIndexer
        ? "no-indexer"
        : events.error
          ? "error"
          : events.isLoading
            ? "loading"
            : charges.length === 0
              ? "empty"
              : "known";

    return {
      state,
      charges,
      netListed: charges.reduce((total, charge) => total + charge.net, 0n),
      hasMore: events.data?.hasMore ?? false,
    };
  }, [events.data, events.error, events.isLoading, isAnchored, hasIndexer]);
}
