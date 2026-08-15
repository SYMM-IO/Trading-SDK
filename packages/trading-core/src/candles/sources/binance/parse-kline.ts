import { SymmError } from "../../../shared/errors/symm-error";
import type { Candle } from "../../types";

/**
 * A kline as Binance returns it: a positional tuple, not an object.
 *
 * Slots 6-11 (close time, quote volume, trade count, taker volumes, and an
 * unused field) are present on the wire but carry nothing a chart needs, so
 * they are typed loosely and ignored.
 */
export type RawBinanceKline = [
  openTime: number,
  open: string,
  high: string,
  low: string,
  close: string,
  volume: string,
  ...rest: unknown[],
];

/**
 * The `k` payload of a Binance kline WebSocket event.
 */
export interface RawBinanceKlineEvent {
  /** Bar open time, unix ms. */
  t: number;
  /** Interval string this bar belongs to (e.g. `"1m"`). */
  i: string;
  /** Open price. */
  o: string;
  /** High price. */
  h: string;
  /** Low price. */
  l: string;
  /** Close price — the latest price while the bar is still forming. */
  c: string;
  /** Base-asset volume. */
  v: string;
  /** `true` once the bar has closed and the next event starts a new one. */
  x: boolean;
}

function toFiniteNumber(value: unknown, field: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new SymmError("api", "INVALID_BINANCE_KLINE", `Binance kline has a non-numeric \`${field}\`: ${value}.`);
  }
  return parsed;
}

/**
 * Convert a Binance REST kline tuple into a {@link Candle}.
 *
 * @param kline - One entry from a `/klines` response.
 * @returns The normalized bar.
 * @throws {SymmError} when the tuple is malformed or carries non-numeric prices.
 *
 * @example
 * ```ts
 * parseBinanceKline([1700000000000, "42000.1", "42100", "41950", "42050", "12.5"]);
 * // → { time: 1700000000000, open: 42000.1, high: 42100, low: 41950, close: 42050, volume: 12.5 }
 * ```
 */
export function parseBinanceKline(kline: RawBinanceKline): Candle {
  if (!Array.isArray(kline) || kline.length < 6) {
    throw new SymmError(
      "api",
      "INVALID_BINANCE_KLINE",
      `Binance kline is not a tuple of at least 6 fields: ${JSON.stringify(kline)}.`,
    );
  }

  return {
    time: toFiniteNumber(kline[0], "openTime"),
    open: toFiniteNumber(kline[1], "open"),
    high: toFiniteNumber(kline[2], "high"),
    low: toFiniteNumber(kline[3], "low"),
    close: toFiniteNumber(kline[4], "close"),
    volume: toFiniteNumber(kline[5], "volume"),
  };
}

/**
 * Convert the `k` payload of a Binance kline WebSocket event into a {@link Candle}.
 *
 * @param event - The `k` object from a `kline` stream frame.
 * @returns The normalized bar.
 * @throws {SymmError} when the payload carries non-numeric prices.
 */
export function parseBinanceKlineEvent(event: RawBinanceKlineEvent): Candle {
  return {
    time: toFiniteNumber(event.t, "t"),
    open: toFiniteNumber(event.o, "o"),
    high: toFiniteNumber(event.h, "h"),
    low: toFiniteNumber(event.l, "l"),
    close: toFiniteNumber(event.c, "c"),
    volume: toFiniteNumber(event.v, "v"),
  };
}
