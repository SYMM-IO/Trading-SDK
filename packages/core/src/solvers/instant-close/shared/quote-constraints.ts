import { toDecimal } from "@symm-frontier/utils/decimal";
import type { SymbolContractSymbol } from "../../types/generated/enigma-solver";

/**
 * One reason a candidate instant-close quote violates the market's published
 * quote constraints. Returned in a list by
 * {@link validateInstantCloseAgainstMarket}.
 *
 * All numeric fields are decimal strings so callers can format them however
 * they like. The `side` discriminator on the quantity / notional checks
 * tells the UI whether the close leg or the remaining-after-close leg
 * tripped the constraint.
 */
export type CloseQuoteConstraintViolation =
  | {
      kind: "CLOSE_QUANTITY_BELOW_LOT_SIZE";
      /** Market's `lot_size`. */
      lotSize: string;
      /** Final close quantity. */
      actualQuantity: string;
      /** Which leg of the close failed the floor. */
      side: "close" | "remaining";
    }
  | {
      kind: "CLOSE_QUANTITY_NOT_LOT_MULTIPLE";
      /** Market's `lot_size`. */
      lotSize: string;
      /** Final close quantity. */
      actualQuantity: string;
      /** Which leg of the close failed the multiple-of check. */
      side: "close" | "remaining";
    }
  | {
      kind: "REMAINING_LOCKED_BELOW_MIN_QUOTE_VALUE";
      /** Market's `min_acceptable_quote_value`. */
      minQuoteValue: string;
      /** Locked-margin sum (`cva + lf + partyAmm`) of the remaining position
       *  after the close. */
      remainingLockedSum: string;
    };

/**
 * Inputs to {@link validateInstantCloseAgainstMarket}.
 *
 * `cva` / `lf` / `partyAmm` are the **original** position's locked-margin
 * values (from the on-chain `Quote.lockedValues`). The validator scales them
 * down by `remainingQuantity / originalQuantity` to compute the
 * remaining-after-close locked sum used for the `min_acceptable_quote_value`
 * check.
 */
export interface ValidateInstantCloseAgainstMarketParameters {
  /** Market metadata carrying the constraint fields. */
  market: SymbolContractSymbol;
  /** Original (un-closed) position quantity (decimal string). */
  originalQuantity: string;
  /** Quantity being closed in this request (decimal string). */
  closeQuantity: string;
  /** Original CVA locked margin from the position's `lockedValues` (decimal string). */
  cva: string;
  /** Original LF locked margin (decimal string). */
  lf: string;
  /** Original PartyA maintenance margin (decimal string). */
  partyAmm: string;
}

/** Result of {@link validateInstantCloseAgainstMarket}. */
export interface ValidateInstantCloseAgainstMarketReturnType {
  /** `true` when no violations fired. */
  ok: boolean;
  /** Every violation the candidate close hit; empty when `ok` is `true`. */
  violations: CloseQuoteConstraintViolation[];
}

/**
 * Check a candidate instant-close quote against the market's published quote
 * constraints. Each constraint is independent and skipped when the market
 * doesn't publish that field, so a partial constraint set still validates
 * the rest.
 *
 * Constraints checked:
 * - **`lot_size`** — `closeQuantity` must be `≥ lot_size` and an exact
 *   integer multiple. When the close is partial, `remainingQuantity` must
 *   satisfy the same two rules so the leftover stays tradable.
 * - **`min_acceptable_quote_value`** — after the close, the remaining
 *   position's locked-margin sum (`cva + lf + partyAmm` scaled by
 *   `remainingQuantity / originalQuantity`) must clear the floor. Skipped
 *   on a full close (remaining = 0).
 */
export function validateInstantCloseAgainstMarket(
  parameters: ValidateInstantCloseAgainstMarketParameters,
): ValidateInstantCloseAgainstMarketReturnType {
  const { market, originalQuantity, closeQuantity, cva, lf, partyAmm } = parameters;
  const violations: CloseQuoteConstraintViolation[] = [];

  const originalQty = toDecimal(originalQuantity);
  const closeQty = toDecimal(closeQuantity);
  const remainingQty = originalQty.minus(closeQty);
  const isPartialClose = remainingQty.gt(0);

  // 1. lot_size — close + (when partial) remaining.
  if (market.lot_size) {
    const lotSize = toDecimal(market.lot_size);
    if (lotSize.gt(0) && !lotSize.isNaN()) {
      if (closeQty.lt(lotSize)) {
        violations.push({
          kind: "CLOSE_QUANTITY_BELOW_LOT_SIZE",
          lotSize: lotSize.toString(),
          actualQuantity: closeQty.toString(),
          side: "close",
        });
      } else if (!closeQty.mod(lotSize).isZero()) {
        violations.push({
          kind: "CLOSE_QUANTITY_NOT_LOT_MULTIPLE",
          lotSize: lotSize.toString(),
          actualQuantity: closeQty.toString(),
          side: "close",
        });
      }

      if (isPartialClose) {
        if (remainingQty.lt(lotSize)) {
          violations.push({
            kind: "CLOSE_QUANTITY_BELOW_LOT_SIZE",
            lotSize: lotSize.toString(),
            actualQuantity: remainingQty.toString(),
            side: "remaining",
          });
        } else if (!remainingQty.mod(lotSize).isZero()) {
          violations.push({
            kind: "CLOSE_QUANTITY_NOT_LOT_MULTIPLE",
            lotSize: lotSize.toString(),
            actualQuantity: remainingQty.toString(),
            side: "remaining",
          });
        }
      }
    }
  }

  // 2. min_acceptable_quote_value — only on partial close (full close zeroes
  // the locked sum, which is fine).
  if (isPartialClose && market.min_acceptable_quote_value && !originalQty.isZero()) {
    const minQuoteValue = toDecimal(market.min_acceptable_quote_value);
    const originalLocked = toDecimal(cva).plus(lf).plus(partyAmm);
    const remainingLocked = originalLocked.times(remainingQty).div(originalQty);
    if (remainingLocked.lt(minQuoteValue)) {
      violations.push({
        kind: "REMAINING_LOCKED_BELOW_MIN_QUOTE_VALUE",
        minQuoteValue: minQuoteValue.toString(),
        remainingLockedSum: remainingLocked.toString(),
      });
    }
  }

  return { ok: violations.length === 0, violations };
}
