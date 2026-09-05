import type { QueryClient } from "@tanstack/react-query";

/**
 * Refetch the folded TP/SL reads for the given quotes.
 *
 * Call this after a successful set or cancel: the handler's REST rows are the
 * authoritative state, so refetching them overwrites the optimistic
 * `confirming` overlay `markConfirming` left in the store. Without it a box
 * resolves only when the live WebSocket frame arrives — and stays stuck
 * `confirming` (or keeps showing a cancelled value) whenever that frame is
 * missed.
 *
 * The `getQuoteTpSl` query key is matched by **shape**, not through
 * `getQuoteTpSlQueryKey`, because that factory throws on a partial (it
 * stringifies `quoteId`). Only the passed quotes' reads are invalidated, so an
 * unrelated market's TP/SL box is never disturbed.
 *
 * @param queryClient - The active TanStack query client.
 * @param quoteIds - On-chain quote ids whose TP/SL reads should refetch. `0n`
 *   sentinels are ignored.
 * @returns Resolves when the matching queries have been marked stale.
 */
export function invalidateTpSlReads(queryClient: QueryClient, quoteIds: readonly bigint[]): Promise<void> {
  const ids = new Set(quoteIds.filter((id) => id !== 0n).map((id) => id.toString()));
  if (ids.size === 0) return Promise.resolve();
  return queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey;
      if (!Array.isArray(key) || key[0] !== "getQuoteTpSl") return false;
      const params = key[1] as { quoteId?: string } | undefined;
      return typeof params?.quoteId === "string" && ids.has(params.quoteId);
    },
  });
}
