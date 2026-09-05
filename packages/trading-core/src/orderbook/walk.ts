import type { Orderbook, OrderbookLevel, OrderbookWalk, OrderbookWalkSide } from "./types";

/**
 * Fill a hypothetical market order against resting depth.
 *
 * A buy consumes asks from the best (lowest) price outward; a sell consumes
 * bids from the best (highest) price outward. Nothing but the book is
 * considered — no fees, no funding, no solver spread — so treat the result as
 * the cost of liquidity, not a quote.
 *
 * Two caveats worth passing on to a user:
 * - The book is only as deep as the snapshot behind it. A `partial: true`
 *   result may mean the venue is thin, or merely that the subscription is
 *   tracking fewer levels than the order needs.
 * - When the source's `priceBasis` is `reference-exchange`, this is a
 *   third-party venue's liquidity, not the depth a SYMMIO trade executes against.
 *
 * @param orderbook - The book to walk.
 * @param side - `buy` to consume asks, `sell` to consume bids.
 * @param size - Base-asset quantity to fill.
 * @returns The fill: size, notional, average price, and slippage against the
 *   touch. Zero-filled when `size` is not positive or the side is empty.
 *
 * @example
 * ```ts
 * const walk = walkOrderbook(book, "buy", 5);
 * if (walk.partial) console.warn("not enough resting depth");
 * console.log(walk.averagePrice, `${walk.slippageBps.toFixed(1)} bps`);
 * ```
 */
export function walkOrderbook(orderbook: Orderbook, side: OrderbookWalkSide, size: number): OrderbookWalk {
  const levels: readonly OrderbookLevel[] = side === "buy" ? orderbook.asks : orderbook.bids;
  const bestPrice = levels[0]?.price;

  const requestedSize = Number.isFinite(size) && size > 0 ? size : 0;

  const empty: OrderbookWalk = {
    side,
    requestedSize,
    filledSize: 0,
    filledQuote: 0,
    bestPrice,
    slippageBps: 0,
    /** Nothing requested is not a shortfall; nothing available is. */
    partial: requestedSize > 0,
    levelsConsumed: 0,
  };

  if (requestedSize === 0 || bestPrice === undefined) return empty;

  let filledSize = 0;
  let filledQuote = 0;
  let worstPrice: number | undefined;
  let levelsConsumed = 0;

  for (const level of levels) {
    const remaining = requestedSize - filledSize;
    if (remaining <= 0) break;

    const taken = Math.min(level.size, remaining);
    if (taken <= 0) continue;

    filledSize += taken;
    filledQuote += taken * level.price;
    worstPrice = level.price;
    levelsConsumed += 1;
  }

  if (filledSize === 0) return empty;

  const averagePrice = filledQuote / filledSize;
  /**
   * A buy averages above the touch and a sell below it. Both are a cost, so
   * the sign is normalized rather than reported as a signed drift.
   */
  const drift = side === "buy" ? averagePrice - bestPrice : bestPrice - averagePrice;

  return {
    side,
    requestedSize,
    filledSize,
    filledQuote,
    averagePrice,
    bestPrice,
    worstPrice,
    slippageBps: bestPrice > 0 ? Math.max(0, (drift / bestPrice) * 10_000) : 0,
    partial: filledSize < requestedSize,
    levelsConsumed,
  };
}
