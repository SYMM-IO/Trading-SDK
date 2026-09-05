import { SymmError } from "../shared/errors/symm-error";

/**
 * Decimal places a tick size implies.
 *
 * Handles the exponential form small ticks stringify to — `1e-9` is nine
 * decimals, not the zero a naive `split(".")` would report.
 *
 * @param tickSize - A positive price increment.
 * @returns Decimal places needed to write any multiple of the tick exactly.
 *
 * @example
 * ```ts
 * countTickDecimals(0.01);  // 2
 * countTickDecimals(1e-9);  // 9
 * countTickDecimals(50);    // 0
 * ```
 */
export function countTickDecimals(tickSize: number): number {
  if (!Number.isFinite(tickSize) || tickSize <= 0) return 0;

  const text = tickSize.toString();
  const exponentIndex = text.indexOf("e-");

  if (exponentIndex !== -1) {
    const exponent = Number(text.slice(exponentIndex + 2));
    const mantissaDecimals = text.slice(0, exponentIndex).split(".")[1]?.length ?? 0;
    return Math.min(100, exponent + mantissaDecimals);
  }

  return Math.min(100, text.split(".")[1]?.length ?? 0);
}

/** Which way {@link roundToTick} moves a price that is not already on the grid. */
export type TickRoundingMode = "down" | "up";

/**
 * Snap a price onto a tick grid.
 *
 * Bids round **down** and asks round **up**, so a grouped level never claims
 * liquidity at a better price than actually rests there.
 *
 * Division by a decimal tick is not exact in binary floating point —
 * `63018.1 / 0.1` is `630180.9999999999`, and flooring that loses a whole tick.
 * The quotient is therefore snapped to a nearby integer before rounding, and
 * the product is written back at the tick's own precision.
 *
 * @param price - The price to snap.
 * @param tickSize - Grid spacing. Must be positive.
 * @param mode - Direction to move a price that falls between ticks.
 * @returns The price on the grid.
 * @throws {SymmError} when `tickSize` is not a positive finite number.
 *
 * @example
 * ```ts
 * roundToTick(63018.17, 0.1, "down"); // 63018.1
 * roundToTick(63018.17, 0.1, "up");   // 63018.2
 * roundToTick(63018.1, 0.1, "up");    // 63018.1 — already on the grid
 * ```
 */
export function roundToTick(price: number, tickSize: number, mode: TickRoundingMode): number {
  if (!Number.isFinite(tickSize) || tickSize <= 0) {
    throw new SymmError(
      "validation",
      "INVALID_TICK_SIZE",
      `Tick size must be a positive finite number, got ${tickSize}.`,
    );
  }

  const units = price / tickSize;
  const nearest = Math.round(units);
  /** Treat a quotient within float noise of an integer as already on the grid. */
  const onGrid = Math.abs(units - nearest) < 1e-9 * Math.max(1, Math.abs(units));
  const snapped = onGrid ? nearest : mode === "down" ? Math.floor(units) : Math.ceil(units);

  return Number((snapped * tickSize).toFixed(countTickDecimals(tickSize)));
}

/** Multipliers applied to the venue tick to build a grouping ladder. */
const TICK_LADDER_STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10_000] as const;

/**
 * Options for {@link suggestOrderbookTickSizes}.
 */
export interface SuggestOrderbookTickSizesOptions {
  /**
   * Coarsest grouping to offer, as a fraction of the reference price.
   * Default `0.005` — half a percent, beyond which a ladder collapses into a
   * handful of rows and stops being readable.
   */
  maxFractionOfPrice?: number;
  /** Most entries to return. Default `8`. */
  maxSteps?: number;
}

/**
 * Build a grouping ladder from a venue's own tick size.
 *
 * Derived rather than hardcoded. A global list of candidate ticks — the
 * approach a UI reaches for first — offers groupings finer than the venue can
 * quote (rows that can never be occupied) and, on a low-priced asset, ones so
 * coarse the whole book lands in one row. Anchoring on the real tick and
 * stepping 1/2/5/10 keeps every entry both quotable and useful.
 *
 * @param tickSize - The venue's smallest price increment.
 * @param referencePrice - A price to scale against, typically the mid.
 * @param options - Ladder bounds.
 * @returns Tick sizes ascending, always starting with `tickSize` itself.
 *
 * @example
 * ```ts
 * suggestOrderbookTickSizes(0.1, 63_000); // [0.1, 0.2, 0.5, 1, 2, 5, 10, 20]
 * suggestOrderbookTickSizes(0.0001, 1.25); // [0.0001, 0.0002, 0.0005, 0.001, 0.002]
 * ```
 */
export function suggestOrderbookTickSizes(
  tickSize: number,
  referencePrice: number,
  options: SuggestOrderbookTickSizesOptions = {},
): number[] {
  if (!Number.isFinite(tickSize) || tickSize <= 0) return [];

  const { maxFractionOfPrice = 0.005, maxSteps = 8 } = options;
  const decimals = countTickDecimals(tickSize);
  const ceiling =
    Number.isFinite(referencePrice) && referencePrice > 0
      ? referencePrice * maxFractionOfPrice
      : Number.POSITIVE_INFINITY;

  const ladder: number[] = [];

  for (const step of TICK_LADDER_STEPS) {
    if (ladder.length >= maxSteps) break;
    const candidate = Number((tickSize * step).toFixed(decimals));
    /** The venue tick is always offered, even on an asset priced below it. */
    if (step > 1 && candidate > ceiling) break;
    ladder.push(candidate);
  }

  return ladder;
}
