import {
  getActiveDelegationsQueryKey,
  getDelegationExpiryQueryKey,
  getInstantLayerNonceQueryKey,
  getIsDelegationActiveQueryKey,
  getOperationalFeeAllowanceQueryKey,
  getPendingRevocationEtasQueryKey,
} from "@symmio/trading-core";
import type { QueryClient } from "@tanstack/react-query";
import type { Address } from "viem";
import { invalidateAccountBalances, predicateMatch } from "../utils";

/**
 * Invalidate every read a delegation grant can move, for one granting account
 * and the delegates it just authorized.
 *
 * @param queryClient - The active `QueryClient`.
 * @param parameters - The chain's config key, the granting account, and each granted delegate.
 *
 * @internal
 */
export function invalidateDelegationGrant(
  queryClient: QueryClient,
  parameters: { configKey: string; account: Address; delegates: readonly Address[] },
) {
  const { configKey, account } = parameters;

  for (const delegate of parameters.delegates) {
    const delegation = { configKey, account, delegate };
    void queryClient.invalidateQueries({ predicate: predicateMatch(getDelegationExpiryQueryKey, delegation) });
    void queryClient.invalidateQueries({ predicate: predicateMatch(getIsDelegationActiveQueryKey, delegation) });
  }

  /**
   * A grant also turns probed selectors active and clears any pending
   * revocation for them. These two keys hold the delegator as an object, which
   * a field-equality predicate cannot select, and `getActiveDelegations` also
   * answers for the account's virtual accounts (resolved to their parent). So
   * they are refreshed per chain config; both are cheap reads and grants are
   * rare.
   */
  void queryClient.invalidateQueries({ predicate: predicateMatch(getActiveDelegationsQueryKey, { configKey }) });
  void queryClient.invalidateQueries({ predicate: predicateMatch(getPendingRevocationEtasQueryKey, { configKey }) });

  /**
   * A relayed grant also consumes an InstantLayer nonce and charges the
   * operational fee from collateral. The hook cannot see which transport ran,
   * so it invalidates the superset: a wallet grant moves none of these, and an
   * extra refetch costs far less than a stale allowance silently blocking the
   * next relay.
   */
  void queryClient.invalidateQueries({
    predicate: predicateMatch(getInstantLayerNonceQueryKey, { configKey, account }),
  });
  void queryClient.invalidateQueries({
    predicate: predicateMatch(getOperationalFeeAllowanceQueryKey, { configKey, payer: account }),
  });
  invalidateAccountBalances(queryClient, { configKey });
}
