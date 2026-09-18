import { SymmError } from "../errors/symm-error";

/** Decimal places of every SYMMIO Core amount: balances, operational-fee allowances and fee quotes. */
const CORE_DECIMALS = 18;

/**
 * Options for {@link core18ToCollateral}.
 */
export interface Core18ToCollateralOptions {
  /**
   * Which way to round an amount that does not fit the collateral token's
   * decimals.
   *
   * - `"up"` rounds toward positive infinity. Use it for anything that has to
   *   be funded — a fee, a shortfall, a required balance — so the token amount
   *   is never short. It matches the `(fee18 + scale - 1n) / scale` funding rule.
   * - `"down"` rounds toward negative infinity. Use it for an amount that must
   *   not be overstated, such as a balance you display or pay out.
   *
   * Both agree whenever the amount converts exactly.
   *
   * @default "up"
   */
  rounding?: "up" | "down";
}

/**
 * Scale a collateral-token amount up to SYMMIO Core's 18-decimal units.
 *
 * Two scales meet at every funding boundary. Token transfers, deposit and
 * withdrawal amounts, and a GaslessLayer's `depositFee`, `minimumDeposit` and
 * wallet creation fee use the **collateral token's decimals**. Core balances,
 * operational-fee allowances and every `GaslessFeeQuote` amount use **18
 * decimals**. Convert before comparing or adding values across the two: mixing
 * them is off by a factor of `10^(18 − collateralDecimals)`.
 *
 * The conversion is exact, because Core only accepts collateral tokens with at
 * most 18 decimals.
 *
 * @param amount - Amount in the collateral token's base units, e.g. `1_000000n`
 *   for 1 USDC.
 * @param collateralDecimals - The collateral token's decimals, an integer from 0
 *   to 18 — `config.getChainConfig(chainId).addresses.collateralDecimals`, or
 *   `GaslessFeeQuote.collateralDecimals`.
 * @returns The same amount in 18-decimal Core units.
 * @throws {SymmError} `COLLATERAL_DECIMALS_UNSUPPORTED` (`kind: "validation"`)
 *   when `collateralDecimals` is not an integer from 0 to 18.
 *
 * @example
 * ```ts
 * collateralToCore18(1_000000n, 6); // 1_000000000000000000n — 1 USDC in Core units
 *
 * // A relayed withdrawal needs the amount and its fee from the same Core balance.
 * const required18 = collateralToCore18(amount, collateralDecimals) + fee18;
 * ```
 */
export function collateralToCore18(amount: bigint, collateralDecimals: number): bigint {
  return amount * coreUnitScale(collateralDecimals, "collateralToCore18");
}

/**
 * Scale an 18-decimal SYMMIO Core amount down to the collateral token's base
 * units.
 *
 * Core balances, operational-fee allowances and `GaslessFeeQuote` amounts are
 * 18-decimal. A token transfer or a raw token balance is not. When the amount
 * has more precision than the token can hold, the remainder is rounded **up** by
 * default, so a fee converted into the tokens that must be sent to cover it is
 * never short. Pass `rounding: "down"` for an amount that must not be
 * overstated.
 *
 * @param amount18 - Amount in 18-decimal Core units.
 * @param collateralDecimals - The collateral token's decimals, an integer from 0
 *   to 18 — `config.getChainConfig(chainId).addresses.collateralDecimals`, or
 *   `GaslessFeeQuote.collateralDecimals`.
 * @param options - Rounding direction; see {@link Core18ToCollateralOptions}.
 * @returns The amount in the collateral token's base units.
 * @throws {SymmError} `COLLATERAL_DECIMALS_UNSUPPORTED` (`kind: "validation"`)
 *   when `collateralDecimals` is not an integer from 0 to 18.
 *
 * @example
 * ```ts
 * core18ToCollateral(50_000_000_000_000_000n, 6); // 50_000n — 0.05 USDC, exact
 * core18ToCollateral(1_000000000000000001n, 6); // 1_000001n — rounded up
 * core18ToCollateral(1_000000000000000001n, 6, { rounding: "down" }); // 1_000000n
 *
 * const feeInTokenUnits = core18ToCollateral(quote.totalFee18, quote.collateralDecimals);
 * ```
 */
export function core18ToCollateral(
  amount18: bigint,
  collateralDecimals: number,
  options?: Core18ToCollateralOptions,
): bigint {
  const scale = coreUnitScale(collateralDecimals, "core18ToCollateral");
  /** bigint division truncates toward zero: the ceiling of a negative amount, the floor of a positive one. */
  const truncated = amount18 / scale;
  if (truncated * scale === amount18) return truncated;
  if (options?.rounding === "down") return amount18 < 0n ? truncated - 1n : truncated;
  return amount18 > 0n ? truncated + 1n : truncated;
}

/**
 * The factor between a collateral token's base units and Core's 18-decimal
 * units, `10^(18 − collateralDecimals)`.
 *
 * @param collateralDecimals - The collateral token's decimals.
 * @param caller - The public helper's name, for the error message.
 * @returns The scale factor.
 * @throws {SymmError} `COLLATERAL_DECIMALS_UNSUPPORTED` when the decimals are
 *   not an integer from 0 to 18.
 */
function coreUnitScale(collateralDecimals: number, caller: string): bigint {
  if (!Number.isInteger(collateralDecimals) || collateralDecimals < 0 || collateralDecimals > CORE_DECIMALS) {
    throw new SymmError(
      "validation",
      "COLLATERAL_DECIMALS_UNSUPPORTED",
      `${caller}: collateralDecimals must be an integer from 0 to ${CORE_DECIMALS}; got ${describeDecimals(collateralDecimals)}. SYMMIO Core accepts no collateral token with more than 18 decimals.`,
    );
  }
  return 10n ** BigInt(CORE_DECIMALS - collateralDecimals);
}

/**
 * Render a rejected `collateralDecimals` so a string or bigint passed from
 * untyped code is distinguishable from the number it resembles.
 *
 * @param value - The rejected value.
 * @returns A short description, e.g. `6.5`, `"6"` or `6n`.
 */
function describeDecimals(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "bigint") return `${value}n`;
  return String(value);
}
