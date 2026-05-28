import type { Query, QueryKey } from "@tanstack/react-query";
import type { TaggedQueryKey } from "./define-query-key";

/**
 * Build a `predicate` function suitable for
 * `queryClient.invalidateQueries({ predicate })` from a tagged key builder
 * and one optional partial per positional argument of that builder.
 *
 * A cache entry matches when:
 * 1. its `queryKey` starts with the builder's `prefix`, and
 * 2. for every partial provided, the matching trailing segment is a plain
 *    object whose fields equal the partial's fields. Omitted fields and
 *    `undefined` values in a partial match anything. `bigint` values in a
 *    partial are compared as their decimal string form, mirroring the
 *    serialization key builders use to keep cache keys hashable.
 *
 * @example
 * // Invalidate every getUserSubAccounts cache entry for `user`, any chain.
 * queryClient.invalidateQueries({
 *   predicate: predicateMatch(
 *     accountLayerQueryKeys.getUserSubAccounts,
 *     { user },
 *   ),
 * });
 *
 * @example
 * // No partials — match every entry produced by the builder.
 * queryClient.invalidateQueries({
 *   predicate: predicateMatch(accountLayerQueryKeys.getUserSubAccounts),
 * });
 */
export function predicateMatch<TArgs extends readonly unknown[]>(
  keyFn: TaggedQueryKey<TArgs>,
  ...partials: { [K in keyof TArgs]?: Partial<TArgs[K]> }
): (query: Query<unknown, Error, unknown, QueryKey>) => boolean {
  return (query) => {
    const key = query.queryKey;
    if (key.length < keyFn.prefix.length) return false;
    for (let i = 0; i < keyFn.prefix.length; i++) {
      if (key[i] !== keyFn.prefix[i]) return false;
    }
    for (let i = 0; i < partials.length; i++) {
      const partial = partials[i];
      if (partial === undefined) continue;
      const segment = key[keyFn.prefix.length + i];
      if (typeof segment !== "object" || segment === null) return false;
      const record = segment as Record<string, unknown>;
      for (const [field, raw] of Object.entries(partial)) {
        if (raw === undefined) continue;
        const expected = typeof raw === "bigint" ? raw.toString() : raw;
        if (record[field] !== expected) return false;
      }
    }
    return true;
  };
}
