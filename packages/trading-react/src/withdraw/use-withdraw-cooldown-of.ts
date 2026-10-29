"use client";

import {
  getWithdrawCooldownOfQueryOptions,
  type ConfigParameter,
  type GetWithdrawCooldownOfOptions,
  type GetWithdrawCooldownOfReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useWithdrawCooldownOf}: the core query options (`user`,
 * optional chain id, TanStack `query` overrides) plus an optional `config`.
 */
export type UseWithdrawCooldownOfParameters = GetWithdrawCooldownOfOptions & ConfigParameter;

/** Return type of {@link useWithdrawCooldownOf}. */
export type UseWithdrawCooldownOfReturnType = UseQueryResult<GetWithdrawCooldownOfReturnType, SymmioRequestError>;

/**
 * Read a subaccount's raw `withdrawCooldownOf` value: the core's stored
 * `deallocateTimestamp`, in Unix seconds.
 *
 * Deallocation and internal credits to withdrawable balance stamp it; ordinary
 * external deposits do not. It is **a timestamp, not a duration**, and not the
 * time a withdrawal unlocks — use {@link useWithdrawableTime} to know when a
 * withdrawal initiated now could be finalized. `chainId` defaults to the
 * connected chain.
 *
 * Deallocation hooks (`useDeallocate`, `useDeallocateAndInitiateWithdraw`,
 * `useWithdraw`) refresh this read once they succeed.
 *
 * @param parameters - The subaccount (`user`), optional chain id, query overrides and config.
 * @returns The TanStack query result; `data` is the stored timestamp in seconds (`0n` when never stamped).
 *
 * @example
 * ```tsx
 * const { data: lastCredit } = useWithdrawCooldownOf({ user: subAccount });
 * ```
 */
export function useWithdrawCooldownOf(parameters: UseWithdrawCooldownOfParameters): UseWithdrawCooldownOfReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getWithdrawCooldownOfQueryOptions(config, {
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
  }) as UseWithdrawCooldownOfReturnType;
}
