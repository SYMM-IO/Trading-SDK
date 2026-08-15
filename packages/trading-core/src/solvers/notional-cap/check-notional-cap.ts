import { toDecimal } from "@symmio/utils/decimal";
import { PositionType } from "../../symmio-contracts/symmio/types";
import type { MarketNotionalCap } from "./types";

/**
 * Inputs to {@link checkNotionalCap}. `notional` is a decimal-string dollar
 * value (e.g. `"125.5"`), matching the `markPrice × quantity` shape used by
 * the rest of the open-side validation.
 */
export interface CheckNotionalCapInputs {
  /** Direction the trader wants to open. */
  positionType: PositionType;
  /** Requested notional value in dollars. */
  notional: string | number;
  /** Cap reading from {@link getNotionalCapBySymbolId}. */
  cap: MarketNotionalCap;
}

/**
 * Outcome of {@link checkNotionalCap}.
 *
 * `ok: true` when the trade fits within the side's available liquidity.
 * `ok: false` carries the available value for that side so the caller can
 * render a precise error ("Available to long: $X").
 */
export type CheckNotionalCapResult =
  | { ok: true }
  | {
      ok: false;
      kind: "CAP_REACHED";
      /** The side that was checked. */
      side: PositionType;
      /** Amount the solver will still accept on that side, dollars. */
      available: number;
      /** Requested notional, dollars (decimal string). */
      requestedNotional: string;
    };

/**
 * Reject a candidate open trade when its requested notional exceeds the
 * solver's available liquidity — the chosen side's availability on an Enigma
 * cap, or the market-wide remaining capacity (`totalCap − used`) on a Rasa cap,
 * which publishes no per-side split. Pure / framework-agnostic; pair with
 * `validateInstantOpenAgainstMarket` to gate sends.
 *
 * Returns `ok: true` (no-op) when the solver reported an `error` for the
 * market or when the available value is non-finite — that's a "no cap data" case,
 * not a "cap exceeded" case, and is surfaced separately via {@link MarketNotionalCap.error}.
 *
 * @example
 * ```ts
 * const result = checkNotionalCap({
 *   positionType: PositionType.LONG,
 *   notional: "150",
 *   cap,
 * });
 * if (!result.ok) {
 *   // render `result.available`
 * }
 * ```
 */
export function checkNotionalCap(inputs: CheckNotionalCapInputs): CheckNotionalCapResult {
  const { positionType, notional, cap } = inputs;
  if (cap.kind === "enigma" && cap.error) return { ok: true };

  // Rasa reports no per-side availability — only `total_cap` / `used` — so its
  // check runs against the market-wide remaining capacity instead.
  const available =
    cap.kind === "rasa"
      ? cap.totalCap - cap.used
      : positionType === PositionType.LONG
        ? cap.availableToLong
        : cap.availableToShort;
  if (!Number.isFinite(available)) return { ok: true };

  const requested = toDecimal(notional);
  if (requested.isNaN() || requested.lte(0)) return { ok: true };

  if (requested.gt(available)) {
    return {
      ok: false,
      kind: "CAP_REACHED",
      side: positionType,
      available,
      requestedNotional: requested.toString(),
    };
  }
  return { ok: true };
}
