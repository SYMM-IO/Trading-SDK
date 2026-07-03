"use client";

import {
  getCollateralAllowanceQueryOptions,
  type ConfigParameter,
  type GetCollateralAllowanceOptions,
  type GetCollateralAllowanceReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useCollateralAllowance}: the core query options (owner,
 * chain id, TanStack `query` overrides) plus an optional `config`.
 */
export type UseCollateralAllowanceParameters = GetCollateralAllowanceOptions & ConfigParameter;

/** Return type of {@link useCollateralAllowance}. */
export type UseCollateralAllowanceReturnType = UseQueryResult<GetCollateralAllowanceReturnType, SymmioRequestError>;

/**
 * Read how much collateral `owner` has approved the SYMMIO core to spend. The
 * query is disabled until `owner` is set. `chainId` defaults to the connected
 * chain. Use it to decide whether a `useApproveCollateral` call is needed before
 * depositing.
 *
 * @example
 * ```tsx
 * const { data: allowance } = useCollateralAllowance({ owner: address });
 * const needsApproval = (allowance ?? 0n) < amount;
 * ```
 */
export function useCollateralAllowance(
  parameters: UseCollateralAllowanceParameters = {},
): UseCollateralAllowanceReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getCollateralAllowanceQueryOptions(config, {
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
  }) as UseCollateralAllowanceReturnType;
}
