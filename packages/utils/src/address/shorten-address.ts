import { getAddress, type Address } from "viem";

/**
 * Optional controls for {@link shortenAddress}.
 */
export interface ShortenAddressOptions {
  /**
   * Number of hex characters to keep on each side of the ellipsis (excluding
   * the leading `0x`). Defaults to `4` → `"0x1234…cdef"`.
   */
  chars?: number;
  /**
   * The ellipsis character placed between the prefix and suffix. Defaults to
   * the typographic horizontal ellipsis `"…"`; pass `"..."` for plain ASCII.
   */
  ellipsis?: string;
}

/**
 * Produce a short display form of an EVM address — checksummed prefix + suffix
 * joined by an ellipsis. Common UI affordance for transaction lists and account
 * pickers.
 *
 * The address is checksummed via viem's `getAddress` before slicing, so the
 * output matches what a block explorer would render. Invalid addresses throw
 * viem's `InvalidAddressError`.
 *
 * @example
 * shortenAddress("0x46493c376758da47823d7e3ae5d417ea6546eeb3"); // "0x4649…eEB3"
 * shortenAddress(addr, { chars: 6, ellipsis: "..." });           // "0x46493c...46eEB3"
 *
 * @param address - The EVM address to shorten.
 * @param opts - Optional formatting controls.
 */
export function shortenAddress(address: Address, opts?: ShortenAddressOptions): string {
  const checksummed = getAddress(address);
  const chars = opts?.chars ?? 4;
  const ellipsis = opts?.ellipsis ?? "…";
  const prefix = checksummed.slice(0, 2 + chars);
  const suffix = checksummed.slice(-chars);
  return `${prefix}${ellipsis}${suffix}`;
}
