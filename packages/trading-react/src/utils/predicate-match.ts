import type { Query, QueryKey } from "@tanstack/react-query";

/**
 * Build a `predicate` for `queryClient.invalidateQueries({ predicate })` from a
 * core query-key factory and an optional partial of its options.
 *
 * A cache entry matches when:
 * 1. its key's leading tag equals the factory's tag (the key's first segment), and
 * 2. for every field in the partial, the key's trailing options object has an
 *    equal value. Omitted fields match anything.
 *
 * Both the partial and the stored keys are run through the same factory, so
 * `bigint` values are compared in the decimal-string form the factory emits.
 * This enables "invalidate every subaccount query for `user`, regardless of
 * pagination or chain" — which TanStack's leading-prefix matching can't express.
 *
 * @param keyFn - A core query-key factory, e.g. `getUserSubAccountsQueryKey`.
 * @param partial - Fields to match on. Omit to match every entry from `keyFn`.
 *
 * @example
 * ```ts
 * queryClient.invalidateQueries({
 *   predicate: predicateMatch(getUserSubAccountsQueryKey, { user }),
 * });
 * ```
 */
export function predicateMatch<options extends object>(
  keyFn: (options?: options) => readonly unknown[],
  partial?: options,
): (query: Query<unknown, Error, unknown, QueryKey>) => boolean {
  const reference = keyFn(partial);
  const tag = reference[0];
  const referenceFilter = (reference[1] ?? {}) as Record<string, unknown>;

  return (query) => {
    const key = query.queryKey;
    if (key[0] !== tag) return false;
    if (!partial) return true;

    const segment = key[1];
    if (typeof segment !== "object" || segment === null) return false;

    const record = segment as Record<string, unknown>;
    for (const [field, value] of Object.entries(referenceFilter)) {
      if (value === undefined) continue;
      if (record[field] !== value) return false;
    }
    return true;
  };
}
