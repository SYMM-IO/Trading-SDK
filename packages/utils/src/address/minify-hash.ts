/**
 * Shorten a generic hex string (transaction hash, contract address, ABI
 * selector, etc.) to a `start…end` form. Unlike {@link shortenAddress} this
 * does **not** checksum-validate — it works on any string, including tx
 * hashes which are not addresses.
 *
 * Returns an em-dash (`—`) for nullish input so UI placeholders are
 * one-line-safe.
 *
 * @example
 * minifyHash("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef");
 * // "0x1234...cdef"
 *
 * minifyHash(null);      // "—"
 * minifyHash(undefined); // "—"
 *
 * @param hash - The string to shorten.
 * @param opts - Optional controls (length on each side, ellipsis character).
 */
export interface MinifyHashOptions {
  /** Characters to keep from the start (including any `0x` prefix). Defaults to `6`. */
  start?: number;
  /** Characters to keep from the end. Defaults to `4`. */
  end?: number;
  /** Ellipsis joiner. Defaults to `"..."`. */
  ellipsis?: string;
  /** Placeholder for nullish input. Defaults to `"—"`. */
  placeholder?: string;
}

export function minifyHash(hash: string | null | undefined, opts?: MinifyHashOptions): string {
  if (!hash) return opts?.placeholder ?? "—";
  const start = opts?.start ?? 6;
  const end = opts?.end ?? 4;
  const ellipsis = opts?.ellipsis ?? "...";
  return `${hash.slice(0, start)}${ellipsis}${hash.slice(-end)}`;
}
