"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  getWithdrawRequestsQueryOptions,
  type ConfigParameter,
  type GetWithdrawRequestsOptions,
  type GetWithdrawRequestsReturnType,
} from "@theoldvarorg/core";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useWithdrawRequest}: the core query options (user, request
 * id, chain id, TanStack `query` overrides) plus an optional `config`.
 */
export type UseWithdrawRequestParameters = GetWithdrawRequestsOptions & ConfigParameter;

/** Return type of {@link useWithdrawRequest}. */
export type UseWithdrawRequestReturnType = UseQueryResult<GetWithdrawRequestsReturnType, SymmioRequestError>;

/**
 * Read a single withdraw request by `user` and `requestId`. The query is disabled
 * until both are set. `chainId` defaults to the connected chain.
 *
 * @example
 * ```tsx
 * const { data: request } = useWithdrawRequest({ user: subAccount, requestId: 1n });
 * ```
 */
export function useWithdrawRequest(parameters: UseWithdrawRequestParameters = {}): UseWithdrawRequestReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getWithdrawRequestsQueryOptions(config, {
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
  }) as UseWithdrawRequestReturnType;
}
