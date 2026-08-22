"use client";

import { QuoteStatus, type UnifiedQuote } from "@symmio/trading-core";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePrismPositions } from "./positions-provider";

/** First re-read, ms after the receipt. */
const BASE_DELAY_MS = 1_500;
/** Ceiling the doubling backoff settles at. */
const MAX_DELAY_MS = 12_000;
/** How long to keep chasing before giving up and leaving the row to the feed. */
const BUDGET_MS = 120_000;

/** The two statuses that mean a close request is still on the position. */
function isCloseOutstanding(quote: UnifiedQuote): boolean {
  return quote.quoteStatus === QuoteStatus.CLOSE_PENDING || quote.quoteStatus === QuoteStatus.CANCEL_CLOSE_PENDING;
}

export interface CloseCancelChase {
  /** Start chasing the on-chain read. Called once the cancel's receipt is in. */
  start: () => void;
  /** True while a re-read is still owed — the row is showing a state the chain has already left. */
  isChasing: boolean;
}

/**
 * Re-read the chain until it admits the close is off the position.
 *
 * Every other write on this row is answered by something that arrives on its
 * own. This one is not, and the gap is structural rather than incidental:
 *
 * - `useGroupedQuotes` is **events-first and does not poll at idle**. Its
 *   `refetchInterval` is `false` while the notification socket is up and no row
 *   is awaiting on-chain confirmation, and a `CANCEL_CLOSE_PENDING` row is
 *   lifecycle `ONCHAIN`, so it accelerates nothing.
 * - The event that would stand in for the poll never comes. `requestToCancelCloseRequest`
 *   and `forceCancelCloseRequest` are partyA transactions the wallet broadcasts;
 *   the solver has no part in them and publishes no frame. The SDK's own
 *   cancel-confirm chase — which exists for exactly this failure, and whose
 *   comment says a cancelled order "stays on screen indefinitely" without it —
 *   is armed by `isCancelAction(notification.lastSeenAction)`, and that set
 *   covers only the open side (`RequestToCancelQuote`, `ForceCancelQuote`, …).
 *   There is no close-side member, so nothing arms it here.
 *
 * That leaves the single `invalidateQueries` the write hook fires after the
 * receipt as the only re-read the row will ever get — and one shot is not
 * enough, because the read and the write do not have to be talking to the same
 * node. Prism's transports are `fallback([...])` pairs, so the block that
 * cleared the close can be one the reading node has not caught up with; the
 * refetch then returns the pre-cancel struct, the row keeps rendering
 * `Force cancel` for a close that is already gone, and nothing re-reads again.
 *
 * So the app supplies the hold the SDK has for the other three flows: a bounded
 * doubling backoff that stops the moment the chain reports the position is no
 * longer carrying a close request, and gives up after {@link BUDGET_MS} rather
 * than polling forever.
 *
 * @param quote The row being cancelled — its `quoteStatus` is the stop condition.
 */
export function useCloseCancelChase(quote: UnifiedQuote): CloseCancelChase {
  const { refetch } = usePrismPositions();

  /* The context hands back a fresh closure on most renders, so depending on it
     directly would restart the effect — and reset the backoff to its first
     delay — on every tick it triggers. */
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  /** Unix ms the chase gives up at; `0` when nothing is being chased. */
  const [deadline, setDeadline] = useState(0);
  const outstanding = isCloseOutstanding(quote);
  const isChasing = deadline > 0 && outstanding;

  useEffect(() => {
    if (deadline === 0) return;
    /* The chain has answered, or the budget is spent. Either way this row is no
       longer owed a re-read. */
    if (!outstanding || Date.now() > deadline) {
      setDeadline(0);
      return;
    }

    let delay = BASE_DELAY_MS;
    let timer = 0;
    const tick = () => {
      if (Date.now() > deadline) {
        setDeadline(0);
        return;
      }
      refetchRef.current();
      /* Doubling, like the SDK's own confirm hold: the first re-read covers a
         node that is one block behind, and the later ones cost nothing while a
         genuinely lagging node catches up. */
      delay = Math.min(delay * 2, MAX_DELAY_MS);
      timer = window.setTimeout(tick, delay);
    };
    timer = window.setTimeout(tick, delay);

    return () => window.clearTimeout(timer);
  }, [deadline, outstanding]);

  const start = useCallback(() => setDeadline(Date.now() + BUDGET_MS), []);

  return { start, isChasing };
}
