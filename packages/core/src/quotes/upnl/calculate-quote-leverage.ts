import { formatUnits } from "viem";

/** Decimal places of an 18-decimal-wei fixed-point value. */
const WEI_DECIMALS = 18;

/**
 * Inputs for {@link calculateQuoteLeverage}. All bigint fields are 18-decimal wei.
 */
export interface CalculateQuoteLeverageParameters {
  /** Quote quantity. */
  quantity: bigint;
  /** Quote's requested open price (used as the notional reference price). */
  requestedOpenPrice: bigint;
  /** Locked-margin legs (partyA + partyB) committed when the quote opened. */
  lockedValues: { cva: bigint; lf: bigint; partyAmm: bigint; partyBmm: bigint };
}

/**
 * Quote leverage as a decimal string.
 *
 * `leverage = quantity × requestedOpenPrice / (CVA + LF + partyAMM + partyBMM)`.
 *
 * Returns `"0"` when the locked-margin sum is zero (i.e. the quote has no
 * partyA-locked collateral on record yet) or when any input is non-finite.
 *
 * @example
 * ```ts
 * const lev = calculateQuoteLeverage({
 *   quantity: 1_000_000_000_000_000_000n,
 *   requestedOpenPrice: 50_000_000_000_000_000_000n,
 *   lockedValues: { cva: 1_000_000_000_000_000_000n, lf: 500_000_000_000_000_000n, partyAmm: 1_500_000_000_000_000_000n },
 * });
 * ```
 */
export function calculateQuoteLeverage(parameters: CalculateQuoteLeverageParameters): string {
  const quantity = Number(formatUnits(parameters.quantity, WEI_DECIMALS));
  const requestedOpenPrice = Number(formatUnits(parameters.requestedOpenPrice, WEI_DECIMALS));
  const lockedSum = Number(
    formatUnits(
      parameters.lockedValues.cva +
        parameters.lockedValues.lf +
        parameters.lockedValues.partyAmm +
        parameters.lockedValues.partyBmm,
      WEI_DECIMALS,
    ),
  );
  if (!Number.isFinite(quantity) || !Number.isFinite(requestedOpenPrice) || !Number.isFinite(lockedSum)) return "0";
  if (lockedSum === 0) return "0";
  const leverage = (quantity * requestedOpenPrice) / lockedSum;
  if (!Number.isFinite(leverage)) return "0";
  return String(leverage);
}
