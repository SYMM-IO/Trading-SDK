import { SymmError } from "../../../shared/errors/symm-error";
import type { OrderbookLevel } from "../../types";

/**
 * A price level as Binance sends it: a `[price, quantity]` pair of decimal
 * strings, in both the REST snapshot and the diff stream.
 */
export type RawBinanceDepthLevel = [price: string, quantity: string];

/**
 * The REST depth snapshot.
 *
 * `E` and `T` are futures-only; spot returns neither.
 */
export interface RawBinanceDepthSnapshot {
  /** Sequence number the snapshot is current as of. */
  lastUpdateId: number;
  /** Event time, unix ms. Futures only. */
  E?: number;
  /** Transaction time, unix ms. Futures only. */
  T?: number;
  bids: RawBinanceDepthLevel[];
  asks: RawBinanceDepthLevel[];
}

/**
 * A `depthUpdate` event from the diff stream.
 *
 * `pu` is futures-only and is the continuity signal there: it carries the
 * previous event's `u`. Spot has no `pu` and chains on `U === prev.u + 1`
 * instead — a rule that does **not** hold on futures, where `U` routinely jumps
 * hundreds of ids past the previous `u`.
 */
export interface RawBinanceDepthEvent {
  /** Event type; always `"depthUpdate"`. */
  e?: string;
  /** Event time, unix ms. */
  E?: number;
  /** Transaction time, unix ms. Futures only. */
  T?: number;
  /** Symbol, upper-case. */
  s?: string;
  /** First update id covered by this event. */
  U: number;
  /** Final update id covered by this event. */
  u: number;
  /** Final update id of the *previous* event. Futures only. */
  pu?: number;
  /** Bid levels to apply. */
  b?: RawBinanceDepthLevel[];
  /** Ask levels to apply. */
  a?: RawBinanceDepthLevel[];
}

function toFiniteNumber(value: unknown, field: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new SymmError("api", "INVALID_BINANCE_DEPTH", `Binance depth has a non-numeric \`${field}\`: ${value}.`);
  }
  return parsed;
}

/**
 * Convert one raw `[price, quantity]` pair into an {@link OrderbookLevel}.
 *
 * Zero-quantity entries are kept rather than filtered: in the diff stream a
 * zero is the venue's instruction to **remove** that price, and dropping it
 * here would leave the level resting forever.
 *
 * @param level - One entry from a `bids`/`asks` array.
 * @returns The parsed level.
 * @throws {SymmError} when the pair is malformed or non-numeric.
 */
export function parseBinanceDepthLevel(level: RawBinanceDepthLevel): OrderbookLevel {
  if (!Array.isArray(level) || level.length < 2) {
    throw new SymmError(
      "api",
      "INVALID_BINANCE_DEPTH",
      `Binance depth level is not a [price, quantity] pair: ${JSON.stringify(level)}.`,
    );
  }

  return {
    price: toFiniteNumber(level[0], "price"),
    size: toFiniteNumber(level[1], "quantity"),
  };
}

/**
 * Convert an array of raw levels, preserving order and zero-quantity entries.
 *
 * @param levels - A `bids` or `asks` array from a snapshot or diff event.
 * @returns The parsed levels.
 * @throws {SymmError} when the payload is not an array of valid pairs.
 */
export function parseBinanceDepthLevels(levels: RawBinanceDepthLevel[] | undefined): OrderbookLevel[] {
  if (levels === undefined) return [];

  if (!Array.isArray(levels)) {
    throw new SymmError(
      "api",
      "INVALID_BINANCE_DEPTH",
      `Binance depth side is not an array: ${JSON.stringify(levels)}.`,
    );
  }

  return levels.map(parseBinanceDepthLevel);
}
