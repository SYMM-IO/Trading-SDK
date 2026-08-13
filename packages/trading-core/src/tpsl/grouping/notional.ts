import { decimalPriceToWei } from "../../shared/utils/price";
import { mulWei } from "../../shared/utils/wei";
import type { GroupTpSlChild } from "./types";

/**
 * Open notional of one child (`openQuantity × openPrice`), wei.
 *
 * @param child - Any object carrying the child's open size and open price.
 * @returns The child's open notional in wei.
 */
export function childNotional(child: Pick<GroupTpSlChild, "openQuantity" | "openPrice">): bigint {
  return mulWei(child.openQuantity, child.openPrice);
}

/**
 * Convert a handler trigger price (decimal string) to 18-decimal wei.
 * Tolerates more precision than 18 decimals by rounding, where viem's
 * `parseUnits` would throw.
 *
 * Unlike {@link decimalPriceToWei}, an unusable price collapses to `0n` — the
 * handler's own "no trigger on this side" sentinel — so a half-typed price in an
 * input box never crashes the estimate.
 *
 * @param value - Decimal price string. Empty / non-numeric input yields `0n`.
 * @returns The price in wei.
 */
export function triggerPriceToWei(value: string): bigint {
  return decimalPriceToWei(value) ?? 0n;
}
