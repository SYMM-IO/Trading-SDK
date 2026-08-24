import { roundToTick } from "./tick-size";
import type { Orderbook, OrderbookDepthLevel, OrderbookDepthSummary, OrderbookLevel, OrderbookSpread } from "./types";

/**
 * Collapse a book onto a coarser price grid.
 *
 * Bids round **down** and asks round **up**, so a grouped level never claims
 * liquidity at a better price than actually rests there — a bid group labelled
 * `63018.0` holds orders from `63018.0` up to just under the next tick, all of
 * which a seller can hit at `63018.0` or better.
 *
 * Level ordering is preserved: bids stay descending, asks ascending.
 *
 * @param orderbook - The book to group.
 * @param tickSize - Grid spacing. Must be positive.
 * @returns A new book on the coarser grid. `lastUpdateId`, `timestamp`, and
 *   `marketName` are carried through unchanged.
 * @throws {SymmError} when `tickSize` is not a positive finite number.
 *
 * @example
 * ```ts
 * const grouped = groupOrderbook(book, 1);
 * // levels at 63018.1 / 63018.4 / 63018.9 collapse into one ask at 63019
 * ```
 */
export function groupOrderbook(orderbook: Orderbook, tickSize: number): Orderbook {
  return {
    ...orderbook,
    bids: groupLevels(orderbook.bids, tickSize, "down"),
    asks: groupLevels(orderbook.asks, tickSize, "up"),
  };
}

function groupLevels(levels: readonly OrderbookLevel[], tickSize: number, mode: "down" | "up"): OrderbookLevel[] {
  /**
   * A Map preserves insertion order, and the input is already sorted by price,
   * so the grouped output comes out sorted without a second sort pass.
   */
  const buckets = new Map<number, number>();

  for (const level of levels) {
    const price = roundToTick(level.price, tickSize, mode);
    buckets.set(price, (buckets.get(price) ?? 0) + level.size);
  }

  return Array.from(buckets, ([price, size]) => ({ price, size }));
}

/**
 * Annotate each level with the depth resting at or better than it.
 *
 * Totals are **inclusive** of the level's own size. That matters: an exclusive
 * running total leaves the best bid and best ask reading `0`, and normalizing
 * a depth bar against it silently understates every row by one level's size.
 *
 * @param levels - One side of a book, best price first.
 * @returns The same levels with `total` and `totalQuote` attached.
 *
 * @example
 * ```ts
 * accumulateOrderbook([
 *   { price: 100, size: 2 },
 *   { price: 99, size: 3 },
 * ]);
 * // [{ price: 100, size: 2, total: 2, totalQuote: 200 },
 * //  { price: 99, size: 3, total: 5, totalQuote: 497 }]
 * ```
 */
export function accumulateOrderbook(levels: readonly OrderbookLevel[]): OrderbookDepthLevel[] {
  let total = 0;
  let totalQuote = 0;

  return levels.map((level) => {
    total += level.size;
    totalQuote += level.price * level.size;
    return { ...level, total, totalQuote };
  });
}

/**
 * Best prices and the gap between them.
 *
 * @param orderbook - The book to measure.
 * @returns The spread, or `undefined` when either side is empty — a one-sided
 *   book has no spread, and reporting `0` would read as a locked market.
 *
 * @example
 * ```ts
 * const spread = getOrderbookSpread(book);
 * if (spread) console.log(`${spread.spread} (${spread.spreadBps.toFixed(1)} bps)`);
 * ```
 */
export function getOrderbookSpread(orderbook: Orderbook): OrderbookSpread | undefined {
  const bestBid = orderbook.bids[0]?.price;
  const bestAsk = orderbook.asks[0]?.price;

  if (bestBid === undefined || bestAsk === undefined) return undefined;

  const midPrice = (bestBid + bestAsk) / 2;
  const spread = bestAsk - bestBid;

  return {
    bestBid,
    bestAsk,
    spread,
    /** A mid of zero cannot happen on a real market, but division by it would poison the value. */
    spreadBps: midPrice > 0 ? (spread / midPrice) * 10_000 : 0,
    midPrice,
  };
}

/**
 * Measure the depth resting within a price band around the mid.
 *
 * More robust than top-of-book size: a single large order five percent away
 * moves top-of-book not at all and this figure not at all, while a wall of
 * small orders next to the mid moves this a lot. The `imbalance` it returns is
 * the usual read on which side is leaning.
 *
 * @param orderbook - The book to measure.
 * @param percent - Half-width of the band as a fraction of mid (`0.01` = ±1%).
 * @returns Per-side size, notional, and imbalance. All zero when the book has
 *   no mid (one side empty).
 *
 * @example
 * ```ts
 * const { imbalance } = getOrderbookDepthWithin(book, 0.01);
 * // imbalance > 0 → more bid notional than ask within ±1% of mid
 * ```
 */
export function getOrderbookDepthWithin(orderbook: Orderbook, percent: number): OrderbookDepthSummary {
  const empty: OrderbookDepthSummary = {
    percent,
    bidSize: 0,
    askSize: 0,
    bidQuote: 0,
    askQuote: 0,
    imbalance: 0,
  };

  const spread = getOrderbookSpread(orderbook);
  if (!spread) return empty;

  const floor = spread.midPrice * (1 - percent);
  const ceiling = spread.midPrice * (1 + percent);

  let bidSize = 0;
  let bidQuote = 0;
  for (const level of orderbook.bids) {
    /** Bids descend, so the first level below the floor ends the window. */
    if (level.price < floor) break;
    bidSize += level.size;
    bidQuote += level.price * level.size;
  }

  let askSize = 0;
  let askQuote = 0;
  for (const level of orderbook.asks) {
    if (level.price > ceiling) break;
    askSize += level.size;
    askQuote += level.price * level.size;
  }

  const totalQuote = bidQuote + askQuote;

  return {
    percent,
    bidSize,
    askSize,
    bidQuote,
    askQuote,
    imbalance: totalQuote > 0 ? (bidQuote - askQuote) / totalQuote : 0,
  };
}
