import {
  getCollateralBalanceQueryKey,
  getGaslessWalletNonceQueryKey,
  getInstantLayerNonceQueryKey,
  getOperationalFeeAllowanceQueryKey,
  getSubAccountsCountOfUserQueryKey,
  getUserSubAccountsAddressesQueryKey,
  getUserSubAccountsQueryKey,
} from "@symmio/trading-core";
import type { QueryClient } from "@tanstack/react-query";
import { isAddress, type Address } from "viem";
import { invalidateAccountBalances } from "../utils/invalidate-account-balances";
import { predicateMatch } from "../utils/predicate-match";

/** Chain-config fingerprint every invalidation is scoped by. */
interface Scope {
  configKey?: string;
}

/**
 * Invalidate what every relayed action changes, whatever the action was.
 *
 * Two facts hold for all of them, because they are properties of the transport
 * rather than of the operation: the GaslessLayer deducts the operational fee
 * from SYMMIO collateral, and it deducts it from an allowance. So balances and
 * the payer's allowance are always stale afterwards.
 *
 * @param queryClient - The active TanStack query client.
 * @param scope - The chain-config fingerprint.
 * @param payer - The sub-account charged, when known; omitted invalidates every payer on the chain.
 *
 * @internal
 */
function invalidateRelayTransportReads(queryClient: QueryClient, scope: Scope, payer?: Address): void {
  invalidateAccountBalances(queryClient, scope);
  void queryClient.invalidateQueries({
    predicate: predicateMatch(getOperationalFeeAllowanceQueryKey, { ...scope, payer }),
  });
}

/**
 * Invalidate the reads a relayed InstantLayer batch changed.
 *
 * Only transport-level facts: `operationType` is a free-form label the fee
 * policy ignores, so the SDK cannot know which domain reads a batch touched and
 * must not guess. Callers who know the operation pass their own `onSuccess` to
 * `mutate`, which now runs after confirmation.
 *
 * @internal
 */
export function invalidateRelayInstantOperationsReads(
  queryClient: QueryClient,
  scope: Scope,
  signerAccounts: readonly Address[],
): void {
  const accounts = [...new Set(signerAccounts)];
  for (const account of accounts) {
    void queryClient.invalidateQueries({
      predicate: predicateMatch(getInstantLayerNonceQueryKey, { ...scope, account }),
    });
    void queryClient.invalidateQueries({
      predicate: predicateMatch(getOperationalFeeAllowanceQueryKey, { ...scope, payer: account }),
    });
  }
  invalidateAccountBalances(queryClient, scope);
}

/**
 * Invalidate the reads a relayed gasless-wallet `execute` changed.
 *
 * The wallet's own collateral balance moves, and its address is derived rather
 * than passed, so the collateral read is invalidated chain-wide.
 *
 * @internal
 */
export function invalidateGaslessWalletExecuteReads(queryClient: QueryClient, scope: Scope, owner?: Address): void {
  void queryClient.invalidateQueries({
    predicate: predicateMatch(getGaslessWalletNonceQueryKey, { ...scope, account: owner }),
  });
  void queryClient.invalidateQueries({ predicate: predicateMatch(getCollateralBalanceQueryKey, scope) });
  invalidateRelayTransportReads(queryClient, scope);
}

/**
 * Invalidate the reads a deposit settlement changed.
 *
 * The deposit address is swept to zero, so its collateral balance is
 * invalidated precisely when the acceptance receipt carries it. Deposit
 * *policy* is not invalidated: the fee and minimum are deployment facts a
 * settlement does not change.
 *
 * `depositAddress` arrives as the vendor's raw string, so a value that is not a
 * well-formed address widens to a chain-wide collateral invalidation rather
 * than scoping to nothing — a superset is correct, a silent no-op is not.
 *
 * @param options.wallet - Pass the owner for a new-account settlement to also
 *   refresh its sub-account lists; omit for a top-up into an existing account.
 *
 * @internal
 */
export function invalidateDepositSettlementReads(
  queryClient: QueryClient,
  scope: Scope,
  options: { depositAddress?: string; wallet?: Address },
): void {
  const owner = options.depositAddress && isAddress(options.depositAddress) ? options.depositAddress : undefined;
  void queryClient.invalidateQueries({ predicate: predicateMatch(getCollateralBalanceQueryKey, { ...scope, owner }) });
  if (options.wallet) {
    const user = { ...scope, user: options.wallet };
    void queryClient.invalidateQueries({ predicate: predicateMatch(getUserSubAccountsQueryKey, user) });
    void queryClient.invalidateQueries({ predicate: predicateMatch(getUserSubAccountsAddressesQueryKey, user) });
    void queryClient.invalidateQueries({ predicate: predicateMatch(getSubAccountsCountOfUserQueryKey, user) });
  }
  invalidateAccountBalances(queryClient, scope);
}
