"use client";

import {
  getWithdrawableTimeQueryOptions,
  type ConfigParameter,
  type GetWithdrawableTimeOptions,
  type GetWithdrawableTimeReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useWithdrawableTime}: the core query options (user, chain
 * id, TanStack `query` overrides) plus an optional `config`.
 */
export type UseWithdrawableTimeParameters = GetWithdrawableTimeOptions & ConfigParameter;

/** Return type of {@link useWithdrawableTime}. */
export type UseWithdrawableTimeReturnType = UseQueryResult<GetWithdrawableTimeReturnType, SymmioRequestError>;

/**
 * Read the earliest timestamp (seconds) at which a withdrawal initiated now could
 * be finalized for a subaccount. The query is disabled until `user` is set.
 * `chainId` defaults to the connected chain.
 *
 * @example
 * ```tsx
 * const { data: withdrawableAt } = useWithdrawableTime({ user: subAccount });
 * ```
 */
export function useWithdrawableTime(parameters: UseWithdrawableTimeParameters = {}): UseWithdrawableTimeReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getWithdrawableTimeQueryOptions(config, {
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
  }) as UseWithdrawableTimeReturnType;
}
