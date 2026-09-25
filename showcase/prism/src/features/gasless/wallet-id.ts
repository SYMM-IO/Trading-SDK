/** Parse a GaslessWallet id without losing uint256 precision. */
export function parseGaslessWalletId(value: string): bigint | undefined {
  if (!/^\d+$/.test(value.trim())) return undefined;
  try {
    const parsed = BigInt(value.trim());
    return parsed <= 2n ** 256n - 1n ? parsed : undefined;
  } catch {
    return undefined;
  }
}
