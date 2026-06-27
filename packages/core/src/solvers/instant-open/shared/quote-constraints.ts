import { toDecimal } from "@symm-frontier/utils/decimal";
import type { PositionType } from "../../../symmio-contracts/symmio/types";
import { checkNotionalCap } from "../../notional-cap/check-notional-cap";
import type { MarketNotionalCap } from "../../notional-cap/types";
import type { SymbolContractSymbol } from "../../types/generated/enigma-solver";

/**
 * One reason a candidate instant-open quote violates the market's published
 * quote constraints. Returned in a list by
 * {@link validateInstantOpenAgainstMarket} so UIs can render the full set of
 * problems in one pass instead of fixing-and-resubmitting.
 *
 * All numeric fields are decimal strings (no rounding hop) so callers can
 * format them however they like.
 */
export type QuoteConstraintViolation =
  | {
      kind: "LF_PORTION_TOO_LOW";
      /** Market's `min_acceptable_portion_lf` (decimal fraction, e.g. `"0.1"`). */
      minPortion: string;
      /** Actual `lf / (cva + lf + partyAmm)` for the supplied locked margins. */
      actualPortion: string;
    }
  | {
      kind: "QUOTE_VALUE_TOO_LOW";
      /** Market's `min_acceptable_quote_value`. */
      minQuoteValue: string;
      /** Total locked margin `cva + lf + partyAmm` from {@link calculateTradeParams}. */
      actualQuoteValue: string;
    }
  | {
      kind: "NOTIONAL_TOO_HIGH";
      /** Market's `max_notional_value`. */
      maxNotional: string;
      /** `markPrice × quantity`. */
      actualNotional: string;
    }
  | {
      kind: "NOTIONAL_TOO_LOW";
      /** Market's `min_notional_value`. */
      minNotional: string;
      /** `markPrice × quantity`. */
      actualNotional: string;
    }
  | {
      kind: "QUANTITY_TOO_HIGH";
      /** Market's `max_quantity`. */
      maxQuantity: string;
      /** Final leveraged quantity. */
      actualQuantity: string;
    }
  | {
      kind: "QUANTITY_BELOW_LOT_SIZE";
      /** Market's `lot_size` — the smallest tradable quantity. */
      lotSize: string;
      /** Final leveraged quantity. */
      actualQuantity: string;
    }
  | {
      kind: "QUANTITY_NOT_LOT_MULTIPLE";
      /** Market's `lot_size` — quantity must be an integer multiple of this step. */
      lotSize: string;
      /** Final leveraged quantity. */
      actualQuantity: string;
    }
  | {
      kind: "CAP_REACHED";
      /** Side the trade was on. */
      side: PositionType;
      /** Available liquidity on that side, dollars (decimal string). */
      available: string;
      /** Requested notional, dollars (decimal string). */
      actualNotional: string;
    };

/**
 * Inputs to {@link validateInstantOpenAgainstMarket}.
 *
 * All numeric fields are decimal strings (matching the shape that
 * `calculateTradeParams` returns) so callers don't need to convert to wei
 * before validating. `market` comes from `getMarkets` (`/contract-symbols`);
 * `cva` / `lf` / `partyAmm` / `quantity` come straight off
 * {@link calculateTradeParams}.
 */
export interface ValidateInstantOpenAgainstMarketParameters {
  /** Market metadata carrying the constraint fields. */
  market: SymbolContractSymbol;
  /** Final leveraged quote quantity (decimal string, e.g. `"1.25"`). */
  quantity: string;
  /** Current mark price (decimal string) — used for the notional bounds. */
  markPrice: string;
  /** CVA locked margin from {@link calculateTradeParams} (decimal string). */
  cva: string;
  /** LF locked margin from {@link calculateTradeParams} (decimal string). */
  lf: string;
  /** PartyA maintenance margin from {@link calculateTradeParams} (decimal string). */
  partyAmm: string;
  /**
   * Optional solver-side liquidity cap for the market. When provided alongside
   * {@link positionType}, the validator rejects trades whose notional exceeds
   * the chosen side's available liquidity (`CAP_REACHED`). When the cap carries
   * a non-null `error`, the check is skipped.
   */
  notionalCap?: MarketNotionalCap;
  /** Side of the candidate trade — required for the {@link notionalCap} check. */
  positionType?: PositionType;
}

/** Result of {@link validateInstantOpenAgainstMarket}. */
export interface ValidateInstantOpenAgainstMarketReturnType {
  /** `true` when no violations fired. */
  ok: boolean;
  /** Every violation the candidate quote hit; empty when `ok` is `true`. */
  violations: QuoteConstraintViolation[];
}

/**
 * Check a candidate instant-open quote against the market's published quote
 * constraints. Each constraint is independent and skipped when the market
 * doesn't publish that field, so a partial constraint set (e.g. a market
 * without `max_quantity`) still validates the rest.
 *
 * Constraints (each maps to a {@link QuoteConstraintViolation}):
 * - **`min_acceptable_portion_lf`** — `lf / (cva + lf + partyAmm)` must be at
 *   least the published minimum.
 * - **`min_acceptable_quote_value`** — the locked-margin sum
 *   `cva + lf + partyAmm` must clear the floor.
 * - **`max_notional_value`** — `markPrice × quantity` must be at most the cap.
 * - **`min_notional_value`** — `markPrice × quantity` must clear the floor.
 * - **`max_quantity`** — `quantity` must be at most the cap.
 * - **`lot_size`** — `quantity` must be at least `lot_size` and an integer
 *   multiple of it (e.g. lot_size `0.2` allows 0.2, 0.4, 0.6, … but not 0.3).
 *
 * @example
 * ```ts
 * const trade = calculateTradeParams({ ... });
 * if (!trade) return;
 * const { ok, violations } = validateInstantOpenAgainstMarket({
 *   market,
 *   quantity: trade.quantity,
 *   markPrice,
 *   cva: trade.cva,
 *   lf: trade.lf,
 *   partyAmm: trade.partyAmm,
 * });
 * if (!ok) {
 *   // render `violations` to the user; don't call `instantOpen`.
 * }
 * ```
 */
export function validateInstantOpenAgainstMarket(
  parameters: ValidateInstantOpenAgainstMarketParameters,
): ValidateInstantOpenAgainstMarketReturnType {
  const { market, quantity, markPrice, cva, lf, partyAmm, notionalCap, positionType } = parameters;
  const violations: QuoteConstraintViolation[] = [];

  const cvaDec = toDecimal(cva);
  const lfDec = toDecimal(lf);
  const partyAmmDec = toDecimal(partyAmm);
  const lockedSum = cvaDec.plus(lfDec).plus(partyAmmDec);

  // 1. LF portion = lf / (cva + lf + partyAmm).
  const minPortionStr = market.min_acceptable_portion_lf;
  if (minPortionStr && !lockedSum.isZero() && !lockedSum.isNaN()) {
    const actualPortion = lfDec.div(lockedSum);
    const minPortion = toDecimal(minPortionStr);
    if (actualPortion.lt(minPortion)) {
      violations.push({
        kind: "LF_PORTION_TOO_LOW",
        minPortion: minPortion.toString(),
        actualPortion: actualPortion.toString(),
      });
    }
  }

  // 2. min_acceptable_quote_value — compare against locked-margin sum.
  const minQuoteValueStr = market.min_acceptable_quote_value;
  if (minQuoteValueStr) {
    const minQuoteValue = toDecimal(minQuoteValueStr);
    if (lockedSum.lt(minQuoteValue)) {
      violations.push({
        kind: "QUOTE_VALUE_TOO_LOW",
        minQuoteValue: minQuoteValue.toString(),
        actualQuoteValue: lockedSum.toString(),
      });
    }
  }

  // 3 & 4. Notional bounds use markPrice × quantity.
  const notional = toDecimal(markPrice).times(quantity);
  if (market.max_notional_value !== undefined) {
    const maxNotional = toDecimal(market.max_notional_value);
    if (notional.gt(maxNotional)) {
      violations.push({
        kind: "NOTIONAL_TOO_HIGH",
        maxNotional: maxNotional.toString(),
        actualNotional: notional.toString(),
      });
    }
  }
  if (market.min_notional_value) {
    const minNotional = toDecimal(market.min_notional_value);
    if (notional.lt(minNotional)) {
      violations.push({
        kind: "NOTIONAL_TOO_LOW",
        minNotional: minNotional.toString(),
        actualNotional: notional.toString(),
      });
    }
  }

  // 5. max_quantity.
  const actualQuantity = toDecimal(quantity);
  if (market.max_quantity) {
    const maxQuantity = toDecimal(market.max_quantity);
    if (actualQuantity.gt(maxQuantity)) {
      violations.push({
        kind: "QUANTITY_TOO_HIGH",
        maxQuantity: maxQuantity.toString(),
        actualQuantity: actualQuantity.toString(),
      });
    }
  }

  // 6. lot_size — quantity must be ≥ lot_size AND an exact integer multiple.
  // Skip the multiple-of check when below the minimum so the user sees one
  // clear error at a time.
  if (market.lot_size) {
    const lotSize = toDecimal(market.lot_size);
    if (lotSize.gt(0) && !lotSize.isNaN()) {
      if (actualQuantity.lt(lotSize)) {
        violations.push({
          kind: "QUANTITY_BELOW_LOT_SIZE",
          lotSize: lotSize.toString(),
          actualQuantity: actualQuantity.toString(),
        });
      } else if (!actualQuantity.mod(lotSize).isZero()) {
        violations.push({
          kind: "QUANTITY_NOT_LOT_MULTIPLE",
          lotSize: lotSize.toString(),
          actualQuantity: actualQuantity.toString(),
        });
      }
    }
  }

  // 7. Solver-side available liquidity for the chosen side. Delegates to
  // {@link checkNotionalCap} so the rule stays consistent with the standalone
  // pre-trade check.
  if (notionalCap && positionType !== undefined) {
    const result = checkNotionalCap({ positionType, notional: notional.toString(), cap: notionalCap });
    if (!result.ok) {
      violations.push({
        kind: "CAP_REACHED",
        side: result.side,
        available: String(result.available),
        actualNotional: result.requestedNotional,
      });
    }
  }

  return { ok: violations.length === 0, violations };
}
