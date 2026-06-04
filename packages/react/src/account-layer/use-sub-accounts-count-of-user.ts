"use client";

import {
  getSubAccountsCountOfUserQueryOptions,
  type ConfigParameter,
  type GetSubAccountsCountOfUserOptions,
  type GetSubAccountsCountOfUserReturnType,
} from "@symm-frontier/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useSubAccountsCountOfUser}: the core query options (user,
 * chain id, TanStack `query` overrides) plus an optional `config`.
 */
export type UseSubAccountsCountOfUserParameters = GetSubAccountsCountOfUserOptions & ConfigParameter;

/** Return type of {@link useSubAccountsCountOfUser}. */
export type UseSubAccountsCountOfUserReturnType = UseQueryResult<
  GetSubAccountsCountOfUserReturnType,
  SymmioRequestError
>;

/**
 * Read how many subaccounts `parameters.user` owns. The query is disabled until
 * `user` is set. `chainId` defaults to the connected chain. Errors are normalized
 * to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data: count } = useSubAccountsCountOfUser({ user: address });
 * ```
 */
export function useSubAccountsCountOfUser(
  parameters: UseSubAccountsCountOfUserParameters = {},
): UseSubAccountsCountOfUserReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getSubAccountsCountOfUserQueryOptions(config, {
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
  }) as UseSubAccountsCountOfUserReturnType;
}
