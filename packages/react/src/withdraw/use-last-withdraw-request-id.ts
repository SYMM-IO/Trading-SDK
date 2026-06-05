"use client";

import {
  getLastWithdrawRequestIdQueryOptions,
  type ConfigParameter,
  type GetLastWithdrawRequestIdOptions,
  type GetLastWithdrawRequestIdReturnType,
} from "@symm-frontier/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useLastWithdrawRequestId}: the core query options (user,
 * chain id, TanStack `query` overrides) plus an optional `config`.
 */
export type UseLastWithdrawRequestIdParameters = GetLastWithdrawRequestIdOptions & ConfigParameter;

/** Return type of {@link useLastWithdrawRequestId}. */
export type UseLastWithdrawRequestIdReturnType = UseQueryResult<GetLastWithdrawRequestIdReturnType, SymmioRequestError>;

/**
 * Read a subaccount's most recent withdraw request id (`0n` when there are none).
 * The query is disabled until `user` is set. `chainId` defaults to the connected
 * chain.
 *
 * @example
 * ```tsx
 * const { data: lastId } = useLastWithdrawRequestId({ user: subAccount });
 * ```
 */
export function useLastWithdrawRequestId(
  parameters: UseLastWithdrawRequestIdParameters = {},
): UseLastWithdrawRequestIdReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getLastWithdrawRequestIdQueryOptions(config, {
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
  }) as UseLastWithdrawRequestIdReturnType;
}
