import { getAccountBalanceInfoQueryKey, getAccountBalanceOfQueryKey } from "@symmio/trading-core";
import type { QueryClient } from "@tanstack/react-query";
import { predicateMatch } from "./predicate-match";

/**
 * Invalidate every cached sub-account balance read — `balanceOf` and
 * `balanceInfoOfPartyA` — on one chain config.
 *
 * Call this from any mutation that moves collateral: an open locks margin and
 * charges a fee, a close releases margin and realizes PnL, a cancel unlocks a
 * pending quote's reserved margin. Without it those reads keep serving the
 * pre-trade value for as long as the consumer's `staleTime` allows, because a
 * mount only refetches when the entry is already stale.
 *
 * Invalidating also covers consumers that are not mounted at the time of the
 * write. An unmounted query cannot refetch, but it is flagged
 * `isInvalidated`, and TanStack checks that flag ahead of `staleTime` — so the
 * next mount refetches no matter how fresh the cached value looks.
 *
 * Scoped by `configKey`, not by account, on purpose: a position write can move
 * both a Virtual Account's balance and its parent sub-account's, while the
 * mutation variables carry only `partyA` — the VA for isolated positions, the
 * sub-account for cross-margin, never both.
 *
 * @param queryClient - The active TanStack query client.
 * @param scope - The chain-config fingerprint from `config.getChainConfigKey()`.
 *
 * @example
 * ```ts
 * onSuccess: (_result, variables) => {
 *   const configKey = config.getChainConfigKey(variables.chainId ?? chainId);
 *   invalidateAccountBalances(queryClient, { configKey });
 * };
 * ```
 */
export function invalidateAccountBalances(queryClient: QueryClient, scope: { configKey?: string }): void {
  void queryClient.invalidateQueries({ predicate: predicateMatch(getAccountBalanceOfQueryKey, scope) });
  void queryClient.invalidateQueries({ predicate: predicateMatch(getAccountBalanceInfoQueryKey, scope) });
}
