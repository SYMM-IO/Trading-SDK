"use client";

import { SymmError, type SubAccountDetail } from "@symm-frontier/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { Address } from "viem";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioClient } from "../provider/use-symmio-client";
import { accountLayerQueryKeys } from "./query-keys";

/**
 * Parameters accepted by {@link useUserSubAccounts}.
 */
export interface UseUserSubAccountsParams {
  /**
   * EOA whose subaccounts to list. The query is **disabled** while this is
   * `undefined`, which is how UIs render "connect your wallet first" states
   * without writing manual `enabled` checks.
   */
  user?: Address;
  /** Pagination offset, in subaccounts. Defaults to `0n`. */
  offset?: bigint;
  /** Pagination limit, in subaccounts. Defaults to `200n` (matches Explorer Inspector). */
  limit?: bigint;
  /**
   * Disable the query unconditionally. Use when the UI gates the fetch on
   * something other than wallet presence (e.g. a feature flag).
   */
  enabled?: boolean;
}

/**
 * Read all SYMMIO subaccounts owned by `params.user`.
 *
 * Returns react-query's full {@link UseQueryResult} shape — `data`, `error`,
 * `isLoading`, `refetch`, etc. — so the consumer can render loading and error
 * states without learning a custom SDK shape.
 *
 * Errors are normalized to {@link SymmioRequestError} before they reach
 * react-query, so `error?.kind` is always one of the documented discriminator
 * values.
 *
 * @example
 * const { data: subs, isLoading, error } = useUserSubAccounts({ user: address });
 * if (isLoading) return <Spinner />;
 * if (error) return <ErrorView kind={error.kind} message={error.message} />;
 * return <SubAccountList items={subs ?? []} />;
 */
export function useUserSubAccounts(
  params: UseUserSubAccountsParams,
): UseQueryResult<readonly SubAccountDetail[], SymmioRequestError> {
  const client = useSymmioClient();

  const enabled = (params.enabled ?? true) && params.user !== undefined && client !== undefined;

  return useQuery<readonly SubAccountDetail[], SymmioRequestError>({
    queryKey: accountLayerQueryKeys.getUserSubAccounts({
      chainId: client?.config.chainId ?? 0,
      accountLayerAddress: client?.config.addresses.accountLayerAddress ?? ZERO_ADDRESS,
      user: params.user ?? ZERO_ADDRESS,
      offset: params.offset,
      limit: params.limit,
    }),
    enabled,
    queryFn: async () => {
      if (!client) {
        throw normalizeSymmError(new SymmError("No public client available for the configured chain."));
      }
      if (!params.user) {
        throw normalizeSymmError(new SymmError("`user` is required to query subaccounts."));
      }

      try {
        return await client.getUserSubAccounts({
          user: params.user,
          offset: params.offset,
          limit: params.limit,
        });
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  });
}

/**
 * Address used as the `user` placeholder in the query key while the real user
 * is `undefined`. The query is disabled in that case, so this value is never
 * actually sent on-chain — it just keeps the key shape uniform.
 *
 * @internal
 */
const ZERO_ADDRESS: Address = "0x0000000000000000000000000000000000000000";
