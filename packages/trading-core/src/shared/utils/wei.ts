/**
 * Scaling factor of an 18-decimal-wei fixed-point value (`10n ** 18n`).
 *
 * Every amount and price the SDK exposes is 18-decimal-wei `bigint`, so this is
 * the multiplier/divisor used whenever bigint math has to scale into or out of
 * that fixed-point representation.
 */
export const WEI = 10n ** 18n;
