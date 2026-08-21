import { formatUnits, parseUnits } from "viem";

/**
 * Parse a user-typed decimal amount into fixed point.
 *
 * Returns `undefined` for anything that is not a plain positive decimal, so a
 * call site can gate its submit button on the parse rather than on a regex of
 * its own. An empty string is `undefined`, not `0n` — "nothing typed yet" and
 * "typed zero" are different states in a funding form.
 */
export function parseAmount(input: string, decimals: number): bigint | undefined {
  const trimmed = input.trim();
  if (!trimmed || !/^\d*\.?\d*$/.test(trimmed) || trimmed === ".") return undefined;
  try {
    return parseUnits(trimmed, decimals);
  } catch {
    return undefined;
  }
}

/** Render a fixed-point bigint back into an input-ready decimal string. */
export function toAmountInput(value: bigint, decimals: number): string {
  return formatUnits(value, decimals);
}

/**
 * Rescale a fixed-point bigint between two decimal bases.
 *
 * The SDK mixes both: AccountLayer balances are always 1e18 while the deposit,
 * withdraw and ERC20 legs speak the collateral token's own decimals (6 for
 * USDC). Every conversion in this screen goes through here so the direction is
 * never guessed at a call site.
 */
export function rescale(value: bigint, from: number, to: number): bigint {
  if (from === to) return value;
  return to > from ? value * 10n ** BigInt(to - from) : value / 10n ** BigInt(from - to);
}
