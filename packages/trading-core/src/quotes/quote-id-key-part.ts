/**
 * Stringify a list of quote ids for a TanStack query key, sorted ascending so
 * that two calls that pass the same ids in a different order share one cache
 * entry instead of fragmenting into two identical round-trips.
 *
 * Sorts numerically (not lexicographically) on a copy — the caller's array is
 * never mutated. `bigint` ids are stringified so the key survives structural
 * hashing, which cannot serialize a `bigint`.
 *
 * @param quoteIds - On-chain quote ids to put in the key.
 * @returns The ids as decimal strings, ascending.
 *
 * @example
 * ```ts
 * toQuoteIdKeyPart([10n, 9n, 100n]); // ["9", "10", "100"]
 * ```
 */
export function toQuoteIdKeyPart(quoteIds: readonly bigint[]): string[] {
  return [...quoteIds].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).map((id) => id.toString());
}
