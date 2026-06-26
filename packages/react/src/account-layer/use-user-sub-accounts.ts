"use client";

import {
  getUserSubAccountsQueryOptions,
  type ConfigParameter,
  type GetUserSubAccountsOptions,
  type SubAccountDetail,
} from "@theoldvarorg/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useUserSubAccounts}: the core query options (user,
 * pagination, chain id, TanStack `query` overrides) plus an optional `config`.
 */
export type UseUserSubAccountsParameters = GetUserSubAccountsOptions & ConfigParameter;

/** Return type of {@link useUserSubAccounts}. */
export type UseUserSubAccountsReturnType = UseQueryResult<readonly SubAccountDetail[], SymmioRequestError>;

/**
 * Read all SYMMIO subaccounts owned by `parameters.user`. The query is disabled
 * until `user` is set. `chainId` defaults to the connected chain.
 *
 * Returns react-query's full {@link UseQueryResult} — `data`, `error`,
 * `isLoading`, `refetch`, etc. Errors are normalized to {@link SymmioRequestError}
 * so `error.kind` is always one of the documented discriminator values.
 *
 * @example
 * ```tsx
 * const { data: subs, isLoading, error } = useUserSubAccounts({ user: address });
 * if (isLoading) return <Spinner />;
 * if (error) return <ErrorView kind={error.kind} message={error.message} />;
 * return <SubAccountList items={subs ?? []} />;
 * ```
 */
export function useUserSubAccounts(parameters: UseUserSubAccountsParameters = {}): UseUserSubAccountsReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getUserSubAccountsQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId,
  });

  return useQuery({
    ...options,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseUserSubAccountsReturnType;
}
